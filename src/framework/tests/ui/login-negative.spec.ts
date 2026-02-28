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


class LoginPage {
  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  readonly usernameInput = '[data-test="username"]';
  readonly passwordInput = '[data-test="password"]';
  readonly loginButton = '[data-test="login-button"]';
  readonly errorMessage = '[data-test="error-message-container"]';
  readonly errorText = '[data-test="error-message-container"] h3[data-test="error"]';

  constructor(private page: any) {}

  async navigateToLoginPage() {
    await this.page.goto('/');
  }

  async login(username: string, password: string) {
    await this.page.fill(this.usernameInput, username);
    await this.page.fill(this.passwordInput, password);
    await this.page.click(this.loginButton);
  }

  async getErrorMessage() {
    return this.page.locator(this.errorText).textContent();
  }
}

// @feature Login
// @story SCRUM-13
// @severity critical
test.describe('@SCRUM-13 Login Negative Tests', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigateToLoginPage();
  });

  test('@smoke TC-001 Display error when entering wrong username', async ({ page }) => {
    await loginPage.login('wrong_user', 'secret_sauce');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
    await expect(page.locator(loginPage.loginButton)).toBeVisible();
  });

  test('@smoke TC-002 Display error when entering wrong password', async ({ page }) => {
    await loginPage.login('standard_user', 'wrong_password');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
    await expect(page.locator(loginPage.loginButton)).toBeVisible();
  });

  test('@smoke TC-003 Display error for empty username and password fields', async ({ page }) => {
    await page.click(loginPage.loginButton);
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
    await expect(page.locator(loginPage.loginButton)).toBeVisible();
  });

  test('@smoke TC-004 Display error for empty username and valid password', async ({ page }) => {
    await loginPage.login('', 'secret_sauce');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
    await expect(page.locator(loginPage.loginButton)).toBeVisible();
  });

  test('@smoke TC-005 Display locked out error for locked_out_user', async ({ page }) => {
    await loginPage.login('locked_out_user', 'any_password');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
    await expect(page.locator(loginPage.loginButton)).toBeVisible();
  });
});
