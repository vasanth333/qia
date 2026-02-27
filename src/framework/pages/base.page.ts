// ============================================================
// QIA — Base Page Object
// All generated page objects extend this
// ============================================================

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  abstract readonly url: string;

  async navigate(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitForLoad();
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string): Promise<Buffer> {
    return await this.page.screenshot({ fullPage: true, path: `test-results/screenshots/${name}.png` });
  }

  async assertVisible(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).toBeVisible();
  }

  async assertNotVisible(testId: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).not.toBeVisible();
  }

  async assertText(testId: string, text: string): Promise<void> {
    await expect(this.page.getByTestId(testId)).toContainText(text);
  }

  async assertUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  async assertTitle(title: string): Promise<void> {
    await expect(this.page).toHaveTitle(title);
  }
}
