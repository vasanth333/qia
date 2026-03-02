import { test, expect } from '@playwright/test';

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
      _consoleErrors.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
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
  const screenshotPath = path.join(screenshotDir, `${testSlug}.png`);
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
    path.join(evidenceDir, `${testSlug}.json`),
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


class SauceDemoPage {
  constructor(private page: any) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  get usernameField() {
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    return this.page.locator('[data-test="username"]');
  }

  get passwordField() {
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    return this.page.locator('[data-test="password"]');
  }

  get loginButton() {
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    return this.page.locator('[data-test="login-button"]');
  }
}

test.describe('Login Form Visibility Tests', () => {
  test('@smoke @SCRUM-14 @critical @TC-002 Verify login form is visible with username and password fields', async ({ page }) => {
    /** 
     * @feature Login
     * @story SCRUM-14
     * @severity critical
     */

    const saucedemo = new SauceDemoPage(page);

    // Given the user is on the SauceDemo homepage
    await saucedemo.goto();

    // Then the login form with username and password fields should be visible
    await expect(saucedemo.usernameField).toBeVisible();
    await expect(saucedemo.passwordField).toBeVisible();
    await expect(saucedemo.loginButton).toBeVisible();
  });
});
