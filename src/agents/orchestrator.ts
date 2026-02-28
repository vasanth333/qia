// ============================================================
// QIA — Orchestrator
// Master conductor: coordinates all agents through the full pipeline
// Read → Scan → Strategy → [Gate 1] → Generate → Execute
// → RCA → Heal-loop → [Gate 2] → Push → [Gate 3] → Results → Jira
// ============================================================

import chalk from 'chalk';
import { v4 as uuid } from 'uuid';

import { ReaderAgent } from './reader-agent.js';
import { ScannerAgent } from './scanner-agent.js';
import { StrategistAgent } from './strategist-agent.js';
import { EngineerAgent } from './engineer-agent.js';
import { ExecutorAgent } from './executor-agent.js';
import { HealerAgent } from './healer-agent.js';
import { RCAAgent } from './rca-agent.js';
import { ApprovalGate } from './approval-gate.js';
import { GitAgent } from './git-agent.js';
import { ReporterAgent } from './reporter-agent.js';

import type {
  QIARun,
  PhaseResult,
  JiraTicket,
  FrameworkDNA,
  TestStrategy,
  GeneratedTest,
  TestExecutionResult,
  PullRequestInfo,
} from '../types/index.js';

export class Orchestrator {
  private readonly reader = new ReaderAgent();
  private readonly scanner: ScannerAgent;
  private readonly strategist = new StrategistAgent();
  private readonly engineer = new EngineerAgent();
  private readonly gate = new ApprovalGate();
  private readonly reporter = new ReporterAgent();
  private readonly rcaAgent = new RCAAgent();
  private readonly projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.scanner = new ScannerAgent(projectRoot);
  }

  async run(ticketKey: string, extraContext: string | null = null): Promise<QIARun> {
    this.printBanner(ticketKey, extraContext);

    const runId = uuid();
    const run: QIARun = {
      id: runId,
      ticketKey,
      extraContext,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      phases: [],
      gates: [],
      generatedTests: [],
      executionResults: [],
      pullRequest: null,
      jiraUpdated: false,
    };

    try {
      // ── Phase 1: Read Jira Ticket ──────────────────────────────
      const ticket = await this.runPhase<JiraTicket>(run, 'read-ticket', () =>
        this.reader.readTicket(ticketKey, extraContext)
      );

      // ── Phase 2: Scan Framework DNA ───────────────────────────
      const dna = await this.runPhase<FrameworkDNA>(run, 'scan-framework', () =>
        this.scanner.scan()
      );

      // ── Phase 3: Build Strategy ────────────────────────────────
      const strategy = await this.runPhase<TestStrategy>(run, 'build-strategy', () =>
        this.strategist.buildStrategy(ticket, dna)
      );

      // ── GATE 1: Strategy Review ────────────────────────────────
      const gate1 = await this.gate.request(1, this.gate.buildGate1Context(strategy));
      run.gates.push(gate1);

      if (gate1.decision !== 'approved') {
        run.status = 'cancelled';
        console.log(chalk.red('\n[Orchestrator] Run cancelled at Gate 1'));
        return run;
      }

      // ── Phase 4: Generate Tests ────────────────────────────────
      const tests = await this.runPhase<GeneratedTest[]>(run, 'generate-tests', () =>
        this.engineer.generateTests(strategy, dna)
      );
      run.generatedTests = tests;

      // ── Phase 5: Execute Tests ─────────────────────────────────
      const executor = new ExecutorAgent(this.projectRoot);
      const executionResults = await this.runPhase<TestExecutionResult[]>(
        run,
        'execute-tests',
        () => executor.executeAll(tests)
      );
      run.executionResults = executionResults;

      // ── Phase 6: RCA on Failures ────────────────────────────────
      const allFailedTests = executionResults.flatMap(r => r.failedTests);
      if (allFailedTests.length > 0) {
        console.log(chalk.yellow(`\n[Orchestrator] Running RCA on ${allFailedTests.length} failure(s)...`));

        await this.runPhase(run, 'root-cause-analysis', async () => {
          for (const result of executionResults) {
            for (const ft of result.failedTests) {
              ft.rca = await this.rcaAgent.analyze(ft, null);
            }
          }
          return null;
        });
      }

      // ── Phase 7: Self-Heal Failing Tests ──────────────────────
      const healer = new HealerAgent(dna);
      const failingResults = executionResults.filter(r => r.failed > 0);

      if (failingResults.length > 0) {
        console.log(chalk.yellow(`\n[Orchestrator] ${failingResults.length} file(s) have failures — starting heal loop`));

        const healedResults = await this.runPhase<TestExecutionResult[]>(
          run,
          'heal-locators',
          async () => {
            const updated = [...executionResults];
            for (const result of failingResults) {
              const genTest = tests.find(t => t.filePath === result.filePath);
              if (!genTest) continue;
              const healed = await healer.healAndRerun(genTest, result, this.projectRoot);
              const idx = updated.findIndex(r => r.filePath === result.filePath);
              if (idx !== -1) updated[idx] = healed;
            }
            return updated;
          }
        );
        run.executionResults = healedResults;
      } else {
        console.log(chalk.green('\n[Orchestrator] All tests passing — no healing needed'));
        await this.runPhase(run, 'heal-locators', async () => {
          for (const test of tests) {
            await healer.healFile(test.filePath);
          }
          return null;
        });
      }

      // ── GATE 2: Test Review (with execution results) ───────────
      const gate2 = await this.gate.request(2, this.gate.buildGate2Context(tests, run.executionResults));
      run.gates.push(gate2);

      if (gate2.decision !== 'approved') {
        run.status = 'cancelled';
        console.log(chalk.red('\n[Orchestrator] Run cancelled at Gate 2'));
        return run;
      }

      // ── GATE 3: Push Approval ──────────────────────────────────
      const gate3 = await this.gate.request(3, this.gate.buildGate3Context(null, ticketKey));
      run.gates.push(gate3);

      if (gate3.decision !== 'approved') {
        run.status = 'cancelled';
        console.log(chalk.red('\n[Orchestrator] Run cancelled at Gate 3'));
        return run;
      }

      // ── Phase 8: Git Push + PR ─────────────────────────────────
      const gitAgent = new GitAgent(ticketKey);
      const pr = await this.runPhase<PullRequestInfo>(run, 'git-push', () =>
        gitAgent.commitAndPush(tests, ticketKey)
      );
      run.pullRequest = pr;

      // ── Phase 9: Allure Report + Jira Update + Slack ──────────
      await this.runPhase(run, 'report', async () => {
        run.completedAt = new Date().toISOString();
        await this.reporter.generateAllureReport(ticketKey, ticket.summary, run.executionResults);
        await this.reporter.updateJira(run, pr, run.executionResults);
        await this.reporter.notifySlack(run, pr, run.executionResults);
        run.jiraUpdated = true;
        return null;
      });

      run.status = 'completed';
      run.completedAt = new Date().toISOString();

      this.reporter.printFinalSummary(run, run.pullRequest, run.executionResults);

    } catch (error) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      const msg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n[Orchestrator] FATAL ERROR: ${msg}`));
      if (error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }

    return run;
  }

  private async runPhase<T>(run: QIARun, phase: string, fn: () => Promise<T>): Promise<T> {
    const phaseResult: PhaseResult = {
      phase,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      output: null,
      error: null,
    };
    run.phases.push(phaseResult);

    try {
      const result = await fn();
      phaseResult.status = 'completed';
      phaseResult.completedAt = new Date().toISOString();
      phaseResult.output = result;
      return result;
    } catch (error) {
      phaseResult.status = 'failed';
      phaseResult.completedAt = new Date().toISOString();
      phaseResult.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private printBanner(ticketKey: string, extraContext: string | null): void {
    const ctxLine = extraContext
      ? `║  Context:  ${extraContext.slice(0, 46).padEnd(46)} ║`
      : null;

    console.log(chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════╗
║         QIA — Quality Intelligence Agent                 ║
║         World-class AI-powered QA Automation             ║
╠══════════════════════════════════════════════════════════╣
║  Ticket: ${ticketKey.padEnd(48)} ║
${ctxLine ? `${ctxLine}\n` : ''}║  Pipeline:                                               ║
║  Read → Scan → Strategy → [Gate 1] → Generate           ║
║  → Execute → RCA → Heal → [Gate 2] → Push → [Gate 3]    ║
║  → Allure Report → Jira Update                           ║
╚══════════════════════════════════════════════════════════╝
`));
  }
}
