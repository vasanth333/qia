/**
 * @Epic QIA End-to-End Verification
 * @Feature SauceDemo Homepage & Login
 * @Story Verify SauceDemo Homepage and Login
 * @Owner QIA Agent
 */

import { test, expect } from '@playwright/test';
import { SauceDemoPage } from '../../pages/SauceDemoPage.js';

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
    for (let i = _networkLog.length - 1; i >= 0; i--) {
      const entry = _networkLog[i];
      if (entry && entry.url === res.url() && entry.status === undefined) {
        entry.status = res.status();
        entry.responseTime = start !== undefined ? Date.now() - start : 0;
        break;
      }
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'failed') return;

  const testSlug = testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `${testSlug}.png`);
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach('full-page-screenshot', { path: screenshotPath, contentType: 'image/png' });
  } catch { /* page may be closed */ }

  let domSnapshot = '';
  try { domSnapshot = (await page.content()).slice(0, 8000); } catch { /* page may be closed */ }

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

// Credentials — override via env vars in CI, fall back to known test values
const VALID_USER = process.env['SAUCE_USERNAME'] ?? 'standard_user';
const VALID_PASS = process.env['SAUCE_PASSWORD'] ?? 'secret_sauce';

test.describe('SauceDemo: Homepage & Login', () => {

  // ──────────────────────────────────────────────────────────
  // [P0] TC-001: Homepage loads — title is "Swag Labs"
  // @Severity: blocker
  // ──────────────────────────────────────────────────────────
  test('@smoke [P0] TC-001: Homepage loads — page title is "Swag Labs"', async ({ page }) => {
    /**
     * @Step Navigate to SauceDemo homepage
     * @Step Verify browser tab title is "Swag Labs"
     */
    await test.step('Navigate to SauceDemo homepage', async () => {
      await page.goto('https://www.saucedemo.com');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify page title is "Swag Labs"', async () => {
      await expect(page).toHaveTitle('Swag Labs');
    });
  });

  // ──────────────────────────────────────────────────────────
  // [P0] TC-002: Login form visible — username + password fields
  // @Severity: blocker
  // ──────────────────────────────────────────────────────────
  test('@smoke [P0] TC-002: Login form visible — username, password and login button present', async ({ page }) => {
    /**
     * @Step Navigate to homepage
     * @Step Assert username field visible
     * @Step Assert password field visible
     * @Step Assert login button visible
     */
    const saucePage = new SauceDemoPage(page);

    await test.step('Navigate to homepage', async () => {
      await saucePage.navigate();
    });

    await test.step('Assert login form fields are visible', async () => {
      await saucePage.assertLoginFormVisible();
    });
  });

  // ──────────────────────────────────────────────────────────
  // [P0] TC-003: Valid login → redirects to inventory
  // @Severity: blocker
  // ──────────────────────────────────────────────────────────
  test('@smoke [P0] TC-003: Valid login — standard_user redirects to inventory page', async ({ page }) => {
    /**
     * @Step Navigate to homepage
     * @Step Login with valid credentials
     * @Step Assert redirect to /inventory.html
     * @Step Assert inventory container is visible
     */
    const saucePage = new SauceDemoPage(page);

    await test.step('Navigate to homepage', async () => {
      await saucePage.navigate();
    });

    await test.step(`Login as ${VALID_USER}`, async () => {
      await saucePage.login(VALID_USER, VALID_PASS);
    });

    await test.step('Assert redirect to inventory page', async () => {
      await saucePage.assertOnInventoryPage();
    });
  });

  // ──────────────────────────────────────────────────────────
  // [P1] TC-004: Invalid login — wrong password → error visible
  // @Severity: critical
  // ──────────────────────────────────────────────────────────
  test('@regression [P1] TC-004: Invalid login — wrong password shows error message', async ({ page }) => {
    /**
     * @Step Navigate to homepage
     * @Step Login with valid user + wrong password
     * @Step Assert error banner contains "Epic sadface"
     */
    const saucePage = new SauceDemoPage(page);

    await test.step('Navigate to homepage', async () => {
      await saucePage.navigate();
    });

    await test.step('Attempt login with wrong password', async () => {
      await saucePage.login(VALID_USER, 'wrong_password_123');
    });

    await test.step('Assert error message is shown', async () => {
      await saucePage.assertErrorVisible('Epic sadface');
    });
  });

  // ──────────────────────────────────────────────────────────
  // [P1] TC-005: Empty login — blank fields → validation message
  // @Severity: critical
  // ──────────────────────────────────────────────────────────
  test('@regression [P1] TC-005: Empty login — blank fields show validation error', async ({ page }) => {
    /**
     * @Step Navigate to homepage
     * @Step Click login without entering any credentials
     * @Step Assert "Username is required" error is visible
     */
    const saucePage = new SauceDemoPage(page);

    await test.step('Navigate to homepage', async () => {
      await saucePage.navigate();
    });

    await test.step('Click login with blank fields', async () => {
      await saucePage.loginButton.click();
    });

    await test.step('Assert username required error', async () => {
      await saucePage.assertErrorVisible('Username is required');
    });
  });

  // ──────────────────────────────────────────────────────────
  // [P1] TC-006: Inventory — at least 6 products visible after login
  // @Severity: critical
  // ──────────────────────────────────────────────────────────
  test('@regression [P1] TC-006: Inventory page — at least 6 products visible after login', async ({ page }) => {
    /**
     * @Step Navigate and login
     * @Step Count inventory items
     * @Step Assert count >= 6
     */
    const saucePage = new SauceDemoPage(page);

    await test.step('Navigate and login', async () => {
      await saucePage.navigate();
      await saucePage.login(VALID_USER, VALID_PASS);
      await saucePage.assertOnInventoryPage();
    });

    await test.step('Assert at least 6 products are displayed', async () => {
      const count = await saucePage.getInventoryItemCount();
      expect(count, `Expected at least 6 products, found ${count}`).toBeGreaterThanOrEqual(6);
    });
  });

  // ──────────────────────────────────────────────────────────
  // [P2] TC-007: Product images — all images load (no broken images)
  // @Severity: normal
  // ──────────────────────────────────────────────────────────
  test('@regression [P2] TC-007: Product images — all images have non-empty src (no broken images)', async ({ page }) => {
    /**
     * @Step Navigate and login
     * @Step Assert all product image src attributes are populated
     */
    const saucePage = new SauceDemoPage(page);

    await test.step('Navigate and login', async () => {
      await saucePage.navigate();
      await saucePage.login(VALID_USER, VALID_PASS);
      await saucePage.assertOnInventoryPage();
    });

    await test.step('Assert all product images are loaded', async () => {
      await saucePage.assertAllProductImagesLoaded();
    });
  });

  // ──────────────────────────────────────────────────────────
  // [P2] TC-008: Add to cart — button visible on first product
  // @Severity: normal
  // ──────────────────────────────────────────────────────────
  test('@regression [P2] TC-008: Add to cart — button visible on first product', async ({ page }) => {
    /**
     * @Step Navigate and login
     * @Step Assert at least one "Add to cart" button is visible
     */
    const saucePage = new SauceDemoPage(page);

    await test.step('Navigate and login', async () => {
      await saucePage.navigate();
      await saucePage.login(VALID_USER, VALID_PASS);
      await saucePage.assertOnInventoryPage();
    });

    await test.step('Assert Add to Cart button is visible on first product', async () => {
      const firstBtn = saucePage.addToCartButtons.first();
      await expect(firstBtn).toBeVisible();
    });
  });

});
