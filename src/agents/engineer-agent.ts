// ============================================================
// QIA — Engineer Agent
// Generates production-grade Playwright tests matching team DNA
// Rules enforced:
//   - Test files NEVER prefixed with ticket ID
//   - Full-page screenshot on every failure → test-results/screenshots/
//   - Console errors captured in beforeEach, written to evidence JSON
//   - Network requests captured and written to evidence JSON
//   - DOM snapshot on failure written to evidence JSON
//   - Tests output to src/framework/tests/ui/
// ============================================================

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import type { TestStrategy, FrameworkDNA, GeneratedTest, TestSuite, TestType } from '../types/index.js';

// Evidence capture boilerplate injected into every generated UI test
const EVIDENCE_CAPTURE_BOILERPLATE = `
// ── QIA Evidence Capture ─────────────────────────────────────
import fs from 'fs';
import path from 'path';

const _consoleErrors: string[] = [];
const _networkLog: Array<{ method: string; url: string; status?: number; responseTime?: number }> = [];

test.beforeEach(async ({ page }) => {
  _consoleErrors.length = 0;
  _networkLog.length = 0;

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      _consoleErrors.push(\`[\${msg.type().toUpperCase()}] \${msg.text()}\`);
    }
  });

  const _reqTimestamps = new Map<string, number>();
  page.on('request', (req) => {
    _reqTimestamps.set(req.url(), Date.now());
    _networkLog.push({ method: req.method(), url: req.url() });
  });

  page.on('response', (res) => {
    const start = _reqTimestamps.get(res.url());
    let found = false;
    for (let i = _networkLog.length - 1; i >= 0; i--) {
      const entry = _networkLog[i];
      if (entry && entry.url === res.url() && entry.status === undefined) {
        entry.status = res.status();
        entry.responseTime = start !== undefined ? Date.now() - start : 0;
        found = true;
        break;
      }
    }
    if (!found) { /* no matching request entry */ }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'failed') return;

  const testSlug = testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Full-page screenshot
  const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, \`\${testSlug}.png\`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('full-page-screenshot', { path: screenshotPath, contentType: 'image/png' });
  } catch { /* page may be closed */ }

  // DOM snapshot
  let domSnapshot = '';
  try { domSnapshot = (await page.content()).slice(0, 8000); } catch { /* page may be closed */ }

  // Write evidence JSON
  const evidenceDir = path.join(process.cwd(), 'test-results', 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, \`\${testSlug}.json\`),
    JSON.stringify({
      testName: testInfo.title,
      testSlug,
      screenshotPath,
      consoleErrors: [..._consoleErrors],
      networkRequests: [..._networkLog],
      domSnapshot,
    }, null, 2)
  );
});
// ── End QIA Evidence Capture ─────────────────────────────────
`;

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
        {
          role: 'system',
          content: 'You are a Senior QA Engineer. Write complete, runnable TypeScript Playwright test code. Return only the code, no explanations.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    let code = this.extractCode(text);

    // Inject evidence capture boilerplate for UI tests
    if (suite.type === 'ui') {
      code = this.injectEvidenceCapture(code);
    }

    // Enforce: file must not be prefixed with ticket key
    const safePath = this.enforceNamingRules(suite.filePath, ticketKey);
    this.writeTestFile(safePath, code);

    return {
      filePath: safePath,
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
- Page objects: ${dna.pageObjectPattern.usesPageObjects ? 'YES — use inline page object pattern' : 'NO — direct page calls'}

TEST SUITE:
Type: ${suite.type}
Ticket: ${ticketKey}
File: ${suite.filePath}
Scenarios: ${scenariosJson}

RULES:
1. Match team style EXACTLY — same quotes, semicolons, indent
2. Use self-healing locator comments: // [TIER1: testid] [TIER2: role] [TIER3: fallback]
3. Add Allure annotations as JSDoc comments: @feature, @story, @severity
4. Use data-test or data-testid as primary locators where possible
5. Add @${ticketKey} tag to all tests
6. Generate comprehensive assertions — don't just click, VERIFY
7. ${this.typeSpecificRules(suite.type)}
8. CRITICAL: Do NOT import from external page object files. Write SELF-CONTAINED tests. If you need a page object, define an inline class WITHIN the same file.
9. Only import from '@playwright/test' plus Node.js built-ins (fs, path) — no local module imports.
10. Tests must be runnable without any external dependencies.
11. FILE NAMING: The file has already been named for you. Do NOT use the Jira ticket key as a prefix in the file. Use only the descriptive portion.
12. SCREENSHOT ON FAILURE: Do NOT add your own screenshot/afterEach — QIA injects this automatically.
13. Write the import statement as: import { test, expect } from '@playwright/test';
    The evidence capture code (fs, path, beforeEach, afterEach) will be injected by QIA automatically.
    Do NOT write your own beforeEach/afterEach for screenshots.
14. NAVIGATION: ALWAYS use relative paths with the Playwright baseURL. Use page.goto('/') or page.goto('/login') etc.
    NEVER hardcode full URLs like 'https://example.com'. The baseURL is already set in playwright.config.ts.
    For SauceDemo use: page.goto('/') — the base URL is https://www.saucedemo.com
    For login flows: page.goto('/') navigates to the login page on saucedemo.com
15. SAUCEDEMO LOCATORS: On saucedemo.com, use these exact selectors:
    - Username: [data-test="username"]
    - Password: [data-test="password"]
    - Login button: [data-test="login-button"]
    - Error message: [data-test="error"]          ← single correct selector
    - Locked out user: 'locked_out_user' / any password
    - Valid credentials: 'standard_user' / 'secret_sauce'
    IMPORTANT: NEVER use [data-test="error-message-container"] — it does not exist on the page.
    The ONLY error locator is [data-test="error"].

Generate COMPLETE, RUNNABLE TypeScript code only. No markdown, no explanation.`;
  }

  private typeSpecificRules(type: TestType): string {
    const rules: Record<TestType, string> = {
      ui: 'Test all happy paths + edge cases + error states + negative cases',
      api: 'Use APIRequestContext, validate status codes + response schemas + headers',
      visual: 'Take screenshots at all 4 viewports: desktop/laptop/tablet/mobile',
      security: 'Test XSS, SQLi patterns in inputs, auth boundaries, sensitive data exposure',
      performance: 'Measure page load time using performance.now() and web vitals',
      accessibility: 'Check ARIA roles, keyboard navigation, color contrast, screen reader text',
    };
    return rules[type] ?? 'Thorough coverage of all scenarios';
  }

  /**
   * Inject QIA evidence capture code after the import statement block.
   * We find the last `import` statement and insert the boilerplate after it.
   */
  private injectEvidenceCapture(code: string): string {
    // Find the end of import statements
    const lines = code.split('\n');
    let lastImportLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.trim().startsWith('import ') || line.trim().startsWith('import{')) {
        lastImportLine = i;
      }
    }

    // Insert boilerplate after last import
    const before = lines.slice(0, lastImportLine + 1).join('\n');
    const after = lines.slice(lastImportLine + 1).join('\n');

    return `${before}\n${EVIDENCE_CAPTURE_BOILERPLATE}\n${after}`;
  }

  /**
   * Ensure the file path doesn't start with the ticket key.
   */
  private enforceNamingRules(filePath: string, ticketKey: string): string {
    const dir = path.dirname(filePath);
    let base = path.basename(filePath);
    const ticketLower = ticketKey.toLowerCase();

    if (base.toLowerCase().startsWith(ticketLower)) {
      base = base.slice(ticketLower.length).replace(/^[-_]/, '') || 'tests.spec.ts';
    }

    return path.join(dir, base);
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
