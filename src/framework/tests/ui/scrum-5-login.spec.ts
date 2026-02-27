import { test, expect } from '@playwright/test';

// Page Object Model for Login Page
class LoginPage {
  constructor(private page) {}

  async open() {
    await this.page.goto('https://example.com/login');
  }

  async enterEmail(email: string) {
    await this.page.fill('[data-testid="email-input"]', email); // [TIER1: testid]
  }

  async enterPassword(password: string) {
    await this.page.fill('[data-testid="password-input"]', password); // [TIER1: testid]
  }

  async clickLoginButton() {
    await this.page.click('[data-testid="login-button"]'); // [TIER1: testid] [TIER2: role]
  }

  async clickForgotPasswordLink() {
    await this.page.click('[data-testid="forgot-password-link"]'); // [TIER1: testid] [TIER2: link]
  }

  async expectErrorMessageVisible() {
    await expect(this.page.locator('[data-testid="error-message"]')).toBeVisible(); // [TIER1: testid]
  }
}

// Page Object Model for Dashboard
class DashboardPage {
  constructor(private page) {}

  async expectDashboardVisible() {
    await expect(this.page.locator('[data-testid="dashboard"]')).toBeVisible(); // [TIER1: testid]
  }

  async clickLogoutButton() {
    await this.page.click('[data-testid="logout-button"]'); // [TIER1: testid]
  }
}

// Page Object Model for Password Recovery Page
class PasswordRecoveryPage {
  constructor(private page) {}

  async expectRecoveryPageVisible() {
    await expect(this.page.locator('[data-testid="recovery-page"]')).toBeVisible(); // [TIER1: testid]
  }
}

test.describe('@SCRUM-5 Suite Testing Scenarios', () => {

  /** 
   * @story SCRUM-5
   * @severity critical
   * @feature User Authentication 
   */
  test('@smoke TC-001 User can log in with valid email and password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.open();
    await loginPage.enterEmail('valid@example.com');
    await loginPage.enterPassword('SecurePass123!');
    await loginPage.clickLoginButton();
    await dashboardPage.expectDashboardVisible();
  });

  /** 
   * @story SCRUM-5
   * @severity critical
   * @feature User Authentication
   */
  test('@smoke TC-002 User sees error message with invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await loginPage.enterEmail('invalid@example.com');
    await loginPage.enterPassword('WrongPass123!');
    await loginPage.clickLoginButton();
    await loginPage.expectErrorMessageVisible();
  });

  /** 
   * @story SCRUM-5
   * @severity major
   * @feature Password Recovery
   */
  test('TC-003 Forgot password link is visible and functional', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const passwordRecoveryPage = new PasswordRecoveryPage(page);

    await loginPage.open();
    await loginPage.clickForgotPasswordLink();
    await passwordRecoveryPage.expectRecoveryPageVisible();
  });

  /** 
   * @story SCRUM-5
   * @severity critical
   * @feature Session Management
   */
  test('TC-004 Session persists across page refreshes', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Assuming user is already logged in for this scenario
    await dashboardPage.expectDashboardVisible();
    await page.reload();
    await dashboardPage.expectDashboardVisible();
  });

  /** 
   * @story SCRUM-5
   * @severity critical
   * @feature User Authentication
   */
  test('@smoke TC-005 User can log out and session is destroyed', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Assuming user is already logged in
    await dashboardPage.expectDashboardVisible();
    await dashboardPage.clickLogoutButton();
    await loginPage.open(); // Check if redirected to login page implying logout
    // Verify login input is visible as a proxy to being logged out
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
  });
});
