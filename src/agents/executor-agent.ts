// ============================================================
// QIA — Executor Agent
// Runs generated Playwright tests, captures real pass/fail counts,
// reads evidence files (screenshots, console errors, network logs)
// ============================================================

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type {
  GeneratedTest,
  TestExecutionResult,
  FailedTest,
  TestEvidence,
} from '../types/index.js';

// Playwright JSON reporter output shape (subset)
interface PwSuite {
  title: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}

interface PwSpec {
  title: string;
  file: string;
  ok: boolean;
  tests?: PwTest[];
}

interface PwTest {
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  results?: PwTestResult[];
}

interface PwTestResult {
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  error?: { message?: string; stack?: string };
  attachments?: Array<{ name: string; path?: string; contentType: string }>;
  duration: number;
}

interface PwJsonReport {
  stats: {
    expected: number;
    unexpected: number;
    skipped: number;
    duration: number;
  };
  suites: PwSuite[];
}

export class ExecutorAgent {
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async executeTest(generatedTest: GeneratedTest): Promise<TestExecutionResult> {
    const { filePath, type } = generatedTest;
    console.log(chalk.cyan(`\n[ExecutorAgent] Running: ${path.basename(filePath)}`));

    // Ensure required directories exist
    fs.mkdirSync(path.join(this.projectRoot, 'test-results'), { recursive: true });
    fs.mkdirSync(path.join(this.projectRoot, 'test-results', 'screenshots'), { recursive: true });
    fs.mkdirSync(path.join(this.projectRoot, 'test-results', 'evidence'), { recursive: true });

    const start = Date.now();
    let rawJson = '';
    let exitedOk = false;

    try {
      rawJson = execSync(
        `npx playwright test "${filePath}" --output=test-results --config=playwright.config.ts --reporter=json`,
        {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          maxBuffer: 20 * 1024 * 1024,
          env: { ...process.env, CI: 'false' },
        }
      );
      exitedOk = true;
    } catch (err) {
      // Non-zero exit = test failures — stdout still has JSON
      rawJson = (err as { stdout?: string }).stdout ?? '';
    }

    const durationMs = Date.now() - start;
    const report = this.parseJsonString(rawJson);

    if (!report) {
      console.warn(chalk.yellow('[ExecutorAgent] Could not parse JSON report — treating as error'));
      return {
        filePath,
        type,
        passed: 0,
        failed: exitedOk ? 0 : 1,
        skipped: 0,
        total: 1,
        durationMs,
        failedTests: [],
        healAttempts: 0,
        ultimatelyPassed: exitedOk,
      };
    }

    const { passed, failed, skipped, failedTests } = this.parseReport(report, filePath);

    // Enrich failed tests with evidence files written by the test's afterEach hook
    const enrichedFailedTests = this.enrichWithEvidence(failedTests);

    const total = passed + failed + skipped;
    const statusIcon = failed === 0 ? chalk.green('✓') : chalk.red('✗');

    console.log(chalk.white(
      `  ${statusIcon} ${path.basename(filePath)}: ${passed} passed, ${failed} failed, ${skipped} skipped (${Math.round(durationMs / 1000)}s)`
    ));

    if (enrichedFailedTests.length > 0) {
      for (const ft of enrichedFailedTests) {
        console.log(chalk.red(`    ✗ ${ft.title}`));
        if (ft.error) console.log(chalk.gray(`      ${ft.error.split('\n')[0]}`));
        if (ft.fullPageScreenshotPath) {
          console.log(chalk.gray(`      📸 Screenshot: ${ft.fullPageScreenshotPath}`));
        }
        if (ft.consoleErrors.length > 0) {
          console.log(chalk.gray(`      🌐 Console errors: ${ft.consoleErrors.length}`));
        }
      }
    }

    return {
      filePath,
      type,
      passed,
      failed,
      skipped,
      total,
      durationMs,
      failedTests: enrichedFailedTests,
      healAttempts: 0,
      ultimatelyPassed: failed === 0,
    };
  }

  async executeAll(generatedTests: GeneratedTest[]): Promise<TestExecutionResult[]> {
    console.log(chalk.bold.cyan(`\n[ExecutorAgent] Executing ${generatedTests.length} test file(s)...`));
    const results: TestExecutionResult[] = [];

    for (const test of generatedTests) {
      const result = await this.executeTest(test);
      results.push(result);
    }

    this.printExecutionSummary(results);
    return results;
  }

  // ------------------------------------------------------------------
  // Evidence enrichment
  // ------------------------------------------------------------------

