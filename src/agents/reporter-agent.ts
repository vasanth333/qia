// ============================================================
// QIA — Reporter Agent
// • Allure report with ticket ID title + environment.properties
// • Jira: RCA comment with screenshot uploads + structured failure blocks
// • Slack summary notification
// ============================================================

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import chalk from 'chalk';
import { jiraConfig, jiraAuthHeader } from '../config/jira.config.js';
import type { QIARun, PullRequestInfo, TestExecutionResult, FailedTest } from '../types/index.js';

export class ReporterAgent {

  // ------------------------------------------------------------------
  // Allure Report — title includes ticket ID
  // ------------------------------------------------------------------

  async generateAllureReport(
    ticketKey: string,
    ticketSummary: string,
    executionResults: TestExecutionResult[]
  ): Promise<void> {
    console.log(chalk.cyan('\n[ReporterAgent] Generating Allure report...'));

    const resultsDir = 'allure-results';
    fs.mkdirSync(resultsDir, { recursive: true });

    const totalPassed = executionResults.reduce((s, r) => s + r.passed, 0);
    const totalFailed = executionResults.reduce((s, r) => s + r.failed, 0);
    const totalSkipped = executionResults.reduce((s, r) => s + r.skipped, 0);
    const durationSec = Math.round(executionResults.reduce((s, r) => s + r.durationMs, 0) / 1000);

    // environment.properties — shown in Allure "Environment" tab
    const envProps = [
      `Ticket=${ticketKey}`,
      `Summary=${ticketSummary}`,
      `Passed=${totalPassed}`,
      `Failed=${totalFailed}`,
      `Skipped=${totalSkipped}`,
      `Duration=${durationSec}s`,
      `Generated_By=QIA — Quality Intelligence Agent`,
    ].join('\n');
    fs.writeFileSync(path.join(resultsDir, 'environment.properties'), envProps);

    // executor.json — sets Allure report name/title
    const executorJson = {
      name: 'QIA — Quality Intelligence Agent',
      type: 'custom',
      buildName: `${ticketKey} — Test Results`,
      reportName: `${ticketKey} — Test Results`,
    };
    fs.writeFileSync(
      path.join(resultsDir, 'executor.json'),
      JSON.stringify(executorJson, null, 2)
    );

    try {
      execSync(
        `npx allure generate ${resultsDir} --clean -o allure-report`,
        { encoding: 'utf-8', stdio: 'inherit' }
      );
      console.log(chalk.green(`[ReporterAgent] Allure report: allure-report/index.html`));
      console.log(chalk.gray(`  Title: "${ticketKey} — Test Results"`));
    } catch {
      console.warn(chalk.yellow('[ReporterAgent] Allure generation failed (non-fatal)'));
    }
  }

  // ------------------------------------------------------------------
  // Jira Update
  // ------------------------------------------------------------------

  async updateJira(
    run: QIARun,
    pr: PullRequestInfo | null,
    executionResults: TestExecutionResult[]
  ): Promise<void> {
    console.log(chalk.cyan(`\n[ReporterAgent] Updating Jira ticket: ${run.ticketKey}`));

    const screenshotUrlMap = await this.uploadFailureScreenshots(run.ticketKey, executionResults);
    await this.postJiraComment(run, pr, executionResults, screenshotUrlMap);
    await this.transitionJiraStatus(run.ticketKey, executionResults);

    console.log(chalk.green(`[ReporterAgent] Jira updated: ${run.ticketKey}`));
  }

  // ------------------------------------------------------------------
  // Upload screenshots as Jira attachments
  // ------------------------------------------------------------------

  private async uploadFailureScreenshots(
    ticketKey: string,
    executionResults: TestExecutionResult[]
  ): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();
    const allFailed = executionResults.flatMap(r => r.failedTests);

