// ============================================================
// QIA — Base API Client
// Reusable Playwright APIRequestContext wrapper
// ============================================================

import type { APIRequestContext, APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';

export abstract class BaseApiClient {
  constructor(protected readonly request: APIRequestContext) {}

  protected async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const response = await this.request.get(path, params ? { params } : undefined);
    await this.assertSuccess(response, 'GET', path);
    return await response.json() as T;
  }

  protected async post<T>(path: string, data: unknown): Promise<T> {
    const response = await this.request.post(path, { data });
    await this.assertSuccess(response, 'POST', path);
    return await response.json() as T;
  }

  protected async put<T>(path: string, data: unknown): Promise<T> {
    const response = await this.request.put(path, { data });
    await this.assertSuccess(response, 'PUT', path);
    return await response.json() as T;
  }

  protected async patch<T>(path: string, data: unknown): Promise<T> {
    const response = await this.request.patch(path, { data });
    await this.assertSuccess(response, 'PATCH', path);
    return await response.json() as T;
  }

  protected async delete(path: string): Promise<void> {
    const response = await this.request.delete(path);
    await this.assertSuccess(response, 'DELETE', path);
  }

  private async assertSuccess(response: APIResponse, method: string, path: string): Promise<void> {
    expect(
      response.ok(),
      `[QIA API] ${method} ${path} failed with status ${response.status()}`
    ).toBeTruthy();
  }
}
