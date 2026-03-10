import { chromium, request } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ baseURL: 'http://localhost:5173' });
await page.goto('/login');
await page.getByLabel('Email').fill('admin@hospital.local');
await page.getByLabel('Пароль').fill('admin123');
await page.getByRole('button', { name: 'Войти' }).click();
await page.getByRole('button', { name: 'Документы' }).waitFor();
const token = await page.evaluate(() => localStorage.getItem('token'));
console.log('token?', !!token, token?.slice(0, 30));
const api = await request.newContext({
  baseURL: 'http://localhost:3001/api',
  extraHTTPHeaders: {
    Authorization: `Bearer ${token}`,
  },
});
const resp = await api.get('documents/threads');
console.log('status', resp.status());
console.log(await resp.text());
await api.dispose();
await browser.close();
