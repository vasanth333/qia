// ============================================================
// QIA — Engineer Agent
// Generates production-grade Playwright tests matching team DNA
// ============================================================

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import type { TestStrategy, FrameworkDNA, GeneratedTest, TestSuite, TestType } from '../types/index.js';

export class EngineerAgent {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
  }

  async generateTests(strategy: TestStrategy, dna: FrameworkDNA): Promise<GeneratedTest[]> {
    console.log(chalk.cyan(`\n[EngineerAgent] Generating ${strategy.estimatedCount} tests across ${strategy.testSuites.length} suites...`));

    const generated: GeneratedTest[] = [];

    for (const suite of strategy.testSuites) {
      console.log(chalk.gray(`  Generating ${suite.type} suite: ${path.basename(suite.filePath)}`));
      const test = await this.generateSuite(suite, dna, strategy.ticketKey);
      generated.push(test);
    }

    console.log(chalk.green(`[EngineerAgent] Generated ${generated.length} test files`));
    return generated;
  }

  private async generateSuite(suite: TestSuite, dna: FrameworkDNA, ticketKey: string): Promise<GeneratedTest> {
    const prompt = this.buildPrompt(suite, dna, ticketKey);

    const response = await this.openai.chat.completions.create({
      model: agentConfig.openaiModel,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: 'You are a Senior QA Engineer. Write complete, runnable TypeScript Playwright test code. Return only the code, no explanations.' },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    const code = this.extractCode(text);
    this.writeTestFile(suite.filePath, code);

    return {
      filePath: suite.filePath,
      content: code,
      type: suite.type,
      scenarioCount: suite.scenarios.length,
      tags: [...new Set(suite.scenarios.flatMap(s => s.tags))],
    };
  }

  private buildPrompt(suite: TestSuite, dna: FrameworkDNA, ticketKey: string): string {
    const scenariosJson = JSON.stringify(suite.scenarios, null, 2);
    const q = dna.codingStyle.quotStyle === 'single' ? "'" : '"';
    const semi = dna.codingStyle.semicolons ? ';' : '';

    return `Write production-grade Playwright tests matching the team's exact coding style.

TEAM CODING DNA:
- Language: ${dna.language} (strict mode: ${dna.codingStyle.usesStrictMode})
- Quote style: ${dna.codingStyle.quotStyle} (${q})
- Semicolons: ${dna.codingStyle.semicolons} (${semi})
- Indent: ${dna.codingStyle.indentSize} spaces
- Locator preference: ${dna.locatorStrategy.preferred} (attr: ${dna.locatorStrategy.testIdAttribute})
- Page objects: ${dna.pageObjectPattern.usesPageObjects ? 'YES — use page object pattern' : 'NO — direct page calls'}

TEST SUITE:
Type: ${suite.type}
Ticket: ${ticketKey}
File: ${suite.filePath}
Scenarios: ${scenariosJson}

RULES:
1. Match team style EXACTLY — same quotes, semicolons, indent
2. Use self-healing locator comments: // [TIER1: testid] [TIER2: role] [TIER3: fallback]
3. Add Allure annotations as JSDoc comments: @feature, @story, @severity
4. Use data-testid as primary locators
5. Add @${ticketKey} tag to all tests
6. Generate comprehensive assertions — don't just click, VERIFY
7. ${this.typeSpecificRules(suite.type)}

Generate COMPLETE, RUNNABLE TypeScript code only. No markdown, no explanation.`;
  }

  private typeSpecificRules(type: TestType): string {
    const rules: Record<TestType, string> = {
      ui: 'Test all happy paths + edge cases + error states',
      api: 'Use APIRequestContext, validate status codes + response schemas + headers',
      visual: 'Take screenshots at all 4 viewports: desktop/laptop/tablet/mobile',
      security: 'Test XSS, SQLi patterns in inputs, auth boundaries, sensitive data exposure',
      performance: 'Measure page load time using performance.now() and web vitals',
      accessibility: 'Check ARIA roles, keyboard navigation, color contrast, screen reader text',
    };
    return rules[type] ?? 'Thorough coverage of all scenarios';
  }

  private extractCode(text: string): string {
    const tsMatch = text.match(/```typescript\n([\s\S]*?)```/);
    if (tsMatch) return tsMatch[1] ?? '';
    const jsMatch = text.match(/```(?:js|javascript)?\n([\s\S]*?)```/);
    if (jsMatch) return jsMatch[1] ?? '';
    if (text.includes('import ') && text.includes('test(')) return text;
    return `// QIA: Generated test placeholder\nimport { test, expect } from '@playwright/test';\n\ntest('placeholder', async ({ page }) => {\n  // TODO: implement\n});\n`;
  }

  private writeTestFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
    console.log(chalk.gray(`  Written: ${filePath}`));
  }
}
