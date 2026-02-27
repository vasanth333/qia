// ============================================================
// QIA — Scanner Agent
// Deep-scans the entire Playwright framework to extract DNA
// ============================================================

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import OpenAI from 'openai';
import { agentConfig } from '../config/agent.config.js';
import type {
  FrameworkDNA,
  PageObjectPattern,
  NamingConventions,
  LocatorStrategy,
  FixturePattern,
  TestInventory,
  CodingStyle,
} from '../types/index.js';

const DNA_PATH = '.qia/dna-profile.json';
const SCAN_DEPTH = parseInt(process.env['QIA_FRAMEWORK_SCAN_DEPTH'] ?? '5', 10);

export class ScannerAgent {
  private readonly openai: OpenAI;
  private readonly projectRoot: string;

  constructor(projectRoot = process.cwd()) {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
    this.projectRoot = projectRoot;
  }

  async scan(forceRescan = false): Promise<FrameworkDNA> {
    console.log(chalk.cyan('\n[ScannerAgent] Starting framework scan...'));

    if (!forceRescan && fs.existsSync(DNA_PATH)) {
      const cached = JSON.parse(fs.readFileSync(DNA_PATH, 'utf-8')) as FrameworkDNA;
      const ageHours = (Date.now() - new Date(cached.scannedAt).getTime()) / 3_600_000;
      if (ageHours < 24) {
        console.log(chalk.gray(`[ScannerAgent] Using cached DNA profile (${ageHours.toFixed(1)}h old)`));
        return cached;
      }
    }

    const files = this.collectFiles(this.projectRoot, SCAN_DEPTH);
    console.log(chalk.gray(`[ScannerAgent] Found ${files.length} relevant files`));

    const dna = await this.analyzeDNA(files);
    this.saveDNA(dna);

    console.log(chalk.green('[ScannerAgent] Framework DNA extracted successfully'));
    this.printDNASummary(dna);

    return dna;
  }