    for (const ft of allFailed) {
      const screenshotPath = ft.fullPageScreenshotPath ?? ft.screenshotPath;
      if (!screenshotPath || !fs.existsSync(screenshotPath)) continue;

      try {
        const fileBuffer = fs.readFileSync(screenshotPath);
        const filename = path.basename(screenshotPath);

        // Build multipart body manually (avoids form-data package dependency)
        const boundary = `----QIABoundary${Date.now()}`;
        const CRLF = '\r\n';
        const disposition = `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: image/png${CRLF}${CRLF}`;
        const header = Buffer.from(`--${boundary}${CRLF}${disposition}`);
        const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
        const body = Buffer.concat([header, fileBuffer, footer]);

        const response = await axios.post(
          `${jiraConfig.baseUrl}/rest/api/3/issue/${ticketKey}/attachments`,
          body,
          {
            headers: {
              Authorization: jiraAuthHeader(),
              'X-Atlassian-Token': 'no-check',
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': String(body.length),
            },
          }
        );

        const attachments = response.data as Array<{ content: string; filename: string }>;
        const att = attachments[0];
        if (att?.content) {
          urlMap.set(ft.title, att.content);
          console.log(chalk.gray(`  [ReporterAgent] Uploaded: ${att.filename}`));
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.warn(chalk.yellow(
            `[ReporterAgent] Screenshot upload failed for "${ft.title}": ${error.response?.status ?? 'network error'}`
          ));
        }
      }
    }

