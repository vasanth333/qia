// ============================================================
// QIA — Strategist Agent
// AI-powered test strategy reasoning engine
// ============================================================

import OpenAI from 'openai';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import type { JiraTicket, FrameworkDNA, TestStrategy, TestSuite, TestScenario, TestType } from '../types/index.js';

export class StrategistAgent {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
  }

  async buildStrategy(ticket: JiraTicket, dna: FrameworkDNA): Promise<TestStrategy> {
    console.log(chalk.cyan('\n[StrategistAgent] Building test strategy with AI reasoning...'));

    const strategy = await this.reason(ticket, dna);

    console.log(chalk.green(`[StrategistAgent] Strategy built: ${strategy.estimatedCount} tests planned`));
    console.log(chalk.gray(`  Test types: ${strategy.executionOrder.join(' → ')}`));
    console.log(chalk.gray(`  Risk areas: ${strategy.riskAreas.join(', ')}`));

    return strategy;
  }

  private async reason(ticket: JiraTicket, dna: FrameworkDNA): Promise<TestStrategy> {
    const prompt = `You are the World #1 QA Architect. Reason deeply about what tests to generate.

JIRA TICKET:
Key: ${ticket.key}
Summary: ${ticket.summary}
Type: ${ticket.issueType}
Priority: ${ticket.priority}
Description: ${ticket.description}

ACCEPTANCE CRITERIA:
${ticket.acceptanceCriteria.map((ac, i) => `${i + 1}. ${ac}`).join('\n')}

FRAMEWORK DNA:
- Language: ${dna.language}
- Page Objects: ${dna.pageObjectPattern.usesPageObjects}
- Locator preference: ${dna.locatorStrategy.preferred}
- Existing test count: ${dna.existingTests.length}
- Base URL: ${dna.baseUrl}

Think step by step. For EACH acceptance criterion, map it to specific test scenarios.
Consider all test types: ui, api, visual, security, performance, accessibility.
Only include test types that are actually relevant to this ticket.

FILE NAMING RULES (CRITICAL — follow exactly):
- NEVER include the ticket key in the filename
- Use descriptive names that describe what is being tested
- Examples:
  ✅ "login-negative.spec.ts"
  ✅ "checkout-validation.spec.ts"
  ✅ "registration-form.spec.ts"
  ❌ "scrum-13-login.spec.ts"  ← WRONG, never prefix with ticket ID
  ❌ "SCRUM-13-tests.spec.ts"  ← WRONG

Return JSON:
{
  "ticketKey": "${ticket.key}",
  "reasoning": "Your detailed reasoning (2-3 paragraphs)",
  "executionOrder": ["ui", "api"],
  "riskAreas": ["string"],
  "coverageGoal": "string",
  "estimatedCount": 0,
  "testSuites": [
    {
      "type": "ui",
      "priority": "critical",
      "filePath": "src/framework/tests/ui/login-negative.spec.ts",
      "reasoning": "Why this suite",
      "scenarios": [
        {
          "id": "TC-001",
          "name": "descriptive test name",
          "steps": ["Given...", "When...", "Then..."],
          "expectedResult": "string",
          "tags": ["@smoke", "@${ticket.key}"],
          "severity": "critical",
          "dataVariants": []
        }
      ]
    }
  ]
}`;

    const response = await this.openai.chat.completions.create({
      model: agentConfig.openaiModel,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: 'You are an expert QA architect. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(text) as Partial<TestStrategy>;
      return {
        ticketKey: ticket.key,
        reasoning: parsed.reasoning ?? 'AI reasoning not available',
        testSuites: (parsed.testSuites ?? []).map(s => this.normalizeTestSuite(s, ticket.key)),
        estimatedCount: parsed.estimatedCount ?? 0,
        riskAreas: parsed.riskAreas ?? [],
        coverageGoal: parsed.coverageGoal ?? '100% AC coverage',
        executionOrder: parsed.executionOrder ?? ['ui', 'api'],
      };
    } catch {
      console.warn(chalk.yellow('[StrategistAgent] JSON parse failed, using fallback strategy'));
      return this.fallbackStrategy(ticket);
    }
  }

  private normalizeTestSuite(suite: Partial<TestSuite>, ticketKey: string): TestSuite {
    let filePath = suite.filePath ?? 'src/framework/tests/ui/generated-tests.spec.ts';

    // Enforce naming rule: strip ticket key prefix if AI ignored the instructions
    const ticketLower = ticketKey.toLowerCase();
    const basename = filePath.split('/').pop() ?? '';
    if (basename.toLowerCase().startsWith(ticketLower)) {
      const stripped = basename.slice(ticketLower.length).replace(/^[-_]/, '');
      filePath = filePath.replace(basename, stripped || 'tests.spec.ts');
    }

    // Ensure tests go into the right directory based on type
    const type = (suite.type ?? 'ui') as TestType;
    if (!filePath.includes(`/tests/${type}/`)) {
      const base = filePath.split('/').pop() ?? 'tests.spec.ts';
      filePath = `src/framework/tests/${type}/${base}`;
    }

    return {
      type,
      priority: suite.priority ?? 'high',
      filePath,
      reasoning: suite.reasoning ?? '',
      scenarios: (suite.scenarios ?? []).map(s => this.normalizeScenario(s)),
    };
  }

  private normalizeScenario(scenario: Partial<TestScenario>): TestScenario {
    return {
      id: scenario.id ?? `TC-${Math.floor(Math.random() * 1000)}`,
      name: scenario.name ?? 'Unnamed scenario',
      steps: scenario.steps ?? [],
      expectedResult: scenario.expectedResult ?? '',
      tags: scenario.tags ?? [],
      severity: scenario.severity ?? 'normal',
      dataVariants: scenario.dataVariants ?? [],
    };
  }

  private fallbackStrategy(ticket: JiraTicket): TestStrategy {
    // Derive a descriptive filename from the ticket summary (no ticket key prefix)
    const descName = ticket.summary
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40)
      || 'tests';

    return {
      ticketKey: ticket.key,
      reasoning: `Generating basic UI test coverage for ${ticket.key}: ${ticket.summary}`,
      testSuites: [{
        type: 'ui',
        priority: 'high',
        filePath: `src/framework/tests/ui/${descName}.spec.ts`,
        reasoning: 'Default UI test suite',
        scenarios: ticket.acceptanceCriteria.map((ac, i) => ({
          id: `TC-${String(i + 1).padStart(3, '0')}`,
          name: ac.slice(0, 80),
          steps: ['Given the user is on the application', 'When the user interacts with the feature', `Then ${ac}`],
          expectedResult: ac,
          tags: [`@${ticket.key}`, '@regression'],
          severity: 'normal' as const,
          dataVariants: [],
        })),
      }],
      estimatedCount: ticket.acceptanceCriteria.length,
      riskAreas: ['Untested acceptance criteria'],
      coverageGoal: '100% AC coverage',
      executionOrder: ['ui'],
    };
  }
}
