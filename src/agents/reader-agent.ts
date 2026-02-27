// ============================================================
// QIA — Reader Agent
// Fetches Jira ticket and extracts structured requirements
// ============================================================

import OpenAI from 'openai';
import axios from 'axios';
import chalk from 'chalk';
import { agentConfig } from '../config/agent.config.js';
import { jiraConfig, jiraAuthHeader } from '../config/jira.config.js';
import type { JiraTicket } from '../types/index.js';

export class ReaderAgent {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: agentConfig.openaiApiKey });
  }

  async readTicket(ticketKey: string): Promise<JiraTicket> {
    console.log(chalk.cyan(`\n[ReaderAgent] Fetching Jira ticket: ${ticketKey}`));

    const raw = await this.fetchJiraTicket(ticketKey);
    const ticket = await this.extractStructuredTicket(raw);

    console.log(chalk.green(`[ReaderAgent] Ticket parsed: "${ticket.summary}"`));
    console.log(chalk.gray(`  Priority: ${ticket.priority} | Type: ${ticket.issueType}`));
    console.log(chalk.gray(`  Acceptance Criteria: ${ticket.acceptanceCriteria.length} items`));

    return ticket;
  }

  private async fetchJiraTicket(ticketKey: string): Promise<Record<string, unknown>> {
    const url = `${jiraConfig.baseUrl}/rest/api/3/issue/${ticketKey}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: jiraAuthHeader(),
          Accept: 'application/json',
        },
      });
      return response.data as Record<string, unknown>;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to fetch Jira ticket ${ticketKey}: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  private async extractStructuredTicket(raw: Record<string, unknown>): Promise<JiraTicket> {
    const fields = raw['fields'] as Record<string, unknown>;
    const key = raw['key'] as string;

    const descriptionText = this.extractTextFromAdf(fields['description']);
    const acText = this.extractTextFromAdf(fields[jiraConfig.fields.acceptanceCriteria]);

    const prompt = `You are a QA Requirements Analyst. Extract structured test requirements from this Jira ticket.

TICKET KEY: ${key}
SUMMARY: ${fields['summary']}
DESCRIPTION:
${descriptionText}

ACCEPTANCE CRITERIA:
${acText}

Extract and return a JSON object with:
- acceptanceCriteria: string[] (each criterion as a separate testable statement)
- riskAreas: string[] (potential risk areas identified)
- testableFeatures: string[] (specific features to test)
- userJourney: string (brief description of the user's flow)

Return ONLY valid JSON, no explanation.`;

    const response = await this.openai.chat.completions.create({
      model: agentConfig.openaiModel,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    let extracted: { acceptanceCriteria: string[]; riskAreas: string[] } = {
      acceptanceCriteria: [],
      riskAreas: [],
    };

    try {
      const text = response.choices[0]?.message?.content ?? '{}';
      extracted = JSON.parse(text) as typeof extracted;
    } catch {
      if (acText) {
        extracted.acceptanceCriteria = acText.split('\n').filter(l => l.trim().length > 0);
      }
    }

    const priority = this.mapPriority(
      (fields['priority'] as Record<string, string> | null)?.['name'] ?? 'Medium'
    );

    return {
      key,
      summary: (fields['summary'] as string) ?? '',
      description: descriptionText,
      acceptanceCriteria: extracted.acceptanceCriteria,
      priority,
      issueType: (fields['issuetype'] as Record<string, string> | null)?.['name'] ?? 'Story',
      labels: (fields['labels'] as string[]) ?? [],
      components: ((fields['components'] as Array<Record<string, string>>) ?? []).map(c => c['name'] ?? ''),
      assignee: (fields['assignee'] as Record<string, string> | null)?.['displayName'] ?? null,
      reporter: (fields['reporter'] as Record<string, string> | null)?.['displayName'] ?? '',
      status: (fields['status'] as Record<string, string> | null)?.['name'] ?? '',
      linkedIssues: [],
      attachments: [],
    };
  }

  private extractTextFromAdf(adf: unknown): string {
    if (!adf || typeof adf !== 'object') return '';
    const doc = adf as Record<string, unknown>;
    const lines: string[] = [];

    function walk(node: Record<string, unknown>): void {
      if (node['type'] === 'text' && typeof node['text'] === 'string') {
        lines.push(node['text']);
      }
      if (Array.isArray(node['content'])) {
        for (const child of node['content'] as Record<string, unknown>[]) {
          walk(child);
        }
        lines.push('\n');
      }
    }

    walk(doc);
    return lines.join('').trim();
  }

  private mapPriority(raw: string): JiraTicket['priority'] {
    const map: Record<string, JiraTicket['priority']> = {
      Highest: 'Highest',
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
      Lowest: 'Lowest',
    };
    return map[raw] ?? 'Medium';
  }
}
