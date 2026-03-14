import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * @feature User Registration API
 * @story Successful user registration
 * @severity critical
 * @SCRUM-6
 */
test.describe('API Tests for User Registration - SCRUM-6', () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext();
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('API-TC-001: Successful user registration API', async () => {
    const requestBody = {
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'Password!123'
    };

    const response = await apiContext.post('/api/register', {
      data: requestBody
    });

    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    expect(responseBody).toEqual({
      success: true,
      message: 'User registered successfully'
    });

    expect(response.headers()['content-type']).toBe('application/json');
  });

  /**
   * @feature User Registration API
   * @story Duplicate email rejection
   * @severity critical
   * @SCRUM-6
   */
  test('API-TC-002: Duplicate email registration rejection API', async () => {
    const requestBody = {
      username: 'existinguser',
      email: 'existinguser@example.com',
      password: 'Password!123'
    };

    const response = await apiContext.post('/api/register', {
      data: requestBody
    });

    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    expect(responseBody).toEqual({
      success: false,
      error: 'Email already registered'
    });

    expect(response.headers()['content-type']).toBe('application/json');
  });
});
