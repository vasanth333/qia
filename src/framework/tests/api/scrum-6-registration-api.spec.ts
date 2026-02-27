import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * @feature Registration API
 * @story Valid registration API call
 * @severity critical
 * @SCRUM-6
 */
test.describe('API Tests for Registration', () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext();
  });

  test('TC-006: Valid registration API call', async () => {
    // Given the registration API is running
    
    // When an API request is made with valid registration data
    const registrationData = {
      email: 'valid@example.com',
      password: 'validPassword123',
      confirmPassword: 'validPassword123'
    };
    
    const response = await apiContext.post('/api/register', {
      data: registrationData
    });

    // Then the API should return a success code and trigger an email
    expect(response.status()).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('message', 'Registration successful');
    // Add further assertions to check email trigger if applicable
    
    const headers = response.headers();
    expect(headers['content-type']).toBe('application/json');
  });

  /**
   * @feature Registration API
   * @story Duplicate email registration rejection API call
   * @severity major
   * @SCRUM-6
   */
  test('TC-007: Duplicate email registration rejection API call', async () => {
    // Given the registration API is running
    
    // When an API request is made with a duplicate email
    const duplicateData = {
      email: 'duplicate@example.com',
      password: 'duplicatePassword123',
      confirmPassword: 'duplicatePassword123'
    };
    
    const response = await apiContext.post('/api/register', {
      data: duplicateData
    });
    
    // Then the API should respond with an error code and message
    expect(response.status()).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('error', 'Email already in use');
    
    const headers = response.headers();
    expect(headers['content-type']).toBe('application/json');
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });
});
