// Root-level Playwright config — used by ExecutorAgent and npx playwright test
// Delegates to src/config/playwright.config.ts

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const isCI = process.env['CI'] === 'true';

export default defineConfig({
  testDir: './src/framework/tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', {
      detail: true,
      outputFolder: process.env['ALLURE_RESULTS_DIR'] ?? 'allure-results',
      suiteTitle: true,
    }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env['BASE_URL'] ?? 'https://www.saucedemo.com',
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'off',
    testIdAttribute: 'data-testid',
  },
  projects: [
    {
      name: 'ui',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results',
  snapshotDir: path.join(process.env['QIA_BASELINE_DIR'] ?? '.qia/baselines'),
  timeout: parseInt(process.env['PLAYWRIGHT_TIMEOUT'] ?? '30000', 10),
});
