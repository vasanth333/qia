// ============================================================
// QIA — Healer Agent
// 3-Tier Self-Healing Locator Engine
// Tier 1: data-testid | Tier 2: Semantic (role/text) | Tier 3: AI
// ============================================================

import fs from 'fs';
import OpenAI from 'openai';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import { ExecutorAgent } from './executor-agent.js';
import type { HealResult, HealingReport, FrameworkDNA, GeneratedTest, TestExecutionResult } from '../types/index.js';

export class HealerAgent {
  private readonly openai: OpenAI;
  private readonly dna: FrameworkDNA;

  constructor(dna: FrameworkDNA) {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
    this.dna = dna;
  }

  /**
   * Heals locators in a test file, re-runs, loops up to maxAttempts times.
   * Returns the final TestExecutionResult after healing loop.
   */
  async healAndRerun(
    generatedTest: GeneratedTest,
    initialResult: TestExecutionResult,
    projectRoot: string = process.cwd()
  ): Promise<TestExecutionResult> {
    const executor = new ExecutorAgent(projectRoot);
    let current = initialResult;
    let attempt = 0;
    const maxAttempts = agentConfig.maxHealAttempts;

    while (current.failed > 0 && attempt < maxAttempts) {
      attempt++;
      console.log(chalk.yellow(`\n[HealerAgent] Heal attempt ${attempt}/${maxAttempts} for: ${generatedTest.filePath}`));

      await this.healFile(generatedTest.filePath);

      console.log(chalk.cyan(`[HealerAgent] Re-running after heal...`));
      current = await executor.executeTest(generatedTest);
      current.healAttempts = attempt;

      if (current.failed === 0) {
        console.log(chalk.green(`[HealerAgent] All tests passing after ${attempt} heal attempt(s)`));
        break;
      }
    }

    current.ultimatelyPassed = current.failed === 0;
    return current;
  }

  async healFile(filePath: string): Promise<HealingReport> {
    console.log(chalk.cyan(`\n[HealerAgent] Scanning for broken locators: ${filePath}`));

    const content = fs.readFileSync(filePath, 'utf-8');
    const brokenLocators = this.detectBrokenLocators(content);

    if (brokenLocators.length === 0) {
      console.log(chalk.green('[HealerAgent] No broken locators detected'));
      return { totalLocators: 0, healed: 0, failed: 0, results: [] };
    }

    console.log(chalk.yellow(`[HealerAgent] Found ${brokenLocators.length} locators to heal`));

    const results: HealResult[] = [];
    let healedContent = content;

    for (const locator of brokenLocators) {
      const result = await this.healLocator(locator, healedContent);
      results.push(result);

      if (result.success) {
        healedContent = healedContent.replace(locator, result.healed);
        console.log(chalk.green(`  [HEALED-T${result.tier === 'testid' ? 1 : result.tier === 'semantic' ? 2 : 3}] ${locator} → ${result.healed}`));
      } else {
        console.log(chalk.red(`  [FAILED] Could not heal: ${locator}`));
      }
    }

    if (healedContent !== content) {
      fs.writeFileSync(filePath, healedContent);
    }

    const report: HealingReport = {
      totalLocators: brokenLocators.length,
      healed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };

    this.printReport(report);
    return report;
  }

  private async healLocator(broken: string, context: string): Promise<HealResult> {
    const tier1 = this.healTier1(broken);
    if (tier1) {
      return { original: broken, healed: tier1, tier: 'testid', confidence: 0.95, attempts: 1, success: true };
    }

    const tier2 = this.healTier2(broken);
    if (tier2) {
      return { original: broken, healed: tier2, tier: 'semantic', confidence: 0.80, attempts: 2, success: true };
    }

    const tier3 = await this.healTier3(broken, context);
    return { original: broken, healed: tier3 ?? broken, tier: 'ai', confidence: tier3 ? 0.65 : 0, attempts: 3, success: !!tier3 };
  }

  private healTier1(locator: string): string | null {
    const cssMatch = locator.match(/\.([a-zA-Z][\w-]*)/);
    const xpathMatch = locator.match(/@id=['"]([^'"]+)['"]/);
    if (cssMatch?.[1]) return `page.getByTestId('${cssMatch[1].toLowerCase().replace(/-/g, '_')}')`;
    if (xpathMatch?.[1]) return `page.getByTestId('${xpathMatch[1]}')`;
    return null;
  }

  private healTier2(locator: string): string | null {
    const textMatch = locator.match(/['"]([^'"]{3,40})['"]/);
    const text = textMatch?.[1];
    if (!text) return null;
    if (/button|btn|submit|cancel/i.test(locator)) return `page.getByRole('button', { name: '${text}' })`;
    if (/input|field|email|password/i.test(locator)) return `page.getByLabel('${text}')`;
    if (/link|anchor/i.test(locator)) return `page.getByRole('link', { name: '${text}' })`;
    if (/heading|title|h[1-6]/i.test(locator)) return `page.getByRole('heading', { name: '${text}' })`;
    return `page.getByText('${text}', { exact: true })`;
  }

  private async healTier3(broken: string, context: string): Promise<string | null> {
    const surrounding = this.extractContext(broken, context, 5);

    const response = await this.openai.chat.completions.create({
      model: agentConfig.openaiModel,
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: `You are a Playwright locator healing expert.
BROKEN LOCATOR: ${broken}
CONTEXT: ${surrounding}
TEAM STRATEGY: preferred=${this.dna.locatorStrategy.preferred}, testIdAttr=${this.dna.locatorStrategy.testIdAttribute}

Return ONLY the healed locator expression. Example: page.getByRole('button', { name: 'Submit' })`,
      }],
    });

    const text = (response.choices[0]?.message?.content ?? '').trim();
    if (text.startsWith('page.') && text.length < 200) return text;
    return null;
  }

  private detectBrokenLocators(content: string): string[] {
    const broken: string[] = [];
    const patterns = [
      /page\.locator\(['"]\.[\w-]+['"]\)/g,
      /page\.locator\(['"]#[\w-]+['"]\)/g,
      /page\.locator\(['"]\/\/[^'"]+['"]\)/g,
    ];
    for (const pattern of patterns) {
      broken.push(...(content.match(pattern) ?? []));
    }
    return [...new Set(broken)];
  }

  private extractContext(target: string, content: string, lines: number): string {
    const idx = content.indexOf(target);
    if (idx === -1) return '';
    const start = Math.max(0, idx - lines * 80);
    const end = Math.min(content.length, idx + target.length + lines * 80);
    return content.slice(start, end);
  }

  private printReport(report: HealingReport): void {
    console.log(chalk.gray(`\n  Healing: ${report.healed}/${report.totalLocators} fixed, ${report.failed} failed`));
  }
}
