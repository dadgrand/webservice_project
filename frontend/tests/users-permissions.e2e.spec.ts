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
const TEMP_DEPARTMENT = {
  name: `Отделение-${SUFFIX}`,
  updatedName: `Отделение-${SUFFIX}-обновлено`,
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

async function openDepartments(page: Page): Promise<void> {
  await openUsers(page);
  await page.getByRole('tab', { name: 'Отделения' }).click();
  await expect(page.getByRole('button', { name: 'Добавить отделение' })).toBeVisible();
}

async function searchUserRow(page: Page, email: string) {
  const searchInput = page.getByPlaceholder('Поиск по ФИО, email, должности и отделению');
  await searchInput.fill(email);
  const row = page.locator('tr', { hasText: email }).first();
  await expect(row).toBeVisible();
  return row;
}

async function searchDepartmentRow(page: Page, name: string) {
  const searchInput = page.getByPlaceholder('Поиск по названию, описанию, руководителю и родителю');
  await searchInput.fill(name);
  const row = page.locator('tr', { hasText: name }).first();
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

test('admin can manage departments from users page', async ({ page }) => {
  test.setTimeout(180_000);

  let adminApi: APIRequestContext | null = null;
  let createdDepartmentId: string | null = null;

  try {
    await login(page, ADMIN);
    adminApi = await createApiClient(page);

    await openDepartments(page);
    await assertNoVisibleErrors(page);

    await page.getByRole('button', { name: 'Добавить отделение' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Новое отделение' });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Название *').fill(TEMP_DEPARTMENT.name);
    await createDialog.getByLabel('Описание').fill('Тестовое отделение для e2e');
    await createDialog.getByRole('button', { name: 'Создать' }).click();
    await expect(createDialog).toBeHidden();
    await assertNoVisibleErrors(page);

    const createdRow = await searchDepartmentRow(page, TEMP_DEPARTMENT.name);
    const createdDepartmentsResponse = await adminApi.get('contacts/departments');
    expect(createdDepartmentsResponse.ok()).toBeTruthy();
    const createdDepartmentsBody = await createdDepartmentsResponse.json();
    createdDepartmentId =
      createdDepartmentsBody.data.find((department: { name: string }) => department.name === TEMP_DEPARTMENT.name)?.id ?? null;
    expect(createdDepartmentId).toBeTruthy();

    await createdRow.locator('button').nth(0).click();
    const editDialog = page.getByRole('dialog', { name: 'Редактировать отделение' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel('Название *').fill(TEMP_DEPARTMENT.updatedName);
    await editDialog.getByLabel('Порядок').fill('42');
    await editDialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(editDialog).toBeHidden();
    await assertNoVisibleErrors(page);

    await searchDepartmentRow(page, TEMP_DEPARTMENT.updatedName);
    const updatedDepartmentsResponse = await adminApi.get('contacts/departments');
    expect(updatedDepartmentsResponse.ok()).toBeTruthy();
    const updatedDepartmentsBody = await updatedDepartmentsResponse.json();
    const updatedDepartment = updatedDepartmentsBody.data.find(
      (department: { id: string; name: string; order: number }) => department.id === createdDepartmentId
    );
    expect(updatedDepartment?.name).toBe(TEMP_DEPARTMENT.updatedName);
    expect(updatedDepartment?.order).toBe(42);

    const deleteRow = await searchDepartmentRow(page, TEMP_DEPARTMENT.updatedName);
    await deleteRow.locator('button').nth(1).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Удалить отделение?' });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Удалить' }).click();
    await expect(deleteDialog).toBeHidden();
    await expect(page.locator('tr', { hasText: TEMP_DEPARTMENT.updatedName })).toHaveCount(0);
    await assertNoVisibleErrors(page);

    const deletedDepartmentsResponse = await adminApi.get('contacts/departments');
    expect(deletedDepartmentsResponse.ok()).toBeTruthy();
    const deletedDepartmentsBody = await deletedDepartmentsResponse.json();
    expect(
      deletedDepartmentsBody.data.some((department: { id: string }) => department.id === createdDepartmentId)
    ).toBeFalsy();
    createdDepartmentId = null;
  } finally {
    if (adminApi && createdDepartmentId) {
      await adminApi.delete(`contacts/departments/${createdDepartmentId}`).catch(() => null);
    }
    await adminApi?.dispose();
  }
});
