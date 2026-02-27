import { test, expect } from '@playwright/test';

/**
 * @feature Registration
 * @story SCRUM-12
 */
class RegistrationPage {
  constructor(private page) {}

  async goto() {
    await this.page.goto('https://example.com/register');
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async inputEmail(email: string) {
    await this.page.fill('[data-testid="email-input"]', email);
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async inputPassword(password: string) {
    await this.page.fill('[data-testid="password-input"]', password);
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async submitForm() {
    await this.page.click('[data-testid="submit-button"]');
  }

  async getEmailError(): Promise<string> {
    return this.page.textContent('[data-testid="email-error"]');
  }

  async getPasswordError(): Promise<string> {
    return this.page.textContent('[data-testid="password-error"]');
  }

  async getGeneralError(): Promise<string> {
    return this.page.textContent('[data-testid="general-error"]');
  }

  async isRedirectedToSuccessPage(): Promise<boolean> {
    return this.page.url() === 'https://example.com/success';
  }
}

test.describe('Registration Form - @SCRUM-12', () => {
  let registrationPage: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
  });

  /**
   * @severity critical
   */
  test('@smoke @SCRUM-12 TC-001: Email Format Validation', async () => {
    for (const email of ['userexample.com', 'user@.com']) {
      await registrationPage.inputEmail(email);
      await registrationPage.submitForm();
      const emailError = await registrationPage.getEmailError();
      expect(emailError).toContain('Invalid email format');
    }
  });

  /**
   * @severity major
   */
  test('@regression @SCRUM-12 TC-002: Password Strength Validation', async () => {
    for (const password of ['weakpass1', 'Weakpass']) {
      await registrationPage.inputPassword(password);
      await registrationPage.submitForm();
      const passwordError = await registrationPage.getPasswordError();
      expect(passwordError).toContain('Password must include 1 uppercase and 1 special character');
    }
  });
  
  /**
   * @severity critical
   */
  test('@regression @SCRUM-12 TC-003: Existing Email Validation', async () => {
    await registrationPage.inputEmail('existinguser@example.com');
    await registrationPage.inputPassword('StrongPass1!');
    await registrationPage.submitForm();
    const generalError = await registrationPage.getGeneralError();
    expect(generalError).toContain('Email already registered');
  });

  /**
   * @severity high
   */
  test('@sanity @SCRUM-12 TC-004: Successful Registration', async () => {
    await registrationPage.inputEmail('newuser@example.com');
    await registrationPage.inputPassword('StrongPass1!');
    await registrationPage.submitForm();
    const redirected = await registrationPage.isRedirectedToSuccessPage();
    expect(redirected).toBeTruthy();
    // Note: Verification of receiving a confirmation email would typically be done through an API or email service mock, not shown here.
  });
});
