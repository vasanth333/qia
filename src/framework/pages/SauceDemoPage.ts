// ============================================================
// QIA — SauceDemo Page Object Model
// Covers: Login Page + Inventory Page
// @Epic: QIA End-to-End Verification
// @Feature: SauceDemo Homepage & Login
// ============================================================

import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base.page.js';

export class SauceDemoPage extends BasePage {
  // SauceDemo uses data-test="..." (not data-testid), use locator() directly
  readonly url = 'https://www.saucedemo.com';

  // ── Login page locators ──────────────────────────────────
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  // ── Inventory page locators ──────────────────────────────
  readonly inventoryContainer: Locator;
  readonly inventoryItems: Locator;
  readonly appLogo: Locator;
  readonly productImages: Locator;
  readonly addToCartButtons: Locator;

  constructor(page: Page) {
    super(page);

    // Login
    this.usernameInput = page.locator('[data-test="username"]');
    this.passwordInput = page.locator('[data-test="password"]');
    this.loginButton   = page.locator('[data-test="login-button"]');
    this.errorMessage  = page.locator('[data-test="error"]');

    // Inventory
    this.inventoryContainer = page.locator('[data-test="inventory-container"]');
    this.inventoryItems     = page.locator('[data-test="inventory-item"]');
    this.appLogo            = page.locator('.app_logo');
    this.productImages      = page.locator('.inventory_item_img img');
    this.addToCartButtons   = page.locator('[data-test^="add-to-cart"]');
  }

  // ── Actions ──────────────────────────────────────────────

  /** Fill credentials and click login. */
  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /** Returns the visible error banner text. */
  async getErrorMessage(): Promise<string> {
    return this.errorMessage.innerText();
  }

  /** True when both username + password fields are visible. */
  async isLoginFormVisible(): Promise<boolean> {
    const [u, p] = await Promise.all([
      this.usernameInput.isVisible(),
      this.passwordInput.isVisible(),
    ]);
    return u && p;
  }

  /** True when current URL contains /inventory.html */
  async isOnInventoryPage(): Promise<boolean> {
    return this.page.url().includes('/inventory.html');
  }

  /** Count of inventory item cards on the page. */
  async getInventoryItemCount(): Promise<number> {
    return this.inventoryItems.count();
  }

  /** Returns text content of the top-left logo (e.g. "Swag Labs"). */
  async getLogoText(): Promise<string> {
    return (await this.appLogo.textContent()) ?? '';
  }

  // ── Assertions ───────────────────────────────────────────

  async assertLoginFormVisible(): Promise<void> {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }

  async assertOnInventoryPage(): Promise<void> {
    await expect(this.page).toHaveURL(/inventory\.html/);
    await expect(this.inventoryContainer).toBeVisible();
  }

  async assertErrorVisible(expectedSubstring?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (expectedSubstring) {
      await expect(this.errorMessage).toContainText(expectedSubstring);
    }
  }

  /** Assert that every img within the inventory has a non-empty src (no broken images). */
  async assertAllProductImagesLoaded(): Promise<void> {
    const count = await this.productImages.count();
    for (let i = 0; i < count; i++) {
      const src = await this.productImages.nth(i).getAttribute('src');
      expect(src, `Product image ${i} has an empty src`).toBeTruthy();
    }
  }
}
