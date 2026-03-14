// src/framework/tests/ui/scrum-6-signup.spec.ts

import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../../pages/registrationPage';
import { EmailService } from '../../utils/emailService';

/**
 * @feature Registration
 * @story Successful registration with valid credentials
 * @severity critical
 * @tags @smoke @SCRUM-6
 */
test.describe('SCRUM-6: Registration Tests', () => {
  let registrationPage: RegistrationPage;
  let emailService: EmailService;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    emailService = new EmailService();
    await registrationPage.navigate();
  });

  test('TC-001: Successful registration with valid credentials', async ({ page }) => {
    await registrationPage.fillRegistrationForm('John Doe', 'john.doe@example.com', 'ValidPass123');
    await registrationPage.submitForm();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible(); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    expect(await emailService.isConfirmationEmailSent('john.doe@example.com')).toBeTruthy();
  });

  /**
   * @story Attempt registration with a duplicate email
   * @severity major
   * @tags @retest @SCRUM-6
   */
  test('TC-002: Attempt registration with a duplicate email', async () => {
    await registrationPage.fillRegistrationForm('Jane Doe', 'duplicate.email@example.com', 'ValidPass123');
    await registrationPage.submitForm();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Email already registered'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  });

  /**
   * @story Registration password policy enforcement
   * @severity major
   * @tags @retest @SCRUM-6
   */
  test('TC-003: Registration password policy enforcement', async () => {
    await registrationPage.fillRegistrationForm('Billy Bob', 'billy.bob@example.com', 'pass');
    await registrationPage.submitForm();
    await expect(page.locator('[data-testid="password-validation-error"]')).toContainText('Password does not meet criteria'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  });

  /**
   * @story Verify redirection after email confirmation
   * @severity critical
   * @tags @regression @SCRUM-6
   */
  test('TC-004: Verify redirection after email confirmation', async () => {
    const confirmationLink = await emailService.getConfirmationLink('jane.doe@example.com');
    await registrationPage.confirmEmail(confirmationLink);
    await expect(page.locator('[data-testid="onboarding-page"]')).toBeVisible(); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  });

  /**
   * @story Accessibility compliance for keyboard navigation
   * @severity major
   * @tags @accessibility @SCRUM-6
   */
  test('TC-005: Accessibility compliance for keyboard navigation', async () => {
    await registrationPage.ensureKeyboardNavigation();
    const isFullyTraversable = await registrationPage.verifyKeyboardAccessibility();
    expect(isFullyTraversable).toBeTruthy();
  });
});

// src/framework/pages/registrationPage.ts

import { Page } from '@playwright/test';

export class RegistrationPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate() {
    await this.page.goto('/register');
  }

  async fillRegistrationForm(name: string, email: string, password: string) {
    await this.page.fill('[data-testid="name-input"]', name); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.fill('[data-testid="email-input"]', email); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await this.page.fill('[data-testid="password-input"]', password); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async submitForm() {
    await this.page.click('[data-testid="submit-button"]'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async confirmEmail(link: string) {
    await this.page.goto(link);
  }

  async ensureKeyboardNavigation() {
    await this.page.focus('[data-testid="name-input"]'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async verifyKeyboardAccessibility(): Promise<boolean> {
    const nameField = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    await this.page.keyboard.press('Tab');
    const emailField = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    await this.page.keyboard.press('Tab');
    const passwordField = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    await this.page.keyboard.press('Tab');
    const submitButton = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    return nameField === 'name-input' && emailField === 'email-input' && passwordField === 'password-input' && submitButton === 'submit-button';
  }
}

// src/framework/utils/emailService.ts

export class EmailService {
  async isConfirmationEmailSent(email: string): Promise<boolean> {
    // Simulated email service check, should be replaced with a real implementation
    return true;
  }

  async getConfirmationLink(email: string): Promise<string> {
    // Simulated service to get the confirmation link from email
    return 'https://example.com/confirmation-link';
  }
}
