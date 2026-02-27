#!/usr/bin/env node
// ============================================================
// QIA — Quality Intelligence Agent — CLI Entry Point
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

program
  .command('run <ticket-key>')
  .description('Run full QIA pipeline for a Jira ticket')
  .option('--auto-approve', 'Auto-approve all human gates (CI mode)', false)
  .option('--project-root <path>', 'Path to Playwright project root', process.cwd())
  .action(async (ticketKey: string, options: { autoApprove: boolean; projectRoot: string }) => {
    if (options.autoApprove) {
      process.env['QIA_AUTO_APPROVE_GATES'] = 'true';
    }

    const orchestrator = new Orchestrator(options.projectRoot);
    const run = await orchestrator.run(ticketKey);

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
