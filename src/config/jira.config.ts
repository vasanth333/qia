// ============================================================
// QIA — Jira Configuration
// ============================================================

import dotenv from 'dotenv';

dotenv.config();

export const jiraConfig = {
  baseUrl: process.env['JIRA_BASE_URL'] ?? '',
  email: process.env['JIRA_EMAIL'] ?? '',
  apiToken: process.env['JIRA_API_TOKEN'] ?? '',
  projectKey: process.env['JIRA_PROJECT_KEY'] ?? 'QIA',
  statuses: {
    inProgress: process.env['JIRA_IN_PROGRESS_STATUS'] ?? 'In Progress',
    inReview: 'In Review',
    done: process.env['JIRA_DONE_STATUS'] ?? 'Done',
  },
  fields: {
    acceptanceCriteria: process.env['JIRA_AC_FIELD'] ?? 'customfield_10014',
    storyPoints: 'customfield_10016',
  },
} as const;

export function jiraAuthHeader(): string {
  const token = Buffer.from(`${jiraConfig.email}:${jiraConfig.apiToken}`).toString('base64');
  return `Basic ${token}`;
}
