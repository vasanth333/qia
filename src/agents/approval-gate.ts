// ============================================================
// QIA — Human Approval Gate
// Nothing moves without human sign-off at 3 critical checkpoints
// ============================================================

import readline from 'readline';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import type { GateContext, GateResult, GateDecision, GateNumber } from '../types/index.js';

const GATE_LABELS: Record<GateNumber, string> = {
  1: 'STRATEGY REVIEW',
  2: 'TEST REVIEW',
  3: 'PUSH APPROVAL',
};

const GATE_DESCRIPTIONS: Record<GateNumber, string> = {
  1: 'Review the AI-generated test strategy before any tests are written',
  2: 'Review generated tests before running them and pushing to GitHub',
  3: 'Final approval to push branch, create PR, and update Jira',
};

export class ApprovalGate {
  async request(gate: GateNumber, context: GateContext): Promise<GateResult> {
    console.log(chalk.bold.yellow(`\n${'═'.repeat(60)}`));
    console.log(chalk.bold.yellow(`  HUMAN GATE ${gate}/3 — ${GATE_LABELS[gate]}`));
    console.log(chalk.bold.yellow(`${'═'.repeat(60)}`));
    console.log(chalk.gray(`  ${GATE_DESCRIPTIONS[gate]}\n`));

    this.printArtifacts(context);

    // Check env var directly in addition to agentConfig (handles --auto-approve CLI flag
    // which sets the env var after agentConfig is already loaded at import time)
    if (agentConfig.autoApproveGates || process.env['QIA_AUTO_APPROVE_GATES'] === 'true') {
      console.log(chalk.blue('[Gate] Auto-approve mode enabled — proceeding automatically'));
      return this.buildResult(gate, 'approved', 'QIA Auto-Approve', '');
    }

    return await this.promptUser(gate, context);
  }

  private printArtifacts(context: GateContext): void {
    for (const artifact of context.artifacts) {
      console.log(chalk.bold(`\n  ${artifact.label}:`));

      if (artifact.type === 'code') {
        console.log(chalk.gray('  ' + '─'.repeat(56)));
        const lines = artifact.value.split('\n').slice(0, 30);
        for (const line of lines) {
          console.log(chalk.white(`  ${line}`));
        }
        if (artifact.value.split('\n').length > 30) {
          console.log(chalk.gray(`  ... (${artifact.value.split('\n').length - 30} more lines)`));
        }
        console.log(chalk.gray('  ' + '─'.repeat(56)));
      } else {
        const lines = artifact.value.split('\n');
        for (const line of lines) {
          console.log(chalk.white(`  ${line}`));
        }
      }
    }
  }

  private async promptUser(gate: GateNumber, _context: GateContext): Promise<GateResult> {
    return new Promise((resolve) => {
      const timeoutMs = agentConfig.gateTimeoutMinutes * 60 * 1000;

      const timer = setTimeout(() => {
        rl.close();
        console.log(chalk.red(`\n[Gate ${gate}] Timeout after ${agentConfig.gateTimeoutMinutes} minutes — auto-rejecting`));
        resolve(this.buildResult(gate, 'timeout', 'TIMEOUT', ''));
      }, timeoutMs);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log(chalk.bold.yellow(`\n  What would you like to do?`));
      console.log(chalk.green(`  [A] Approve — Continue to next phase`));
      console.log(chalk.red(`  [R] Reject — Stop QIA run`));
      console.log(chalk.blue(`  [M] Modify — Add notes and continue`));

      rl.question(chalk.bold('\n  Your choice (A/R/M): '), (choice) => {
        clearTimeout(timer);

        const normalized = choice.trim().toUpperCase();

        if (normalized === 'R') {
          rl.close();
          console.log(chalk.red(`\n[Gate ${gate}] REJECTED — QIA run stopped`));
          resolve(this.buildResult(gate, 'rejected', 'Human Reviewer', ''));
          return;
        }

        if (normalized === 'M') {
          rl.question('  Notes (optional): ', (notes) => {
            rl.close();
            console.log(chalk.green(`\n[Gate ${gate}] APPROVED WITH NOTES`));
            resolve(this.buildResult(gate, 'approved', 'Human Reviewer', notes));
          });
          return;
        }

        // Default: Approve
        rl.close();
        console.log(chalk.green(`\n[Gate ${gate}] APPROVED — Proceeding`));
        resolve(this.buildResult(gate, 'approved', 'Human Reviewer', ''));
      });
    });
  }

