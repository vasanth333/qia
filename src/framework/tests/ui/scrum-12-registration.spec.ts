import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../../page-objects/registration.page';

/**
 * @feature User Registration
 * @story Validate email format in registration form
 * @severity critical
 * @SCRUM-12
 */
test.describe('SCRUM-12: Registration Form Scenarios', () => {
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
  });

  test('TC-001: Validate email format in registration form', async ({ page }) => {
    const emailErrorTexts = [
      'Invalid email format',
      'Enter a valid email address'
    ];
    
    for (const variant of ['userexample.com', 'user@.com', 'user@domain']) {
      await registrationPage.fillEmail(variant);
      const errorMsg = await registrationPage.getEmailError();
      expect(emailErrorTexts).toContain(errorMsg);
    }
  });

  /**
   * @story Validate password strength requirements
   * @severity critical
   * @SCRUM-12
   */
  test('TC-002: Validate password strength requirements', async ({ page }) => {
    const passwordErrorText = 'Password must be at least 8 characters long and include 1 uppercase letter, 1 number, and 1 special character.';
    
    for (const variant of ['passwor', 'Password1', 'password!1']) {
      await registrationPage.fillPassword(variant);
      const errorMsg = await registrationPage.getPasswordError();
      expect(errorMsg).toBe(passwordErrorText);
    }
  });

  /**
   * @story Check error message for existing email
   * @severity high
   * @SCRUM-12
   */
  test('TC-003: Check error message for existing email', async ({ page }) => {
    await registrationPage.fillEmail('existinguser@domain.com');
    await registrationPage.fillPassword('ValidPass!1');
    await registrationPage.submit();
    const errorMsg = await registrationPage.getEmailExistsError();
    expect(errorMsg).toBe('Email already exists');
  });

  /**
   * @story Verify success confirmation email after registration
   * @severity high
   * @SCRUM-12
   */
  test('TC-004: Verify success confirmation email after registration', async ({ page }) => {
    await registrationPage.fillEmail('newuser@domain.com');
    await registrationPage.fillPassword('ValidPass!1');
    await registrationPage.submit();
    const successMsg = await registrationPage.getRegistrationSuccessMessage();
    expect(successMsg).toBe('Registration successful! Check your email for confirmation.');
  });

  /**
   * @story Ensure inline validation errors show in real-time
   * @severity medium
   * @SCRUM-12
   */
  test('TC-005: Ensure inline validation errors show in real-time', async ({ page }) => {
    const scenarios = [
      { email: 'invalidemail@', password: 'short' },
      { email: 'correct@domain.com', password: 'noUppercase1' },
      { email: 'correct@domain.com', password: 'NoNumber!' }
    ];

    for (const { email, password } of scenarios) {
      await registrationPage.fillEmail(email);
      await registrationPage.fillPassword(password);
      expect(await registrationPage.hasInlineValidationTriggered()).toBe(true);
    }
  });
});

// Page object: src/framework/page-objects/registration.page.ts
import { Page } from '@playwright/test';

export class RegistrationPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
  }

  async fillEmail(email: string) {
    await this.page.fill('[data-testid=email-input]', email);
  }

  async fillPassword(password: string) {
    await this.page.fill('[data-testid=password-input]', password);
  }

  async submit() {
    await this.page.click('[data-testid=register-button]');
  }

  async getEmailError() {
    return this.page.textContent('[data-testid=email-error]');
  }

  async getPasswordError() {
    return this.page.textContent('[data-testid=password-error]');
  }

  async getEmailExistsError() {
    return this.page.textContent('[data-testid=existing-email-error]');
  }

  async getRegistrationSuccessMessage() {
    return this.page.textContent('[data-testid=success-message]');
  }

  async hasInlineValidationTriggered() {
    return this.page.isVisible('[data-testid=inline-validation]');
  }
}