  /**
   * For each failed test, look for a QIA evidence JSON file written by the test's afterEach hook.
   * Evidence file lives at: test-results/evidence/{test-slug}.json
   */
  private enrichWithEvidence(failedTests: FailedTest[]): FailedTest[] {
    return failedTests.map(ft => {
      const evidencePath = this.findEvidenceFile(ft.title);
      if (!evidencePath) return ft;

      try {
        const raw = fs.readFileSync(evidencePath, 'utf-8');
        const evidence = JSON.parse(raw) as TestEvidence;
        return {
          ...ft,
          fullPageScreenshotPath: evidence.screenshotPath ?? ft.fullPageScreenshotPath,
          consoleErrors: evidence.consoleErrors ?? ft.consoleErrors,
          networkRequests: evidence.networkRequests ?? ft.networkRequests,
          domSnapshot: evidence.domSnapshot ?? ft.domSnapshot,
        };
      } catch {
        return ft;
      }
    });
  }

  private findEvidenceFile(testTitle: string): string | null {
    const slug = testTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const evidenceDir = path.join(this.projectRoot, 'test-results', 'evidence');
    const candidate = path.join(evidenceDir, `${slug}.json`);

    if (fs.existsSync(candidate)) return candidate;

    // Fuzzy fallback: try partial match
    if (!fs.existsSync(evidenceDir)) return null;

    try {
      const files = fs.readdirSync(evidenceDir);
      const match = files.find(f => {
        const base = path.basename(f, '.json');
        return slug.startsWith(base) || base.startsWith(slug.slice(0, 15));
      });
      return match ? path.join(evidenceDir, match) : null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Playwright JSON report parsing
  // ------------------------------------------------------------------

  private parseJsonString(raw: string): PwJsonReport | null {
    if (!raw || !raw.trim()) return null;
    try {
      const jsonStart = raw.indexOf('{');
      if (jsonStart === -1) return null;
      return JSON.parse(raw.slice(jsonStart)) as PwJsonReport;
    } catch {
      return null;
    }
  }

  private parseReport(report: PwJsonReport, targetFile: string): {
    passed: number;
    failed: number;
    skipped: number;
    failedTests: FailedTest[];
  } {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failedTests: FailedTest[] = [];

    const visitSpec = (spec: PwSpec) => {
      for (const test of (spec.tests ?? [])) {
        const lastResult = test.results?.[test.results.length - 1];
        const status = lastResult?.status ?? test.status;

        if (status === 'passed') {
          passed++;
        } else if (status === 'skipped') {
          skipped++;
        } else {
          failed++;
          const errMsg = lastResult?.error?.message ?? lastResult?.error?.stack ?? 'Unknown error';
          const screenshotAttachment = lastResult?.attachments?.find(
            a => a.contentType.startsWith('image/') && a.path
          );
          const fullPageAttachment = lastResult?.attachments?.find(
            a => a.name === 'full-page-screenshot' && a.path
          );
          failedTests.push({
            title: spec.title,
            file: spec.file ?? targetFile,
            error: errMsg.slice(0, 500),
            screenshotPath: screenshotAttachment?.path ?? null,
            fullPageScreenshotPath: fullPageAttachment?.path ?? null,
            consoleErrors: [],
            networkRequests: [],
            domSnapshot: null,
            rca: null,
          });
        }
      }
    };

    const visitSuite = (suite: PwSuite) => {
      for (const spec of (suite.specs ?? [])) visitSpec(spec);
      for (const child of (suite.suites ?? [])) visitSuite(child);
    };

    for (const suite of (report.suites ?? [])) visitSuite(suite);

    // Fallback to report.stats if suites are empty
    if (passed === 0 && failed === 0 && skipped === 0 && report.stats) {
      passed = report.stats.expected ?? 0;
      failed = report.stats.unexpected ?? 0;
      skipped = report.stats.skipped ?? 0;
    }

    return { passed, failed, skipped, failedTests };
  }

  private printExecutionSummary(results: TestExecutionResult[]): void {
    const totalPassed = results.reduce((s, r) => s + r.passed, 0);
    const totalFailed = results.reduce((s, r) => s + r.failed, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
    const totalDuration = results.reduce((s, r) => s + r.durationMs, 0);

    console.log(chalk.bold(`\n${'─'.repeat(50)}`));
    console.log(chalk.bold(`  EXECUTION SUMMARY`));
    console.log(chalk.bold(`${'─'.repeat(50)}`));
    console.log(chalk.green(`  Passed:  ${totalPassed}`));
    if (totalFailed > 0) console.log(chalk.red(`  Failed:  ${totalFailed}`));
    if (totalSkipped > 0) console.log(chalk.yellow(`  Skipped: ${totalSkipped}`));
    console.log(chalk.gray(`  Time:    ${Math.round(totalDuration / 1000)}s`));
    console.log(chalk.bold(`${'─'.repeat(50)}\n`));
  }
}
