import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pageObjects/LoginPage';

/**
 * @feature Login
 * @story SCRUM-7
 * @severity critical
 */
test.describe('@smoke @SCRUM-7 SauceDemo Login Tests', () => {
  
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('TC-001 Error message for wrong username and correct password', async () => {
    await loginPage.login('wrong_user', 'secret_sauce');
    const errorMessage = await loginPage.errorMessage();
    expect(errorMessage).toContainText('Epic sadface');
    expect(await errorMessage.isVisible()).toBeTruthy();
  });

  test('TC-002 Error message for correct username and wrong password', async () => {
    await loginPage.login('standard_user', 'wrong_password');
    const errorMessage = await loginPage.errorMessage();
    expect(errorMessage).toContainText('Epic sadface');
    expect(await errorMessage.isVisible()).toBeTruthy();
  });

  test('TC-003 Error message for empty username and empty password', async () => {
    await loginPage.login('', '');
    const errorMessage = await loginPage.errorMessage();
    expect(errorMessage).toContainText('Epic sadface');
    expect(await errorMessage.isVisible()).toBeTruthy();
  });

  test('TC-004 Error message for empty username and valid password', async () => {
    await loginPage.login('', 'secret_sauce');
    const errorMessage = await loginPage.errorMessage();
    expect(errorMessage).toContainText('Epic sadface');
    expect(await errorMessage.isVisible()).toBeTruthy();
  });

  test('TC-005 Locked out error message for locked_out_user credentials', async () => {
    await loginPage.login('locked_out_user', 'secret_sauce');
    const errorMessage = await loginPage.errorMessage();
    expect(errorMessage).toContainText('Epic sadface');
    expect(errorMessage).toContainText('locked');
    expect(await errorMessage.isVisible()).toBeTruthy();
  });

  test('TC-006 Error message visibility', async () => {
    await loginPage.login('invalid_user', 'invalid_password');
    const errorMessage = await loginPage.errorMessage();
    expect(await errorMessage.isVisible()).toBeTruthy();
  });

  test('TC-007 Error message content validation', async () => {
    await loginPage.login('another_invalid_user', 'another_invalid_password');
    const errorMessage = await loginPage.errorMessage();
    expect(errorMessage).toContainText('Epic sadface');
  });

  test('TC-008 Login button visibility after failed login', async () => {
    await loginPage.login('yet_another_invalid_user', 'yet_another_invalid_password');
    const loginButton = await loginPage.loginButton();
    expect(await loginButton.isVisible()).toBeTruthy();
  });

});
