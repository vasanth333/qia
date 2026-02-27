import { test, expect, request, APIResponse } from '@playwright/test';

/**
 * @feature Login API
 * @story SCRUM-11
 * @severity critical
 */

class LoginApi {
  // API endpoint for login
  private static readonly loginEndpoint = 'https://api.example.com/login';

  /**
   * Makes a login request with given credentials.
   * @param {string} username - The username to login with.
   * @param {string} password - The password to login with.
   * @returns {Promise<APIResponse>} - The API response.
   */
  public static async login(username: string, password: string): Promise<APIResponse> {
    const requestContext = await request.newContext();
    return await requestContext.post(LoginApi.loginEndpoint, {
      data: {
        username,
        password
      }
    });
  }
}

test.describe('API Tests for Login', () => {
  test('@api @SCRUM-11 TC-003: API rejects login with invalid password', async () => {
    // Given the API endpoint for login is available
    // [TIER1: testid]

    // When login is attempted with an invalid password
    const response = await LoginApi.login('standard_user', 'wrong_password');

    // Then the response status code should be 401 (Unauthorized)
    expect(response.status()).toBe(401);

    // And the response headers should not contain sensitive information
    const headers = response.headers();
    expect(headers['server']).toEqual(''); // Hypothetical expectation
    expect(headers['x-powered-by']).toBeUndefined(); // Hypothetical expectation
  });

  /**
   * @feature Login API
   * @story SCRUM-11
   * @severity high
   */
  test('@security @api @SCRUM-11 TC-004: API error response content verification', async () => {
    // Given the API endpoint for login is available
    // [TIER1: testid]

    // When login is attempted with incorrect credentials
    const response = await LoginApi.login('standard_user', 'wrong_password');

    // Then the response should not reveal sensitive application information
    const responseBody = await response.json();
    const errorMessage = responseBody?.error || '';

    // Validate the error message is generic
    expect(errorMessage).toBe('Authentication failed');

    // Ensure the response does not expose system internals
    expect(responseBody).not.toHaveProperty('stackTrace'); 
  });
});