    return urlMap;
  }

  // ------------------------------------------------------------------
  // Post Jira comment with results + RCA blocks per failure
  // ------------------------------------------------------------------

  private async postJiraComment(
    run: QIARun,
    pr: PullRequestInfo | null,
    executionResults: TestExecutionResult[],
    screenshotUrls: Map<string, string>
  ): Promise<void> {
    const totalPassed = executionResults.reduce((s, r) => s + r.passed, 0);
    const totalFailed = executionResults.reduce((s, r) => s + r.failed, 0);
    const totalSkipped = executionResults.reduce((s, r) => s + r.skipped, 0);
    const totalTests = totalPassed + totalFailed + totalSkipped;
    const durationSec = Math.round(executionResults.reduce((s, r) => s + r.durationMs, 0) / 1000);
    const allPassed = totalFailed === 0 && totalTests > 0;
    const statusEmoji = allPassed ? '✅' : '❌';
    const healedCount = executionResults.filter(r => r.healAttempts > 0).length;

    const summaryBullets: object[] = [
      this.jiraListItem(`📊 Total: ${totalTests} tests`),
      this.jiraListItem(`✅ Passed: ${totalPassed}`),
      this.jiraListItem(`❌ Failed: ${totalFailed}`),
      ...(totalSkipped > 0 ? [this.jiraListItem(`⏭ Skipped: ${totalSkipped}`)] : []),
      this.jiraListItem(`⏱ Duration: ${durationSec}s`),
      ...(healedCount > 0 ? [this.jiraListItem(`🔧 Self-healed files: ${healedCount}`)] : []),
      ...(pr ? [this.jiraListItem(`🔗 PR: ${pr.url}`)] : []),
      this.jiraListItem(`📈 Allure Report: allure-report/index.html`),
    ];

    const content: object[] = [
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: `${statusEmoji} QIA — ${run.ticketKey} Test Results` }],
      },
      { type: 'bulletList', content: summaryBullets },
    ];

    // Passed tests summary
    if (totalPassed > 0) {
      content.push({
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: `✅ Passed (${totalPassed})` }],
      });
      const passedNames = executionResults
        .flatMap(r => r.filePath ? [`${path.basename(r.filePath)}: ${r.passed} passed`] : []);
      if (passedNames.length > 0) {
        content.push({ type: 'bulletList', content: passedNames.map(n => this.jiraListItem(n)) });
      }
    }

    // Failed tests with structured RCA
    const allFailed = executionResults.flatMap(r => r.failedTests);
    if (allFailed.length > 0) {
      content.push({
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: `❌ Failed Tests — Root Cause Analysis` }],
      });

      for (const ft of allFailed) {
        content.push(...this.buildRCABlock(ft, screenshotUrls));
      }
    }

    try {
      await axios.post(
        `${jiraConfig.baseUrl}/rest/api/3/issue/${run.ticketKey}/comment`,
        { body: { type: 'doc', version: 1, content } },
        {
          headers: {
            Authorization: jiraAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(chalk.green('[ReporterAgent] Jira comment posted'));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn(chalk.yellow(`[ReporterAgent] Jira comment failed: ${error.response?.status}`));
      }
    }
  }

  /**
   * Build an ADF content block for one failed test's RCA:
   * ❌ Test: invalid-password-login
   * 📸 Screenshot: [attached]
   * 🔍 Root Cause: Frontend Issue
   * 📋 Reason: Error message element not visible
   * 🌐 Console Errors: [captured]
   * 🔗 API Log: POST /api/login → 200 OK
   * 💡 Suggested Fix: Check CSS visibility of .error-message
   * 👤 Assign to: Frontend Developer
   */
  private buildRCABlock(ft: FailedTest, screenshotUrls: Map<string, string>): object[] {
    const rca = ft.rca;
    const screenshotName = ft.fullPageScreenshotPath
      ? path.basename(ft.fullPageScreenshotPath)
      : ft.screenshotPath
        ? path.basename(ft.screenshotPath)
        : null;

    const lines: string[] = [`❌ Test: ${ft.title}`];

    if (screenshotName) {
      const attachedNote = screenshotUrls.has(ft.title) ? ' [attached]' : ` [local: ${screenshotName}]`;
      lines.push(`📸 Screenshot: ${screenshotName}${attachedNote}`);
    }

    if (rca) {
      lines.push(`🔍 Root Cause: ${rca.category}`);
      lines.push(`📋 Reason: ${rca.reason}`);
      if (rca.consoleErrors.length > 0) {
        const errPreview = rca.consoleErrors.slice(0, 2).join(' | ').slice(0, 200);
        lines.push(`🌐 Console Errors: ${errPreview}`);
      } else {
        lines.push(`🌐 Console Errors: None captured`);
      }
      if (rca.apiLog && rca.apiLog !== 'No API calls captured') {
        lines.push(`🔗 API Log: ${rca.apiLog.slice(0, 200)}`);
      } else {
        lines.push(`🔗 API Log: No API calls captured`);
      }
      lines.push(`💡 Suggested Fix: ${rca.suggestedFix}`);
      lines.push(`👤 Assign to: ${rca.assignTo}`);
    } else {
      lines.push(`📋 Error: ${ft.error.split('\n')[0] ?? ft.error}`);
    }

    return [
      { type: 'rule' },
      { type: 'bulletList', content: lines.map(l => this.jiraListItem(l)) },
    ];
  }

  // ------------------------------------------------------------------
  // Jira status transition: Done (all pass) | In Review (any fail)
  // ------------------------------------------------------------------

  private async transitionJiraStatus(
    ticketKey: string,
    executionResults: TestExecutionResult[]
  ): Promise<void> {
    const totalFailed = executionResults.reduce((s, r) => s + r.failed, 0);
    const totalTests = executionResults.reduce((s, r) => s + r.total, 0);

    if (totalTests === 0) {
      console.warn(chalk.yellow('[ReporterAgent] No tests executed — skipping Jira transition'));
      return;
    }

    const targetStatus = totalFailed === 0 ? jiraConfig.statuses.done : jiraConfig.statuses.inReview;
    console.log(chalk.cyan(`[ReporterAgent] Transitioning → ${targetStatus} (${totalFailed === 0 ? 'all passed' : `${totalFailed} failed`})`));

    try {
      const transitionsRes = await axios.get(
        `${jiraConfig.baseUrl}/rest/api/3/issue/${ticketKey}/transitions`,
        { headers: { Authorization: jiraAuthHeader() } }
      );

      const transitions = transitionsRes.data as { transitions: Array<{ id: string; name: string }> };
      const target = transitions.transitions.find(t => t.name === targetStatus)
        ?? transitions.transitions.find(t => t.name === jiraConfig.statuses.done);

      if (!target) {
        console.warn(chalk.yellow(`[ReporterAgent] Transition "${targetStatus}" not found`));
        return;
      }

      await axios.post(
        `${jiraConfig.baseUrl}/rest/api/3/issue/${ticketKey}/transitions`,
        { transition: { id: target.id } },
        {
          headers: {
            Authorization: jiraAuthHeader(),
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(chalk.green(`[ReporterAgent] Jira status → ${target.name}`));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn(chalk.yellow(`[ReporterAgent] Jira transition failed: ${error.response?.status}`));
      }
    }
  }

  // ------------------------------------------------------------------
  // Slack notification
  // ------------------------------------------------------------------

  async notifySlack(
    run: QIARun,
    pr: PullRequestInfo | null,
    executionResults: TestExecutionResult[]
  ): Promise<void> {
    const slackToken = process.env['SLACK_BOT_TOKEN'];
    const channelId = process.env['SLACK_CHANNEL_ID'];
    if (!slackToken || !channelId) return;

    console.log(chalk.cyan('\n[ReporterAgent] Sending Slack notification...'));

    const totalPassed = executionResults.reduce((s, r) => s + r.passed, 0);
    const totalFailed = executionResults.reduce((s, r) => s + r.failed, 0);

    const text = [
      `*QIA: ${run.ticketKey}* ${totalFailed === 0 ? '✅' : '❌'}`,
      `> ${totalPassed} passed, ${totalFailed} failed`,
      pr ? `> PR: ${pr.url}` : '',
      `> Allure: allure-report/index.html`,
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

  // ------------------------------------------------------------------
  // Final summary printed to stdout
  // ------------------------------------------------------------------

  printFinalSummary(run: QIARun, pr: PullRequestInfo | null, executionResults: TestExecutionResult[]): void {
    const totalPassed = executionResults.reduce((s, r) => s + r.passed, 0);
    const totalFailed = executionResults.reduce((s, r) => s + r.failed, 0);
    const totalSkipped = executionResults.reduce((s, r) => s + r.skipped, 0);
    const durationMs = executionResults.reduce((s, r) => s + r.durationMs, 0);
    const allPassed = totalFailed === 0 && (totalPassed + totalFailed + totalSkipped) > 0;
    const runDuration = run.completedAt
      ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
      : 0;

    const border = allPassed ? chalk.bold.green : chalk.bold.red;
    console.log(border(`\n${'═'.repeat(60)}`));
    console.log(border(`  QIA RUN ${allPassed ? 'COMPLETE ✅' : 'COMPLETE WITH FAILURES ❌'}`));
    console.log(border(`${'═'.repeat(60)}`));
    console.log(chalk.white(`  Ticket:       ${run.ticketKey}`));
    console.log(chalk.white(`  Tests:        ${run.generatedTests.length} file(s)`));
    console.log(chalk.green(`  Passed:       ${totalPassed}`));
    if (totalFailed > 0) console.log(chalk.red(`  Failed:       ${totalFailed}`));
    if (totalSkipped > 0) console.log(chalk.yellow(`  Skipped:      ${totalSkipped}`));
    console.log(chalk.white(`  Test time:    ${Math.round(durationMs / 1000)}s`));
    console.log(chalk.white(`  Total time:   ${runDuration}s`));
    console.log(chalk.white(`  Gates:        ${run.gates.filter(g => g.decision === 'approved').length}/3 approved`));
    console.log(chalk.white(`  Jira:         ${run.jiraUpdated ? '✓ Updated' : '✗ Not updated'}`));
    console.log(chalk.white(`  Allure:       allure-report/index.html`));
    console.log(pr
      ? chalk.white(`  PR:           ${pr.url}`)
      : chalk.gray(`  PR:           Not created`)
    );
    console.log(border(`${'═'.repeat(60)}\n`));
  }

  // ------------------------------------------------------------------
  // ADF helpers
  // ------------------------------------------------------------------

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