  private buildResult(
    gate: GateNumber,
    decision: GateDecision,
    approvedBy: string,
    notes: string
  ): GateResult {
    return {
      gate,
      decision,
      approvedBy,
      timestamp: new Date().toISOString(),
      notes,
    };
  }

  buildGate1Context(strategy: import('../types/index.js').TestStrategy): GateContext {
    const suiteList = strategy.testSuites
      .map(s => `  • [${s.type.toUpperCase()}] ${s.scenarios.length} scenarios — ${s.priority} priority`)
      .join('\n');

    return {
      gate: 1,
      title: GATE_LABELS[1],
      description: GATE_DESCRIPTIONS[1],
      requiresApproval: true,
      timeoutMinutes: agentConfig.gateTimeoutMinutes,
      artifacts: [
        { label: 'AI REASONING', value: strategy.reasoning, type: 'text' },
        { label: 'TEST SUITES PLANNED', value: suiteList, type: 'text' },
        { label: 'RISK AREAS', value: strategy.riskAreas.map(r => `  • ${r}`).join('\n'), type: 'text' },
        { label: 'TOTAL TESTS', value: `  ${strategy.estimatedCount} tests across ${strategy.testSuites.length} files`, type: 'text' },
        { label: 'COVERAGE GOAL', value: `  ${strategy.coverageGoal}`, type: 'text' },
      ],
    };
  }

  buildGate2Context(
    tests: import('../types/index.js').GeneratedTest[],
    executionResults?: import('../types/index.js').TestExecutionResult[]
  ): GateContext {
    const fileList = tests
      .map(t => `  • ${t.filePath} (${t.scenarioCount} tests, ${t.type})`)
      .join('\n');

    const firstTest = tests[0];

    const execSummary = executionResults && executionResults.length > 0
      ? (() => {
          const passed = executionResults.reduce((s, r) => s + r.passed, 0);
          const failed = executionResults.reduce((s, r) => s + r.failed, 0);
          const skipped = executionResults.reduce((s, r) => s + r.skipped, 0);
          const healed = executionResults.filter(r => r.healAttempts > 0).length;
          const lines = [
            `  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`,
            ...(healed > 0 ? [`  Self-healed files: ${healed}`] : []),
          ];
          for (const r of executionResults) {
            for (const ft of r.failedTests) {
              lines.push(`  ✗ ${ft.title}`);
              lines.push(`    ${ft.error.split('\n')[0]}`);
            }
          }
          return lines.join('\n');
        })()
      : '  (Tests not yet executed)';

    return {
      gate: 2,
      title: GATE_LABELS[2],
      description: GATE_DESCRIPTIONS[2],
      requiresApproval: true,
      timeoutMinutes: agentConfig.gateTimeoutMinutes,
      artifacts: [
        { label: 'GENERATED FILES', value: fileList, type: 'text' },
        { label: 'EXECUTION RESULTS', value: execSummary, type: 'text' },
        ...(firstTest ? [{
          label: `PREVIEW: ${firstTest.filePath}`,
          value: firstTest.content.slice(0, 2000),
          type: 'code' as const,
        }] : []),
      ],
    };
  }

  buildGate3Context(pr: import('../types/index.js').PullRequestInfo | null, ticketKey: string): GateContext {
    return {
      gate: 3,
      title: GATE_LABELS[3],
      description: GATE_DESCRIPTIONS[3],
      requiresApproval: true,
      timeoutMinutes: agentConfig.gateTimeoutMinutes,
      artifacts: [
        {
          label: 'ACTIONS TO BE TAKEN',
          value: [
            '  1. Push branch to GitHub',
            `  2. Create Pull Request: "QIA: ${ticketKey} — AI-generated tests"`,
            '  3. Trigger GitHub Actions CI (4 shards)',
            `  4. Update Jira ticket ${ticketKey} status → Done`,
            '  5. Post Slack notification (if configured)',
          ].join('\n'),
          type: 'text',
        },
        ...(pr ? [{ label: 'PULL REQUEST', value: `  ${pr.url}`, type: 'url' as const }] : []),
      ],
    };
  }
}
