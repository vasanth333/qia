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
  private page;

  constructor(page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto('/');
  }

  async enterUsername(username: string) {
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.fill('[data-test="username"]', username);
  }

  async enterPassword(password: string) {
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.fill('[data-test="password"]', password);
  }

  async clickLoginButton() {
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.click('[data-test="login-button"]');
  }

  async getErrorMessage() {
    // [TIER1: testid]
    return this.page.innerText('[data-test="error"]');
  }

  async isErrorMessageVisible() {
    // [TIER1: testid]
    return this.page.isVisible('[data-test="error"]');
  }

  async isLoginButtonVisible() {
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    return this.page.isVisible('[data-test="login-button"]');
  }
}

test.describe('@feature login-negative-tests @SCRUM-13', () => {
  test('@smoke @SCRUM-13 TC-001 Show error for incorrect username', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterUsername('wrong_user');
    await loginPage.enterPassword('secret_sauce');
    await loginPage.clickLoginButton();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Epic sadface');
  });

  test('@smoke @SCRUM-13 TC-002 Show error for incorrect password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterUsername('standard_user');
    await loginPage.enterPassword('wrong_password');
    await loginPage.clickLoginButton();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Epic sadface');
  });

  test('@smoke @SCRUM-13 TC-003 Show error for empty username and password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.clickLoginButton();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Epic sadface');
  });

  test('@smoke @SCRUM-13 TC-004 Show error for empty username and valid password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterPassword('secret_sauce');
    await loginPage.clickLoginButton();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Epic sadface');
  });

  test('@smoke @SCRUM-13 TC-005 Show locked out error for locked_out_user', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterUsername('locked_out_user');
    await loginPage.enterPassword('secret_sauce');
    await loginPage.clickLoginButton();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Epic sadface');
  });

  test('@regression @SCRUM-13 TC-006 Verify error message contains \'Epic sadface\'', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterUsername('wrong_user');
    await loginPage.enterPassword('secret_sauce');
    await loginPage.clickLoginButton();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toContain('Epic sadface');
  });

  test('@regression @SCRUM-13 TC-007 Verify error message visibility', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterUsername('wrong_user');
    await loginPage.enterPassword('secret_sauce');
    await loginPage.clickLoginButton();
    const isErrorVisible = await loginPage.isErrorMessageVisible();
    expect(isErrorVisible).toBeTruthy();
  });

  test('@regression @SCRUM-13 TC-008 Login button visible after error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.enterUsername('wrong_user');
    await loginPage.enterPassword('secret_sauce');
    await loginPage.clickLoginButton();
    const isLoginButtonVisible = await loginPage.isLoginButtonVisible();
    expect(isLoginButtonVisible).toBeTruthy();
  });
});
