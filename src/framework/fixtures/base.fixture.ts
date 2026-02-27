// ============================================================
// QIA — Base Fixture
// Extended Playwright test with QIA utilities baked in
// ============================================================

import { test as base, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';

export type QIAFixtures = {
  qiaPage: Page;
  qiaRequest: APIRequestContext;
};

export const test = base.extend<QIAFixtures>({
  qiaPage: async ({ page }, use) => {
    // Attach viewport info for visual regression context
    await page.addInitScript(() => {
      // Expose viewport for self-healing helpers (runs in browser context)
      const win = globalThis as unknown as Record<string, unknown> & { innerWidth: number; innerHeight: number };
      win['__qia_viewport'] = { width: win['innerWidth'], height: win['innerHeight'] };
    });

    await use(page);
  },

  qiaRequest: async ({ request }, use) => {
    await use(request);
  },
});

export { expect };
