// ============================================================
// QIA — Quality Intelligence Agent — Core Types
// ============================================================

import { z } from 'zod';

// ------------------------------------------------------------
// Jira
// ------------------------------------------------------------
export interface JiraTicket {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  issueType: string;
  labels: string[];
  components: string[];
  assignee: string | null;
  reporter: string;
  status: string;
  linkedIssues: string[];
  attachments: JiraAttachment[];
}

export interface JiraAttachment {
  filename: string;
  content: string;
  mimeType: string;
}

// ------------------------------------------------------------
// Framework DNA
// ------------------------------------------------------------
export interface FrameworkDNA {
  projectName: string;
  scannedAt: string;
  language: 'typescript' | 'javascript';
  testFramework: string;
  playwrightVersion: string;
  baseUrl: string;
  pageObjectPattern: PageObjectPattern;
  namingConventions: NamingConventions;
  locatorStrategy: LocatorStrategy;
  fixturePatterns: FixturePattern[];
  apiClientPattern: ApiClientPattern | null;
  existingHelpers: string[];
  testTags: string[];
  existingTests: TestInventory[];
  importPaths: Record<string, string>;
  codingStyle: CodingStyle;
}

export interface PageObjectPattern {
  usesPageObjects: boolean;
  baseClass: string | null;
  filePattern: string;
  methodStyle: 'async' | 'sync' | 'mixed';
  constructorPattern: string;
}

export interface NamingConventions {
  testFiles: string;
  pageFiles: string;
  helperFiles: string;
  fixtureFiles: string;
  describeBlocks: string;
  testNames: string;
  variables: 'camelCase' | 'snake_case' | 'PascalCase';
  constants: 'UPPER_SNAKE' | 'camelCase';
}

export interface LocatorStrategy {
  preferred: 'testid' | 'role' | 'text' | 'css' | 'xpath';
  testIdAttribute: string;
  fallbacks: string[];
}

export interface FixturePattern {
  name: string;
  scope: 'test' | 'worker';
  filePath: string;
}

export interface ApiClientPattern {
  baseClass: string | null;
  authStyle: 'header' | 'cookie' | 'bearer' | 'none';
  filePath: string;
}

export interface TestInventory {
  filePath: string;
  testCount: number;
  tags: string[];
  type: TestType;
}

export interface CodingStyle {
  usesStrictMode: boolean;
  usesESModules: boolean;
  quotStyle: 'single' | 'double';
  trailingComma: boolean;
  semicolons: boolean;
  indentSize: number;
}

// ------------------------------------------------------------
// Test Strategy
// ------------------------------------------------------------
export interface TestStrategy {
  ticketKey: string;
  reasoning: string;
  testSuites: TestSuite[];
  estimatedCount: number;
  riskAreas: string[];
  coverageGoal: string;
  executionOrder: TestType[];
}

export type TestType = 'ui' | 'api' | 'visual' | 'security' | 'performance' | 'accessibility';

export interface TestSuite {
  type: TestType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  scenarios: TestScenario[];
  filePath: string;
  reasoning: string;
}

export interface TestScenario {
  id: string;
  name: string;
  steps: string[];
  expectedResult: string;
  tags: string[];
  severity: 'blocker' | 'critical' | 'normal' | 'minor' | 'trivial';
  dataVariants: TestDataVariant[];
}

export interface TestDataVariant {
  name: string;
  data: Record<string, unknown>;
}

// ------------------------------------------------------------
// Generated Tests
// ------------------------------------------------------------
export interface GeneratedTest {
  filePath: string;
  content: string;
  type: TestType;
  scenarioCount: number;
  tags: string[];
}

// ------------------------------------------------------------
// Visual Regression
// ------------------------------------------------------------
export interface VisualComparison {
  name: string;
  viewport: Viewport;
  baselinePath: string;
  currentPath: string;
  diffPath: string | null;
  diffPercentage: number;
  passed: boolean;
  aiAnalysis: string | null;
}

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORTS: Viewport[] = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

// ------------------------------------------------------------
// Self-Healing
// ------------------------------------------------------------
export type LocatorTier = 'testid' | 'semantic' | 'ai';

export interface HealResult {
  original: string;
  healed: string;
  tier: LocatorTier;
  confidence: number;
  attempts: number;
  success: boolean;
}

export interface HealingReport {
  totalLocators: number;
  healed: number;
  failed: number;
  results: HealResult[];
}

// ------------------------------------------------------------
// Human Gates
// ------------------------------------------------------------
export type GateNumber = 1 | 2 | 3;

export interface GateContext {
  gate: GateNumber;
  title: string;
  description: string;
  artifacts: GateArtifact[];
  requiresApproval: boolean;
  timeoutMinutes: number;
}

export interface GateArtifact {
  label: string;
  value: string;
  type: 'text' | 'file' | 'url' | 'code';
}

export type GateDecision = 'approved' | 'rejected' | 'timeout';

export interface GateResult {
  gate: GateNumber;
  decision: GateDecision;
  approvedBy: string;
  timestamp: string;
  notes: string;
}

// ------------------------------------------------------------
// Git / PR
// ------------------------------------------------------------
export interface PullRequestInfo {
  number: number;
  url: string;
  branch: string;
  title: string;
  sha: string;
}

// ------------------------------------------------------------
// Allure / Reporting
// ------------------------------------------------------------
export interface AllureTag {
  feature: string;
  story: string;
  severity: string;
  owner: string;
  issue: string;
  testCaseId: string;
}

// ------------------------------------------------------------
// QIA Run
// ------------------------------------------------------------
export interface QIARun {
  id: string;
  ticketKey: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'awaiting_gate' | 'completed' | 'failed' | 'cancelled';
  phases: PhaseResult[];
  gates: GateResult[];
  generatedTests: GeneratedTest[];
  pullRequest: PullRequestInfo | null;
  jiraUpdated: boolean;
}

export interface PhaseResult {
  phase: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  output: unknown;
  error: string | null;
}

// ------------------------------------------------------------
// Agent Config
// ------------------------------------------------------------
export const AgentConfigSchema = z.object({
  openaiApiKey: z.string().min(1),
  openaiModel: z.string().default('gpt-4o'),
  jiraBaseUrl: z.string().url(),
  jiraEmail: z.string().email(),
  jiraApiToken: z.string().min(1),
  githubToken: z.string().min(1),
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
  baseUrl: z.string().url(),
  autoApproveGates: z.boolean().default(false),
  gateTimeoutMinutes: z.number().default(30),
  maxHealAttempts: z.number().default(3),
  visualThreshold: z.number().default(0.1),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
