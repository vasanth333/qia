// ============================================================
// QIA — Agent Configuration Loader
// ============================================================

import dotenv from 'dotenv';
import { AgentConfigSchema, type AgentConfig } from '../types/index.js';

dotenv.config();

function loadConfig(): AgentConfig {
  const raw = {
    openaiApiKey: process.env['OPENAI_API_KEY'] ?? '',
    openaiModel: process.env['OPENAI_MODEL'] ?? 'gpt-4o',
    jiraBaseUrl: process.env['JIRA_BASE_URL'] ?? '',
    jiraEmail: process.env['JIRA_EMAIL'] ?? '',
    jiraApiToken: process.env['JIRA_API_TOKEN'] ?? '',
    githubToken: process.env['GITHUB_TOKEN'] ?? '',
    githubOwner: process.env['GITHUB_OWNER'] ?? '',
    githubRepo: process.env['GITHUB_REPO'] ?? '',
    baseUrl: process.env['BASE_URL'] ?? 'http://localhost:3000',
    autoApproveGates: process.env['QIA_AUTO_APPROVE_GATES'] === 'true',
    gateTimeoutMinutes: parseInt(process.env['QIA_GATE_TIMEOUT_MINUTES'] ?? '30', 10),
    maxHealAttempts: parseInt(process.env['QIA_MAX_HEAL_ATTEMPTS'] ?? '3', 10),
    visualThreshold: parseFloat(process.env['QIA_VISUAL_THRESHOLD'] ?? '0.1'),
  };

  const result = AgentConfigSchema.safeParse(raw);

  if (!result.success) {
    const missing = result.error.issues.map(i => i.path.join('.')).join(', ');
    throw new Error(`QIA config validation failed. Missing/invalid: ${missing}\nRun: cp .env.example .env`);
  }

  return result.data;
}

export const agentConfig: AgentConfig = loadConfig();
