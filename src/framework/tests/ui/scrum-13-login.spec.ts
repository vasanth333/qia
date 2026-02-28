import { test, expect } from '@playwright/test';

/**
 * @feature SauceDemo Login Error Messages
 * @story SCRUM-13
 * @severity critical
 */
class LoginPage {
  constructor(private readonly page: import('@playwright/test').Page) {}

  // [TIER1: data-test] [TIER2: role] [TIER3: placeholder]
  async navigate() {
    await this.page.goto('https://www.saucedemo.com');
  }

  async login(username: string, password: string) {
    await this.page.locator('[data-test="username"]').fill(username);
    await this.page.locator('[data-test="password"]').fill(password);
    await this.page.locator('[data-test="login-button"]').click();
  }

  async getErrorMessage(): Promise<string> {
    return await this.page.locator('[data-test="error"]').innerText();
  }

  async isErrorVisible(): Promise<boolean> {
    return await this.page.locator('[data-test="error"]').isVisible();
  }

  async isLoginButtonVisible(): Promise<boolean> {
    return await this.page.locator('[data-test="login-button"]').isVisible();
  }
}

const VALID_PASSWORD = 'secret_sauce';

test.describe('SCRUM-13: SauceDemo Login — Error Messages', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity critical
   */
  test('@smoke @SCRUM-13 TC-001: Wrong username → error shown', async () => {
    await loginPage.login('wrong_user', VALID_PASSWORD);
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
    expect(error).toContain('do not match any user');
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity critical
   */
  test('@smoke @SCRUM-13 TC-002: Wrong password → error shown', async () => {
    await loginPage.login('standard_user', 'wrong_password');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity critical
   */
  test('@regression @SCRUM-13 TC-003: Empty username + empty password → error shown', async () => {
    await loginPage.login('', '');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Username is required');
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity critical
   */
  test('@regression @SCRUM-13 TC-004: Empty username + valid password → error shown', async () => {
    await loginPage.login('', VALID_PASSWORD);
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Username is required');
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity critical
   */
  test('@regression @SCRUM-13 TC-005: locked_out_user → locked out error shown', async () => {
    await loginPage.login('locked_out_user', VALID_PASSWORD);
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
    expect(error).toContain('locked out');
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity high
   */
  test('@regression @SCRUM-13 TC-006: Error contains "Epic sadface" text', async () => {
    await loginPage.login('invalid_user', 'invalid_pass');
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Epic sadface');
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity high
   */
  test('@regression @SCRUM-13 TC-007: Error message is visible', async () => {
    await loginPage.login('wrong_user', VALID_PASSWORD);
    const visible = await loginPage.isErrorVisible();
    expect(visible).toBe(true);
  });

  /**
   * @feature Login Error Handling
   * @story SCRUM-13
   * @severity high
   */
  test('@regression @SCRUM-13 TC-008: Login button visible after failure', async () => {
    await loginPage.login('wrong_user', VALID_PASSWORD);
    const loginButtonVisible = await loginPage.isLoginButtonVisible();
    expect(loginButtonVisible).toBe(true);
  });
});
