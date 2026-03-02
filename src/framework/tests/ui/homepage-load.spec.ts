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


/**
 * @feature Homepage
 * @story Verify homepage functionality
 * @severity critical
 * @SCRUM-14
 */
test.describe('Homepage', () => {
  class HomePage {
    readonly page;

    constructor(page) {
      this.page = page;
    }

    async goto() {
      await this.page.goto('/');
    }

    async getTitle() {
      return this.page.title();
    }
  }

  test('TC-001: Verify homepage loads successfully with correct title @smoke @SCRUM-14', async ({ page }) => {
    const homePage = new HomePage(page);

    // Given the user accesses the SauceDemo homepage
    await homePage.goto();

    // Then the page should load with the title 'Swag Labs'
    const title = await homePage.getTitle();
    expect(title).toBe('Swag Labs');
  });
});
