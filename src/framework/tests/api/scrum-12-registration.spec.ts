import { test, expect, APIRequestContext, request } from '@playwright/test';

/**
 * @feature Registration API
 * @story SCRUM-12
 * @severity critical
 * @SCRUM-12
 */
test.describe('Registration API Tests', () => {
  let apiContext: APIRequestContext;

  // Inline class for handling API requests to the registration endpoint
  class RegistrationAPI {
    private endpoint: string = '/api/register';

    constructor(private apiContext: APIRequestContext) {}

    async registerUser(payload: Record<string, any>) {
      return await this.apiContext.post(this.endpoint, { data: payload });
    }
  }

  test.beforeAll(async ({ playwright }) => {
    apiContext = await request.newContext();
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  /**
   * @story TC-005: API Email Format Validation
   * @severity critical
   */
  test('TC-005: API Email Format Validation', async () => {
    const registrationAPI = new RegistrationAPI(apiContext);
    const response = await registrationAPI.registerUser({ email: 'invalid-email', password: 'ValidPass123!' });
    expect(response.status()).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Invalid email format');
  });

  /**
   * @story TC-006: API Password Strength Validation
   * @severity major
   */
  test('TC-006: API Password Strength Validation', async () => {
    const registrationAPI = new RegistrationAPI(apiContext);
    const response = await registrationAPI.registerUser({ email: 'valid@example.com', password: '123' });
    expect(response.status()).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Weak password');
  });

  /**
   * @story TC-007: API Existing Email Error
   * @severity critical
   */
  test('TC-007: API Existing Email Error', async () => {
    const registrationAPI = new RegistrationAPI(apiContext);
    const response = await registrationAPI.registerUser({ email: 'existing@example.com', password: 'ValidPass123!' });
    expect(response.status()).toBe(409);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Email already registered');
  });

  /**
   * @story TC-008: API Successful Registration
   * @severity high
   */
  test('TC-008: API Successful Registration', async () => {
    const registrationAPI = new RegistrationAPI(apiContext);
    const response = await registrationAPI.registerUser({ email: 'newuser@example.com', password: 'ValidPass123!' });
    expect(response.status()).toBe(201);
    const responseBody = await response.json();
    expect(responseBody.message).toBe('Success');
  });
});
