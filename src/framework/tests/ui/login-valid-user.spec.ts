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
  readonly page;

  constructor(page) {
    this.page = page;
  }

  async navigateToHomePage() {
    await this.page.goto('/');
  }

  async loginUser(username: string, password: string) {
    await this.page.fill('[data-test="username"]', username); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.fill('[data-test="password"]', password); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.click('[data-test="login-button"]'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async assertInventoryPageLoaded() {
    await expect(this.page).toHaveURL(/inventory\.html/);
  }

  async assertErrorMessageVisible() {
    await expect(this.page.locator('[data-test="error"]')).toBeVisible(); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }
}

/**
 * @feature Login
 * @story Verify login with valid credentials navigates to inventory page
 * @severity critical
 * @SCRUM-14
 */
test.describe('Login Tests - SCRUM-14', () => {

  test('TC-003: Verify login with valid credentials navigates to inventory page', async ({ page }) => {
    const sauceDemo = new SauceDemoPage(page);
    
    // Given the user is on the SauceDemo homepage
    await sauceDemo.navigateToHomePage();

    // When the user enters 'standard_user' and 'secret_sauce' into the login form
    await sauceDemo.loginUser('standard_user', 'secret_sauce');

    // Then the inventory page should load at /inventory.html
    await sauceDemo.assertInventoryPageLoaded();
  });

  test('TC-004: Verify login with locked out user displays error', async ({ page }) => {
    const sauceDemo = new SauceDemoPage(page);
    
    // Given the user is on the SauceDemo homepage
    await sauceDemo.navigateToHomePage();

    // When the user enters 'locked_out_user' and 'any_password' into the login form
    await sauceDemo.loginUser('locked_out_user', 'any_password');

    // Then an error message should be visible
    await sauceDemo.assertErrorMessageVisible();
  });

});
