import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

/**
 * @feature SCRUM-11
 * @severity critical
 * @story Invalid password shows correct error message
 * @tags @smoke @SCRUM-11 @ui
 */
test.describe('SCRUM-11 Login Tests', () => {
  let loginPage: LoginPage;
  
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
  });

  test('TC-001: Invalid password shows correct error message', async ({ page }) => {
    // Given the login page is displayed
    await loginPage.waitForLoad();

    // When the user enters a valid username and invalid password
    await loginPage.login('standard_user', 'wrong_password');

    // Then the login button is clicked
    // [TIER1: testid] [TIER2: role] [TIER3: fallback]
    await page.click('[data-testid="login-button"]');

    // And an error message should be displayed
    const errorMessage = await page.locator('[data-testid="error-message"]').innerText();
    expect(errorMessage).toBe('Invalid password. Please try again.');
  });

  /**
   * @feature SCRUM-11
   * @severity major
   * @story Error message style and position validation
   * @tags @visual @SCRUM-11 @ui
   */
  test('TC-002: Error message style and position validation', async ({ page }) => {
    // Given the login page is displayed
    await loginPage.waitForLoad();

    // When the user enters invalid password credentials and clicks login
    await loginPage.login('standard_user', 'wrong_password');
    await page.click('[data-testid="login-button"]');

    // Then verify the error message position
    const errorLocator = page.locator('[data-testid="error-message"]');
    const boundingBox = await errorLocator.boundingBox();
    expect(boundingBox?.x).toBeGreaterThanOrEqual(10); // Example position check
    expect(boundingBox?.y).toBeGreaterThanOrEqual(50); // Example position check

    // And the style should match the design specifications
    expect(await errorLocator.evaluate(node => window.getComputedStyle(node).color)).toBe('rgba(255,0,0,1)'); // Example style check
    
    // Optionally check for other styles like font-size, background-color etc.
  });
});
