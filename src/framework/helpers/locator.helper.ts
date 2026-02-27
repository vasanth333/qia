// ============================================================
// QIA — Locator Helper
// Self-healing locator utility for use in generated tests
// ============================================================

import type { Page, Locator } from '@playwright/test';

export type LocatorTier = 'testid' | 'role' | 'text' | 'css' | 'xpath';

export interface SmartLocatorOptions {
  testId?: string;
  role?: Parameters<Page['getByRole']>[0];
  roleName?: string;
  text?: string;
  label?: string;
  css?: string;
  xpath?: string;
}

/**
 * SmartLocator — 3-tier self-healing locator
 * Tier 1: data-testid (preferred)
 * Tier 2: semantic role/label/text
 * Tier 3: CSS/XPath fallback
 */
export async function smartLocator(page: Page, opts: SmartLocatorOptions): Promise<Locator> {
  // Tier 1: testid
  if (opts.testId) {
    const loc = page.getByTestId(opts.testId);
    if (await loc.count() > 0) return loc;
  }

  // Tier 2: semantic
  if (opts.role) {
    const loc = opts.roleName
      ? page.getByRole(opts.role, { name: opts.roleName })
      : page.getByRole(opts.role);
    if (await loc.count() > 0) return loc;
  }

  if (opts.label) {
    const loc = page.getByLabel(opts.label);
    if (await loc.count() > 0) return loc;
  }

  if (opts.text) {
    const loc = page.getByText(opts.text, { exact: true });
    if (await loc.count() > 0) return loc;
  }

  // Tier 3: CSS/XPath fallback
  if (opts.css) {
    const loc = page.locator(opts.css);
    if (await loc.count() > 0) return loc;
  }

  if (opts.xpath) {
    const loc = page.locator(`xpath=${opts.xpath}`);
    if (await loc.count() > 0) return loc;
  }

  // Return best available even if not found (will fail at assertion with helpful message)
  if (opts.testId) return page.getByTestId(opts.testId);
  if (opts.role) return opts.roleName
    ? page.getByRole(opts.role, { name: opts.roleName })
    : page.getByRole(opts.role);
  if (opts.text) return page.getByText(opts.text);
  if (opts.css) return page.locator(opts.css);
  if (opts.xpath) return page.locator(`xpath=${opts.xpath}`);

  throw new Error(`[QIA SmartLocator] No locator strategy provided: ${JSON.stringify(opts)}`);
}
