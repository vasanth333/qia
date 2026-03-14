import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../../pageObjects/registrationPage';

// Page Objects
class RegistrationPage {
  readonly page;
  constructor(page) {
    this.page = page;
  }

  async load() {
    await this.page.goto('/register');
  }

  async enterName(name: string) {
    await this.page.fill('[data-testid="name-input"]', name); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async enterEmail(email: string) {
    await this.page.fill('[data-testid="email-input"]', email); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async enterPassword(password: string) {
    await this.page.fill('[data-testid="password-input"]', password); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async submitForm() {
    await this.page.click('[data-testid="submit-button"]'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async checkRegistrationSuccess() {
    const confirmationMessage = await this.page.locator('[data-testid="confirmation-message"]');
    expect(await confirmationMessage.textContent()).toContain('Registration successful'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async checkDuplicateEmailError() {
    const errorMessage = await this.page.locator('[data-testid="error-message"]');
    expect(await errorMessage.textContent()).toContain('Email already registered'); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async blurField(fieldTestId: string) {
    await this.page.click(`[data-testid="${fieldTestId}"]`);
    await this.page.press(`[data-testid="${fieldTestId}"]`, 'Tab');
  }

  async checkInlineValidationError(fieldTestId: string) {
    const errorLocator = this.page.locator(`[data-testid="${fieldTestId}-error"]`);
    await expect(errorLocator).toBeVisible(); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async checkPasswordStrengthError() {
    const strengthError = await this.page.locator('[data-testid="password-strength-error"]');
    expect(strengthError).toBeVisible(); // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  }

  async checkKeyboardNavigationAccessibility() {
    await this.page.keyboard.press('Tab');
    // Add assertions to ensure focus moves correctly across the form fields
    const activeElement = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(activeElement).toBe('submit-button');
  }
}

test.describe('@SCRUM-6', () => {
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    await registrationPage.load();
  });

  /**
   * @feature User Registration
   * @story Register a new user successfully
   * @severity critical
   */
  test('@smoke TC-001: Register a new user successfully', async () => {
    const user = {
      name: 'ValidUser',
      email: 'testuser@example.com',
      password: 'Password1!'
    };

    await registrationPage.enterName(user.name);
    await registrationPage.enterEmail(user.email);
    await registrationPage.enterPassword(user.password);
    await registrationPage.submitForm();
    await registrationPage.checkRegistrationSuccess();
  });

  /**
   * @feature User Registration
   * @story Reject registration for duplicate email
   * @severity critical
   */
  test('@regression TC-002: Reject registration for duplicate email', async () => {
    const user = {
      email: 'existinguser@example.com',
      password: 'Password1!'
    };

    await registrationPage.enterEmail(user.email);
    await registrationPage.enterPassword(user.password);
    await registrationPage.submitForm();
    await registrationPage.checkDuplicateEmailError();
  });

  /**
   * @feature User Registration
   * @story Show inline validation errors on blur
   * @severity major
   */
  test('@accessibility TC-003: Show inline validation errors on blur', async () => {
    await registrationPage.blurField('name-input');
    await registrationPage.checkInlineValidationError('name-input');
  });

  /**
   * @feature User Registration
   * @story Password strength validation
   * @severity critical
   */
  test('@smoke TC-004: Password strength validation', async () => {
    const user = {
      email: 'newuser@example.com',
      password: 'weakpass'
    };

    await registrationPage.enterEmail(user.email);
    await registrationPage.enterPassword(user.password);
    await registrationPage.submitForm();
    await registrationPage.checkPasswordStrengthError();
  });

  /**
   * @feature User Registration
   * @story Keyboard navigation accessibility
   * @severity major
   */
  test('@accessibility TC-005: Keyboard navigation accessibility', async () => {
    await registrationPage.checkKeyboardNavigationAccessibility();
  });
});
