import { test, expect } from '@playwright/test';

/**
 * @feature Login Error Handling
 * @story SCRUM-13
 * @severity critical
 */
class LoginPage {
  constructor(private page) {}

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async navigate() {
    await this.page.goto('/login');
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async enterUsername(username: string) {
    await this.page.fill('[data-testid="username"]', username);
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async enterPassword(password: string) {
    await this.page.fill('[data-testid="password"]', password);
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async submit() {
    await this.page.click('[data-testid="login-button"]');
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async getErrorMessage() {
    return this.page.locator('[data-testid="error-message"]');
  }

  // [TIER1: testid] [TIER2: role] [TIER3: fallback]
  async isLoginButtonVisible() {
    return this.page.isVisible('[data-testid="login-button"]');
  }
}

test.describe('Login Error Handling', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('TC-001: Incorrect username leads to error message @SCRUM-13 @smoke', async () => {
    await loginPage.enterUsername('incorrect');
    await loginPage.enterPassword('validpassword');
    await loginPage.submit();
    const errorMessage = loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Epic sadface');
  });

  test('TC-002: Incorrect password leads to error message @SCRUM-13 @regression', async () => {
    await loginPage.enterUsername('validusername');
    await loginPage.enterPassword('incorrect');
    await loginPage.submit();
    const errorMessage = loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Epic sadface');
  });

  test('TC-003: Empty username and password lead to error message @SCRUM-13 @regression', async () => {
    await loginPage.enterUsername('');
    await loginPage.enterPassword('');
    await loginPage.submit();
    const errorMessage = loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Epic sadface');
  });

  test('TC-004: Empty username with valid password leads to error message @SCRUM-13 @regression', async () => {
    await loginPage.enterUsername('');
    await loginPage.enterPassword('validpassword');
    await loginPage.submit();
    const errorMessage = loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Epic sadface');
  });

  test('TC-005: Locked-out user receives specific error message @SCRUM-13 @regression', async () => {
    await loginPage.enterUsername('lockedoutuser');
    await loginPage.enterPassword('anyPassword');
    await loginPage.submit();
    const errorMessage = loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Epic sadface');
  });

  test('TC-006: Error message is visible to user @SCRUM-13 @usability', async () => {
    await loginPage.enterUsername('anyusername');
    await loginPage.enterPassword('wrongpassword');
    await loginPage.submit();
    const errorMessage = loginPage.getErrorMessage();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toBeTruthy();
  });

  test('TC-007: Login button remains visible after error displayed @SCRUM-13 @usability', async () => {
    await loginPage.enterUsername('invalid');
    await loginPage.enterPassword('invalid');
    await loginPage.submit();
    const loginButtonVisible = await loginPage.isLoginButtonVisible();
    expect(loginButtonVisible).toBeTruthy();
  });
});
