// ============================================================
// QIA — Reporter Agent
// Allure report generation + Jira update + Slack notification
// ============================================================

import { execSync } from 'child_process';
import axios from 'axios';
import chalk from 'chalk';
import { jiraConfig, jiraAuthHeader } from '../config/jira.config.js';
import type { QIARun, PullRequestInfo } from '../types/index.js';

export class ReporterAgent {
  async generateAllureReport(): Promise<void> {
    console.log(chalk.cyan('\n[ReporterAgent] Generating Allure report...'));

    try {
      execSync(
        `npx allure generate allure-results --clean -o allure-report`,
        { encoding: 'utf-8', stdio: 'inherit' }
      );
      console.log(chalk.green('[ReporterAgent] Allure report generated: allure-report/'));
    } catch (error) {
      console.warn(chalk.yellow('[ReporterAgent] Allure generation failed (non-fatal)'));
    }
  }

  async updateJira(run: QIARun, pr: PullRequestInfo | null): Promise<void> {
    console.log(chalk.cyan(`\n[ReporterAgent] Updating Jira ticket: ${run.ticketKey}`));

    await this.postJiraComment(run, pr);
    await this.transitionJiraStatus(run.ticketKey);

    console.log(chalk.green(`[ReporterAgent] Jira updated: ${run.ticketKey}`));
  }

  private async postJiraComment(run: QIARun, pr: PullRequestInfo | null): Promise<void> {
    const testCount = run.generatedTests.reduce((sum, t) => sum + t.scenarioCount, 0);
    const fileCount = run.generatedTests.length;
    const duration = run.completedAt
      ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : 0;

    const commentBody = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: '🤖 QIA — Automated Tests Generated' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `QIA has successfully generated and pushed automated tests for this ticket.` }],
          },
          {
            type: 'bulletList',
            content: [
              this.jiraListItem(`Test files: ${fileCount}`),
              this.jiraListItem(`Total scenarios: ${testCount}`),
              this.jiraListItem(`Duration: ${duration}s`),
              this.jiraListItem(`Types: ${[...new Set(run.generatedTests.map(t => t.type))].join(', ')}`),
              ...(pr ? [this.jiraListItem(`PR: ${pr.url}`)] : []),
            ],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `Gates passed: ${run.gates.filter(g => g.decision === 'approved').length}/3` }],
          },
        ],
      },
    };

    try {
      await axios.post(
        `${jiraConfig.baseUrl}/rest/api/3/issue/${run.ticketKey}/comment`,
        commentBody,
        {
          headers: {
            Authorization: jiraAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn(chalk.yellow(`[ReporterAgent] Jira comment failed: ${error.response?.status}`));
      }
    }
  }

  private async transitionJiraStatus(ticketKey: string): Promise<void> {
    try {
      const transitionsRes = await axios.get(
        `${jiraConfig.baseUrl}/rest/api/3/issue/${ticketKey}/transitions`,
        { headers: { Authorization: jiraAuthHeader() } }
      );

      const transitions = transitionsRes.data as { transitions: Array<{ id: string; name: string }> };
      const doneTransition = transitions.transitions.find(
        t => t.name === jiraConfig.statuses.done
      );

      if (!doneTransition) {
        console.warn(chalk.yellow(`[ReporterAgent] Could not find "${jiraConfig.statuses.done}" transition`));
        return;
      }

      await axios.post(
        `${jiraConfig.baseUrl}/rest/api/3/issue/${ticketKey}/transitions`,
        { transition: { id: doneTransition.id } },
        {
          headers: {
            Authorization: jiraAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(chalk.green(`[ReporterAgent] Jira status → ${jiraConfig.statuses.done}`));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn(chalk.yellow(`[ReporterAgent] Jira transition failed: ${error.response?.status}`));
      }
    }
  }

  async notifySlack(run: QIARun, pr: PullRequestInfo | null): Promise<void> {
    const slackToken = process.env['SLACK_BOT_TOKEN'];
    const channelId = process.env['SLACK_CHANNEL_ID'];

    if (!slackToken || !channelId) return;

    console.log(chalk.cyan('\n[ReporterAgent] Sending Slack notification...'));

    const testCount = run.generatedTests.reduce((sum, t) => sum + t.scenarioCount, 0);

    const text = [
      `*QIA completed: ${run.ticketKey}* ✅`,
      `> ${testCount} tests generated across ${run.generatedTests.length} files`,
      pr ? `> PR: ${pr.url}` : '',
    ].filter(Boolean).join('\n');

    try {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        { channel: channelId, text, mrkdwn: true },
        { headers: { Authorization: `Bearer ${slackToken}` } }
      );
      console.log(chalk.green('[ReporterAgent] Slack notification sent'));
    } catch {
      console.warn(chalk.yellow('[ReporterAgent] Slack notification failed (non-fatal)'));
    }
  }

  printFinalSummary(run: QIARun, pr: PullRequestInfo | null): void {
    const testCount = run.generatedTests.reduce((sum, t) => sum + t.scenarioCount, 0);
    const duration = run.completedAt
      ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : 0;

    console.log(chalk.bold.green(`\n${'═'.repeat(60)}`));
    console.log(chalk.bold.green(`  QIA RUN COMPLETE`));
    console.log(chalk.bold.green(`${'═'.repeat(60)}`));
    console.log(chalk.white(`  Ticket:      ${run.ticketKey}`));
    console.log(chalk.white(`  Tests:       ${testCount} scenarios in ${run.generatedTests.length} files`));
    console.log(chalk.white(`  Duration:    ${duration}s`));
    console.log(chalk.white(`  Gates:       ${run.gates.filter(g => g.decision === 'approved').length}/3 approved`));
    console.log(chalk.white(`  Jira:        ${run.jiraUpdated ? '✓ Updated' : '✗ Not updated'}`));
    console.log(pr
      ? chalk.white(`  PR:          ${pr.url}`)
      : chalk.gray(`  PR:          Not created`)
    );
    console.log(chalk.bold.green(`${'═'.repeat(60)}\n`));
  }

  private jiraListItem(text: string): object {
    return {
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text }],
      }],
    };
  }
}
