#!/usr/bin/env node
// ============================================================
// QIA — Quality Intelligence Agent — CLI Entry Point
// Universal input: ticket key, Jira URL, optional extra context
// ============================================================

import { Command } from 'commander';
import chalk from 'chalk';
import { Orchestrator } from './agents/orchestrator.js';
import { ScannerAgent } from './agents/scanner-agent.js';

const program = new Command();

program
  .name('qia')
  .description('QIA — Quality Intelligence Agent: AI-powered QA automation')
  .version('1.0.0');

/**
 * Extract ticket key from a Jira URL or return as-is.
 * Handles:
 *   https://domain.atlassian.net/browse/SCRUM-13  → SCRUM-13
 *   SCRUM-13                                       → SCRUM-13
 */
function extractTicketKey(input: string): string {
  // Match Jira URL: .../browse/TICKET-123
  const urlMatch = input.match(/\/browse\/([A-Z]+-\d+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].toUpperCase();
  }
  // Match bare ticket key: ABC-123
  const keyMatch = input.match(/^([A-Za-z]+-\d+)$/);
  if (keyMatch?.[1]) {
    return keyMatch[1].toUpperCase();
  }
  // Return uppercased — let downstream handle any error
  return input.toUpperCase();
}

program
  .command('run <ticket> [extra-context]')
  .description(
    'Run full QIA pipeline for a Jira ticket.\n' +
    '  <ticket>        Ticket key (SCRUM-13) or full Jira URL\n' +
    '  [extra-context] Optional: text string, .xlsx path, or .pdf path to merge with AC'
  )
  .option('--auto-approve', 'Auto-approve all human gates (CI mode)', false)
  .option('--project-root <path>', 'Path to Playwright project root', process.cwd())
  .action(async (
    ticket: string,
    extraContext: string | undefined,
    options: { autoApprove: boolean; projectRoot: string }
  ) => {
    const ticketKey = extractTicketKey(ticket);

    console.log(chalk.bold.cyan(`\n[QIA] Ticket:  ${ticketKey}`));
    if (extraContext) {
      console.log(chalk.gray(`[QIA] Extra context: ${extraContext}`));
    }

    if (options.autoApprove) {
      process.env['QIA_AUTO_APPROVE_GATES'] = 'true';
    }

    const orchestrator = new Orchestrator(options.projectRoot);
    const run = await orchestrator.run(ticketKey, extraContext ?? null);

    process.exit(run.status === 'completed' ? 0 : 1);
  });

program
  .command('scan')
  .description('Scan framework DNA and save profile')
  .option('--force', 'Force rescan even if cache is fresh', false)
  .option('--project-root <path>', 'Path to Playwright project root', process.cwd())
  .action(async (options: { force: boolean; projectRoot: string }) => {
    const scanner = new ScannerAgent(options.projectRoot);
    const dna = await scanner.scan(options.force);
    console.log(chalk.green('\nDNA Profile:'));
    console.log(JSON.stringify(dna, null, 2));
  });

program
  .command('heal <file>')
  .description('Run self-healing locators on a test file')
  .option('--project-root <path>', 'Path to Playwright project root', process.cwd())
  .action(async (file: string, options: { projectRoot: string }) => {
    const { HealerAgent } = await import('./agents/healer-agent.js');
    const { ScannerAgent: SA } = await import('./agents/scanner-agent.js');
    const scanner = new SA(options.projectRoot);
    const dna = await scanner.scan();
    const healer = new HealerAgent(dna);
    const report = await healer.healFile(file);
    console.log(chalk.green(`\nHealing complete: ${report.healed}/${report.totalLocators} locators fixed`));
  });

program.parse(process.argv);
