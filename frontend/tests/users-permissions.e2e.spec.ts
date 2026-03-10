import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { createBrowserApi, loginViaApi, type Credentials } from './support/auth';
type Permission = { code: string; name: string; category: string };

const ADMIN: Credentials = { email: 'admin@hospital.local', password: 'admin123' };
const SUFFIX = `${Date.now()}`;
const TEMP_USER = {
  email: `permissions-user-${SUFFIX}@hospital.local`,
  password: `Perms${SUFFIX}!`,
  firstName: 'Права',
  lastName: 'Проверка',
};

async function login(page: Page, creds: Credentials): Promise<void> {
  await loginViaApi(page, creds);
}

async function logout(page: Page): Promise<void> {
  await page.locator('button:has(.MuiAvatar-root)').first().click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
}

async function createApiClient(page: Page): Promise<APIRequestContext> {
  return createBrowserApi(page);
}

async function openUsers(page: Page): Promise<void> {
  await page.goto('/users');
  await page.waitForURL('**/users');
  await expect(page.getByRole('button', { name: 'Добавить пользователя' })).toBeVisible();
}

async function searchUserRow(page: Page, email: string) {
  const searchInput = page.getByPlaceholder('Поиск по ФИО, email, должности и отделению');
  await searchInput.fill(email);
  const row = page.locator('tr', { hasText: email }).first();
  await expect(row).toBeVisible();
  return row;
}

async function assertNoVisibleErrors(page: Page): Promise<void> {
  await expect(page.getByRole('alert')).toHaveCount(0);
}

test('admin can grant all permissions to one user without errors', async ({ page }) => {
  test.setTimeout(180_000);

  let adminApi: APIRequestContext | null = null;
  let createdUserId: string | null = null;

  try {
    await login(page, ADMIN);
    adminApi = await createApiClient(page);

    const permissionsResponse = await adminApi.get('users/permissions');
    expect(permissionsResponse.ok()).toBeTruthy();
    const permissionsBody = await permissionsResponse.json();
    const permissions = permissionsBody.data as Permission[];
    expect(permissions.length).toBeGreaterThan(0);

    await openUsers(page);
    await assertNoVisibleErrors(page);

    await page.getByRole('button', { name: 'Добавить пользователя' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Новый пользователь' });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Фамилия *').fill(TEMP_USER.lastName);
    await createDialog.getByLabel('Имя *').fill(TEMP_USER.firstName);
    await createDialog.getByLabel('Email *').fill(TEMP_USER.email);
    await createDialog.getByLabel('Пароль').fill(TEMP_USER.password);
    await createDialog.getByRole('button', { name: 'Создать' }).click();
    await expect(createDialog).toBeHidden();
    await assertNoVisibleErrors(page);

    const row = await searchUserRow(page, TEMP_USER.email);
    const createdUserResponse = await adminApi.get(`users?page=1&limit=20&search=${encodeURIComponent(TEMP_USER.email)}`);
    expect(createdUserResponse.ok()).toBeTruthy();
    const createdUserBody = await createdUserResponse.json();
    createdUserId = createdUserBody.data.find((user: { email: string }) => user.email === TEMP_USER.email)?.id ?? null;
    expect(createdUserId).toBeTruthy();

    await row.locator('button').nth(1).click();
    const editDialog = page.getByRole('dialog', { name: 'Редактировать пользователя' });
    await expect(editDialog).toBeVisible();

    for (const permission of permissions) {
      const checkbox = editDialog.getByRole('checkbox', { name: permission.name });
      await expect(checkbox).toBeVisible();
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
      }
    }

    await editDialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(editDialog).toBeHidden();
    await assertNoVisibleErrors(page);

    const updatedUserResponse = await adminApi.get(`users/${createdUserId}`);
    expect(updatedUserResponse.ok()).toBeTruthy();
    const updatedUserBody = await updatedUserResponse.json();
    expect([...updatedUserBody.data.permissions].sort()).toEqual(permissions.map((permission) => permission.code).sort());

    const reopenedRow = await searchUserRow(page, TEMP_USER.email);
    await reopenedRow.locator('button').nth(1).click();
    const reopenedDialog = page.getByRole('dialog', { name: 'Редактировать пользователя' });
    await expect(reopenedDialog).toBeVisible();
    for (const permission of permissions) {
      await expect(reopenedDialog.getByRole('checkbox', { name: permission.name })).toBeChecked();
    }
    await reopenedDialog.getByRole('button', { name: 'Отмена' }).click();
    await expect(reopenedDialog).toBeHidden();

    await logout(page);

    await login(page, { email: TEMP_USER.email, password: TEMP_USER.password });
    await assertNoVisibleErrors(page);

    const tempUserApi = await createApiClient(page);
    const gatedChecks: Array<{ path: string; expectedText: RegExp | string; endpoint?: string }> = [
      { path: '/', expectedText: 'Создать новость', endpoint: 'news' },
      { path: '/users', expectedText: 'Добавить пользователя', endpoint: 'users?page=1&limit=5' },
      { path: '/documents', expectedText: 'Новый тред', endpoint: 'documents/audience' },
      { path: '/tests', expectedText: 'Новый тест', endpoint: 'tests/audience' },
      { path: '/learning', expectedText: 'Новый материал', endpoint: 'learning/audience' },
    ];

    for (const check of gatedChecks) {
      await page.goto(check.path);
      await page.waitForURL(`**${check.path === '/' ? '/' : check.path}`);
      await expect(page.getByText(check.expectedText, { exact: false }).first()).toBeVisible({ timeout: 20000 });
      await assertNoVisibleErrors(page);

      if (check.endpoint) {
        const response = await tempUserApi.get(check.endpoint);
        expect(response.ok()).toBeTruthy();
      }
    }

    const newsCreate = await tempUserApi.post('news', {
      data: {
        title: `permissions-news-${SUFFIX}`,
        content: '<p>permission smoke</p>',
        isPinned: false,
        media: [],
      },
    });
    expect(newsCreate.ok()).toBeTruthy();
    const newsCreateBody = await newsCreate.json();
    await tempUserApi.delete(`news/${newsCreateBody.data.id}`);
    await tempUserApi.dispose();
  } finally {
    if (adminApi && createdUserId) {
      await adminApi.delete(`users/${createdUserId}`).catch(() => null);
    }
    await adminApi?.dispose();
  }
});
