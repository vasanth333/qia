// ============================================================
// QIA — RCA Agent (Root Cause Analysis)
// Auto-classifies test failures into one of:
//   UI Issue | Frontend Issue | Backend Issue | Data Issue | Environment Issue
// Captures technical evidence and posts structured report to Jira
// ============================================================

import OpenAI from 'openai';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import type {
  FailedTest,
  RCAResult,
  RCACategory,
  TestEvidence,
} from '../types/index.js';

export class RCAAgent {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
  }

  async analyze(failedTest: FailedTest, evidence: TestEvidence | null): Promise<RCAResult> {
    console.log(chalk.cyan(`\n[RCAAgent] Analyzing failure: "${failedTest.title}"`));

    const consoleErrors = evidence?.consoleErrors ?? failedTest.consoleErrors;
    const networkRequests = evidence?.networkRequests ?? failedTest.networkRequests;
    const screenshotPath = evidence?.screenshotPath ?? failedTest.fullPageScreenshotPath ?? failedTest.screenshotPath;

    const category = this.classifyIssue(failedTest, consoleErrors, networkRequests);
    console.log(chalk.yellow(`[RCAAgent] Category: ${category}`));

    const aiAnalysis = await this.getAIAnalysis(failedTest, consoleErrors, networkRequests, category);

    const result: RCAResult = {
      testName: failedTest.title,
      category,
      reason: aiAnalysis.reason,
      consoleErrors,
      apiLog: this.formatApiLog(networkRequests),
      suggestedFix: aiAnalysis.suggestedFix,
      assignTo: this.getAssignee(category),
      screenshotPath,
    };

    this.printRCA(result);
    return result;
  }

  /**
   * Rule-based classification (fast, no AI call).
   * Falls through to UI Issue as default.
   */
  private classifyIssue(
    failedTest: FailedTest,
    consoleErrors: string[],
    networkRequests: Array<{ method?: string; url?: string; status?: number; responseTime?: number }>
  ): RCACategory {
    const error = failedTest.error.toLowerCase();
    const consoleStr = consoleErrors.join(' ').toLowerCase();

    // Environment: connection errors, timeouts, SSL
    if (
      error.includes('net::err') ||
      error.includes('econnrefused') ||
      error.includes('ssl') ||
      error.includes('timeout') ||
      error.includes('navigation timeout') ||
      error.includes('page crashed')
    ) {
      return 'Environment Issue';
    }

    // Backend: API 4xx/5xx or slow responses (>3s)
    const hasApiError = networkRequests.some(
      r => (r.status !== undefined && r.status >= 400) ||
           (r.responseTime !== undefined && r.responseTime > 3000)
    );
    if (hasApiError) {
      return 'Backend Issue';
    }

    // Frontend: JS console errors
    if (
      consoleStr.includes('uncaught') ||
      consoleStr.includes('referenceerror') ||
      consoleStr.includes('typeerror') ||
      consoleStr.includes('syntaxerror') ||
      consoleErrors.length > 0
    ) {
      return 'Frontend Issue';
    }

    // Data: value mismatch — expected vs received
    if (
      (error.includes('expected') && (error.includes('received') || error.includes('to be') || error.includes('to equal'))) ||
      error.includes('wrong') ||
      error.includes('mismatch')
    ) {
      return 'Data Issue';
    }

    // Default: UI Issue (element not found, visibility, layout)
    return 'UI Issue';
  }

  private async getAIAnalysis(
    failedTest: FailedTest,
    consoleErrors: string[],
    networkRequests: Array<{ method?: string; url?: string; status?: number; responseTime?: number }>,
    category: RCACategory
  ): Promise<{ reason: string; suggestedFix: string }> {
    const prompt = `You are a QA Root Cause Analysis expert. Analyze this test failure and provide actionable insights.

TEST NAME: ${failedTest.title}
ERROR MESSAGE: ${failedTest.error.slice(0, 1000)}
CATEGORY: ${category}

CONSOLE ERRORS (${consoleErrors.length}):
${consoleErrors.slice(0, 5).join('\n') || 'None captured'}

API CALLS:
${networkRequests.slice(0, 10).map(r => `${r.method ?? 'GET'} ${r.url ?? ''} → ${r.status ?? '?'} (${r.responseTime ?? '?'}ms)`).join('\n') || 'None captured'}

Provide a JSON response with:
{
  "reason": "One sentence technical explanation of WHY this test failed",
  "suggestedFix": "One actionable sentence telling the developer exactly what to fix"
}

Be specific. Reference the actual error, element names, or API endpoints where possible.
Return ONLY valid JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: agentConfig.openaiModel,
        max_tokens: 512,
        messages: [
          { role: 'system', content: 'You are a QA expert. Return JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(text) as { reason?: string; suggestedFix?: string };
      return {
        reason: parsed.reason ?? this.defaultReason(failedTest, category),
        suggestedFix: parsed.suggestedFix ?? this.defaultFix(category),
      };
    } catch {
      return {
        reason: this.defaultReason(failedTest, category),
        suggestedFix: this.defaultFix(category),
      };
    }
  }

  private formatApiLog(
    requests: Array<{ method?: string; url?: string; status?: number; responseTime?: number }>
  ): string {
    if (requests.length === 0) return 'No API calls captured';
    return requests
      .slice(0, 8)
      .map(r => {
        const urlShort = (r.url ?? '').split('?')[0] ?? r.url ?? '';
        const status = r.status ?? '?';
        const time = r.responseTime !== undefined ? `${r.responseTime}ms` : '?ms';
        return `${r.method ?? 'GET'} ${urlShort} → ${status} (${time})`;
      })
      .join(', ');
  }

  private getAssignee(category: RCACategory): string {
    const map: Record<RCACategory, string> = {
      'UI Issue': 'QA Engineer',
      'Frontend Issue': 'Frontend Developer',
      'Backend Issue': 'Backend Developer',
      'Data Issue': 'QA Engineer / Data Team',
      'Environment Issue': 'DevOps / Environment Team',
    };
    return map[category];
  }

  private defaultReason(failedTest: FailedTest, category: RCACategory): string {
    const errorFirst = failedTest.error.split('\n')[0] ?? failedTest.error;
    return `${category} detected: ${errorFirst.slice(0, 200)}`;
  }

  private defaultFix(category: RCACategory): string {
    const fixes: Record<RCACategory, string> = {
      'UI Issue': 'Verify element locators and page structure match the current DOM',
      'Frontend Issue': 'Check browser console errors and fix JavaScript runtime issues',
      'Backend Issue': 'Investigate API response codes and server-side error logs',
      'Data Issue': 'Review test data and expected values against current application state',
      'Environment Issue': 'Check application availability, network connectivity, and SSL certificates',
    };
    return fixes[category];
  }

  private printRCA(result: RCAResult): void {
    console.log(chalk.bold(`\n  ╔═══ RCA: ${result.testName} ═══`));
    console.log(chalk.red(`  ❌ Category:  ${result.category}`));
    console.log(chalk.white(`  📋 Reason:    ${result.reason}`));
    console.log(chalk.yellow(`  💡 Fix:       ${result.suggestedFix}`));
    console.log(chalk.gray(`  👤 Assign to: ${result.assignTo}`));
    if (result.consoleErrors.length > 0) {
      console.log(chalk.gray(`  🌐 Console:   ${result.consoleErrors[0]}`));
    }
    if (result.apiLog !== 'No API calls captured') {
      console.log(chalk.gray(`  🔗 API:       ${result.apiLog.slice(0, 100)}`));
    }
    console.log(chalk.bold(`  ╚${'═'.repeat(40)}`));
  }
}
