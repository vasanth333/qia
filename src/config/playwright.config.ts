// ============================================================
// QIA — Playwright Configuration
// ============================================================

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const isCI = process.env['CI'] === 'true';

export default defineConfig({
  testDir: './src/framework/tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : parseInt(process.env['PLAYWRIGHT_RETRIES'] ?? '1', 10),
  workers: isCI ? 4 : parseInt(process.env['PLAYWRIGHT_WORKERS'] ?? '2', 10),
  reporter: [
    ['list'],
    ['allure-playwright', {
      detail: true,
      outputFolder: process.env['ALLURE_RESULTS_DIR'] ?? 'allure-results',
      suiteTitle: true,
      environmentInfo: {
        node_version: process.version,
        os: process.platform,
        base_url: process.env['BASE_URL'] ?? '',
      },
    }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
    headless: process.env['PLAYWRIGHT_HEADLESS'] !== 'false',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    testIdAttribute: 'data-testid',
  },
  projects: [
    {
      name: 'ui',
      testDir: './src/framework/tests/ui',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: './src/framework/tests/api',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual',
      testDir: './src/framework/tests/visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'security',
      testDir: './src/framework/tests/security',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testDir: './src/framework/tests/ui',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'tablet',
      testDir: './src/framework/tests/ui',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
  outputDir: 'test-results',
  snapshotDir: path.join(process.env['QIA_BASELINE_DIR'] ?? '.qia/baselines'),
  timeout: parseInt(process.env['PLAYWRIGHT_TIMEOUT'] ?? '30000', 10),
});