  private collectFiles(dir: string, maxDepth: number, depth = 0): string[] {
    if (depth > maxDepth) return [];

    const results: string[] = [];
    const skip = new Set(['node_modules', 'dist', '.git', 'allure-results', 'allure-report', 'test-results', '.qia']);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectFiles(full, maxDepth, depth + 1));
      } else if (entry.isFile() && this.isRelevantFile(entry.name)) {
        results.push(full);
      }
    }

    return results;
  }

  private isRelevantFile(name: string): boolean {
    const ext = path.extname(name);
    if (!['.ts', '.js', '.json'].includes(ext)) return false;
    if (name === 'package-lock.json') return false;
    return true;
  }

  private async analyzeDNA(files: string[]): Promise<FrameworkDNA> {
    const samples = this.sampleFiles(files);
    const fileContents = samples.map(f => {
      try {
        return `\n--- FILE: ${path.relative(this.projectRoot, f)} ---\n${fs.readFileSync(f, 'utf-8').slice(0, 2000)}`;
      } catch {
        return '';
      }
    }).filter(Boolean).join('\n');

    const prompt = `You are a QA Architect analyzing a Playwright test framework. Extract the team's exact coding DNA.

CODEBASE SAMPLES:
${fileContents.slice(0, 30_000)}

Return a JSON object matching this exact structure:
{
  "projectName": "string",
  "language": "typescript",
  "testFramework": "playwright",
  "playwrightVersion": "string",
  "baseUrl": "string or empty",
  "pageObjectPattern": {
    "usesPageObjects": true,
    "baseClass": "string or null",
    "filePattern": "*.page.ts",
    "methodStyle": "async",
    "constructorPattern": "string"
  },
  "namingConventions": {
    "testFiles": "*.spec.ts",
    "pageFiles": "*.page.ts",
    "helperFiles": "*.helper.ts",
    "fixtureFiles": "*.fixture.ts",
    "describeBlocks": "string",
    "testNames": "string",
    "variables": "camelCase",
    "constants": "UPPER_SNAKE"
  },
  "locatorStrategy": {
    "preferred": "testid",
    "testIdAttribute": "data-testid",
    "fallbacks": ["role", "text", "css"]
  },
  "existingHelpers": [],
  "testTags": [],
  "importPaths": {},
  "codingStyle": {
    "usesStrictMode": true,
    "usesESModules": false,
    "quotStyle": "single",
    "trailingComma": true,
    "semicolons": true,
    "indentSize": 2
  }
}`;

    const response = await this.openai.chat.completions.create({
      model: agentConfig.openaiModel,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    let extracted: Partial<FrameworkDNA> = {};
    try {
      extracted = JSON.parse(text) as Partial<FrameworkDNA>;
    } catch {
      console.warn(chalk.yellow('[ScannerAgent] Could not parse AI response, using defaults'));
    }

    const testInventory = this.buildTestInventory(files);
    const fixtures = this.detectFixtures(files);

    return {
      projectName: extracted.projectName ?? path.basename(this.projectRoot),
      scannedAt: new Date().toISOString(),
      language: extracted.language ?? 'typescript',
      testFramework: 'playwright',
      playwrightVersion: this.detectPlaywrightVersion(),
      baseUrl: extracted.baseUrl ?? process.env['BASE_URL'] ?? '',
      pageObjectPattern: extracted.pageObjectPattern ?? this.defaultPageObjectPattern(),
      namingConventions: extracted.namingConventions ?? this.defaultNamingConventions(),
      locatorStrategy: extracted.locatorStrategy ?? this.defaultLocatorStrategy(),
      fixturePatterns: fixtures,
      apiClientPattern: null,
      existingHelpers: extracted.existingHelpers ?? [],
      testTags: extracted.testTags ?? [],
      existingTests: testInventory,
      importPaths: extracted.importPaths ?? {},
      codingStyle: extracted.codingStyle ?? this.defaultCodingStyle(),
    };
  }

  private sampleFiles(files: string[]): string[] {
    const priority = files.filter(f => /\.(spec|test|page|fixture|helper|client)\.(ts|js)$/.test(f));
    const rest = files.filter(f => !priority.includes(f));
    return [...priority.slice(0, 15), ...rest.slice(0, 10)];
  }

  private buildTestInventory(files: string[]): TestInventory[] {
    return files
      .filter(f => /\.(spec|test)\.(ts|js)$/.test(f))
      .map(f => {
        const content = (() => { try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; } })();
        const testCount = (content.match(/\btest\s*\(/g) ?? []).length;
        const tags = (content.match(/@[\w-]+/g) ?? []).map(t => t.slice(1));
        const type = f.includes('/api/') ? 'api' : f.includes('/visual/') ? 'visual' : 'ui';
        return { filePath: path.relative(this.projectRoot, f), testCount, tags: [...new Set(tags)], type };
      });
  }

  private detectFixtures(files: string[]): FixturePattern[] {
    return files
      .filter(f => /fixture/i.test(f) && /\.(ts|js)$/.test(f))
      .map(f => ({ name: path.basename(f, path.extname(f)), scope: 'test' as const, filePath: path.relative(this.projectRoot, f) }));
  }

  private detectPlaywrightVersion(): string {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf-8')) as Record<string, unknown>;
      const deps = { ...(pkg['dependencies'] as Record<string, string> ?? {}), ...(pkg['devDependencies'] as Record<string, string> ?? {}) };
      return deps['@playwright/test'] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private defaultPageObjectPattern(): PageObjectPattern {
    return { usesPageObjects: true, baseClass: null, filePattern: '*.page.ts', methodStyle: 'async', constructorPattern: 'constructor(private readonly page: Page)' };
  }

  private defaultNamingConventions(): NamingConventions {
    return { testFiles: '*.spec.ts', pageFiles: '*.page.ts', helperFiles: '*.helper.ts', fixtureFiles: '*.fixture.ts', describeBlocks: 'Feature / Scenario style', testNames: 'should do something style', variables: 'camelCase', constants: 'UPPER_SNAKE' };
  }

  private defaultLocatorStrategy(): LocatorStrategy {
    return { preferred: 'testid', testIdAttribute: 'data-testid', fallbacks: ['role', 'text', 'css'] };
  }

  private defaultCodingStyle(): CodingStyle {
    return { usesStrictMode: true, usesESModules: false, quotStyle: 'single', trailingComma: true, semicolons: true, indentSize: 2 };
  }

  private saveDNA(dna: FrameworkDNA): void {
    fs.mkdirSync('.qia', { recursive: true });
    fs.writeFileSync(DNA_PATH, JSON.stringify(dna, null, 2));
  }

  private printDNASummary(dna: FrameworkDNA): void {
    console.log(chalk.gray(`  Project: ${dna.projectName}`));
    console.log(chalk.gray(`  Language: ${dna.language}`));
    console.log(chalk.gray(`  Page Objects: ${dna.pageObjectPattern.usesPageObjects ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`  Locator preference: ${dna.locatorStrategy.preferred}`));
    console.log(chalk.gray(`  Existing tests: ${dna.existingTests.length} files`));
  }
}
