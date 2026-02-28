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


class SauceDemoLoginPage {
  readonly page;
  constructor(page) {
    this.page = page;
  }
  async navigateTo() {
    await this.page.goto('/'); // Navigates to the login page.
  }
  async login(username: string, password: string) {
    await this.page.fill('[data-test="username"]', username); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.fill('[data-test="password"]', password); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.click('[data-test="login-button"]'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }
  async getErrorMessage() {
    return this.page.locator('[data-test="error-message-container"] h3[data-test="error"]'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }
}

test.describe('@SCRUM-13 SauceDemo Login Negative Scenarios', () => {
  
  test.beforeEach(async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.navigateTo();
  });

  /** @feature Login Validation */
  /** @story TC-001 Error message displayed with incorrect username */
  /** @severity critical */
  test('@smoke Error message displayed with incorrect username', async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.login('invalid_user', 'secret_sauce');
    const errorMessage = await loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/Epic sadface/);
  });

  /** @feature Login Validation */
  /** @story TC-002 Error message displayed with incorrect password */
  /** @severity critical */
  test('@smoke Error message displayed with incorrect password', async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.login('standard_user', 'wrong_password');
    const errorMessage = await loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/Epic sadface/);
  });

  /** @feature Login Validation */
  /** @story TC-003 Error message displayed with empty username and password */
  /** @severity critical */
  test('@smoke Error message displayed with empty username and password', async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.login('', '');
    const errorMessage = await loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/Epic sadface/);
  });

  /** @feature Login Validation */
  /** @story TC-004 Error message displayed with empty username and valid password */
  /** @severity critical */
  test('@smoke Error message displayed with empty username and valid password', async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.login('', 'secret_sauce');
    const errorMessage = await loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/Epic sadface/);
  });

  /** @feature Login Validation */
  /** @story TC-005 Error message displayed for locked out user */
  /** @severity critical */
  test('@smoke Error message displayed for locked out user', async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.login('locked_out_user', 'any_password');
    const errorMessage = await loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/Epic sadface/);
  });

  /** @feature Visibility Test */
  /** @story TC-006 Error message visibility */
  /** @severity critical */
  test('@smoke Error message visibility', async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.login('invalid_user', 'secret_sauce');
    const errorMessage = await loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
  });

  /** @feature Button Visibility */
  /** @story TC-007 Login button visibility after error */
  /** @severity critical */
  test('@smoke Login button visibility after error', async ({ page }) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.login('invalid_user', 'secret_sauce');
    const loginButton = page.locator('[data-test="login-button"]'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
  });

});
