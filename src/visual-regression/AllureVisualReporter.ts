// ============================================================
// QIA — Allure Visual Reporter
// Attaches visual regression results to Allure report
// ============================================================

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { VisualComparison } from '../types/index.js';

const ALLURE_RESULTS = process.env['ALLURE_RESULTS_DIR'] ?? 'allure-results';

export class AllureVisualReporter {
  constructor() {
    fs.mkdirSync(ALLURE_RESULTS, { recursive: true });
  }

  attachComparisons(_testName: string, comparisons: VisualComparison[]): void {
    for (const comparison of comparisons) {
      this.attachComparison(comparison);
    }
  }

  private attachComparison(comparison: VisualComparison): void {
    const status = comparison.passed ? 'PASS' : 'FAIL';
    const label = `Visual [${comparison.viewport.name}] ${status}`;

    // Attach baseline
    if (fs.existsSync(comparison.baselinePath)) {
      this.attachFile(label + ' — Baseline', comparison.baselinePath);
    }

    // Attach current
    if (fs.existsSync(comparison.currentPath)) {
      this.attachFile(label + ' — Current', comparison.currentPath);
    }

    // Write analysis text
    const analysisText = [
      `Component: ${comparison.name}`,
      `Viewport: ${comparison.viewport.name} (${comparison.viewport.width}x${comparison.viewport.height})`,
      `Diff: ${(comparison.diffPercentage * 100).toFixed(3)}%`,
      `Status: ${status}`,
      `AI Analysis: ${comparison.aiAnalysis ?? 'N/A'}`,
    ].join('\n');

    const analysisPath = path.join(
      ALLURE_RESULTS,
      `visual-${comparison.name}-${comparison.viewport.name}-analysis.txt`
    );
    fs.writeFileSync(analysisPath, analysisText);

    console.log(
      comparison.passed
        ? chalk.green(`  [Allure] Attached: ${label}`)
        : chalk.red(`  [Allure] Attached: ${label}`)
    );
  }

  private attachFile(_name: string, filePath: string): void {
    const ext = path.extname(filePath);
    const dest = path.join(ALLURE_RESULTS, `visual-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    try {
      fs.copyFileSync(filePath, dest);
    } catch {
      // Non-fatal
    }
  }

  writeSummaryAttachment(comparisons: VisualComparison[]): void {
    const passed = comparisons.filter(c => c.passed).length;
    const failed = comparisons.filter(c => !c.passed).length;

    const summary = {
      totalViewports: comparisons.length,
      passed,
      failed,
      passRate: comparisons.length > 0 ? (passed / comparisons.length * 100).toFixed(1) + '%' : 'N/A',
      comparisons: comparisons.map(c => ({
        name: c.name,
        viewport: c.viewport.name,
        diffPercentage: (c.diffPercentage * 100).toFixed(3) + '%',
        passed: c.passed,
        aiAnalysis: c.aiAnalysis,
      })),
    };

    const summaryPath = path.join(ALLURE_RESULTS, 'visual-regression-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  }
}
