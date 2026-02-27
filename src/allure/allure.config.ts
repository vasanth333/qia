// ============================================================
// QIA — Allure Configuration & Helpers
// ============================================================

import type { AllureTag, TestType } from '../types/index.js';

export const allureConfig = {
  resultsDir: process.env['ALLURE_RESULTS_DIR'] ?? 'allure-results',
  reportDir: process.env['ALLURE_REPORT_DIR'] ?? 'allure-report',
};

export function buildAllureTags(params: {
  type: TestType;
  ticketKey: string;
  scenarioId: string;
  severity: string;
  owner?: string;
}): AllureTag {
  return {
    feature: `[${params.type.toUpperCase()}] QIA Generated`,
    story: params.ticketKey,
    severity: params.severity,
    owner: params.owner ?? 'QIA Agent',
    issue: params.ticketKey,
    testCaseId: params.scenarioId,
  };
}

export const SEVERITY_MAP: Record<string, string> = {
  blocker: 'blocker',
  critical: 'critical',
  normal: 'normal',
  minor: 'minor',
  trivial: 'trivial',
};
