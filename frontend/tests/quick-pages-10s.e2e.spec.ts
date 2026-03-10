import { expect, test, type Page } from '@playwright/test';
import { loginViaApi, type Credentials } from './support/auth';

const ADMIN: Credentials = { email: 'admin@hospital.local', password: 'admin123' };

async function openRoute(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForURL(`**${route}`);
}

async function expectNoGlobalScroll(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    window.scrollTo(0, 99999);
    return {
      y: window.scrollY,
      docHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    };
  });

  expect(metrics.y).toBe(0);
  expect(metrics.docHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
}

test.describe('Quick 10s Smoke Across Pages', () => {
  test('dashboard', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/');
    await expect(page.getByText('Добро пожаловать,')).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });

  test('users', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/users');
    await expect(page.getByRole('heading', { name: 'Управление пользователями' })).toBeVisible({ timeout: 4000 });
    await expect(page.getByPlaceholder('Поиск по ФИО, email, должности и отделению')).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });

  test('contacts (internal list scroll)', async ({ page }) => {
    test.setTimeout(10_000);
    await page.setViewportSize({ width: 1200, height: 560 });
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/contacts');
    await expect(page.getByPlaceholder('Поиск по ФИО...')).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);

    const listScrollCheck = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="contacts-sidebar-list"]');
      if (!(list instanceof HTMLElement)) {
        return { found: false, canScroll: false, hasOverflow: false, moved: false };
      }

      const overflowY = getComputedStyle(list).overflowY;
      const canScroll = overflowY === 'auto' || overflowY === 'scroll';
      const hasOverflow = list.scrollHeight > list.clientHeight + 1;
      const before = list.scrollTop;
      list.scrollTop = before + 140;

      return {
        found: true,
        canScroll,
        hasOverflow,
        moved: list.scrollTop > before,
      };
    });

    expect(listScrollCheck.found).toBeTruthy();
    expect(listScrollCheck.canScroll).toBeTruthy();
    if (listScrollCheck.hasOverflow) {
      expect(listScrollCheck.moved).toBeTruthy();
    }
  });

  test('messages', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/messages');
    await expect(page.getByRole('button', { name: 'Написать' })).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });

  test('org tree', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/org-tree');
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });

  test('documents', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/documents');
    await expect(page.getByRole('heading', { name: 'Документы' })).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });

  test('tests page', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/tests');
    await expect(page.getByRole('heading', { name: 'Тестирование' })).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });

  test('learning page', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/learning');
    await expect(page.getByRole('heading', { name: 'Обучение' })).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });

  test('settings page', async ({ page }) => {
    test.setTimeout(10_000);
    await loginViaApi(page, ADMIN);
    await openRoute(page, '/settings');
    await expect(page.getByRole('heading', { name: 'Настройки профиля' })).toBeVisible({ timeout: 4000 });
    await expectNoGlobalScroll(page);
  });
});
