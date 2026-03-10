import { expect, request, type APIRequestContext, type Page } from '@playwright/test';

export type Credentials = {
  email: string;
  password: string;
};

const API_BASE_URL = 'http://localhost:3001/api/';

export async function loginViaApi(page: Page, creds: Credentials): Promise<void> {
  const api = await request.newContext({ baseURL: API_BASE_URL });
  const response = await api.post('auth/login', { data: creds });
  expect(response.ok()).toBeTruthy();

  const state = await api.storageState();
  await page.context().addCookies(state.cookies);
  await api.dispose();

  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

export async function createBrowserApi(page: Page): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_BASE_URL,
    storageState: await page.context().storageState(),
  });
}
