import { expect, request, test, type FilePayload, type Locator, type Page } from '@playwright/test';
import { createBrowserApi, loginViaApi, type Credentials } from './support/auth';

const ADMIN: Credentials = { email: 'admin@hospital.local', password: 'admin123' };
const PETROVA: Credentials = { email: 'petrova@hospital.local', password: 'user123' };
const SUFFIX = `${Date.now()}`;

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgQn8vW4AAAAASUVORK5CYII=';

const ASSETS: Record<string, FilePayload> = {
  txt: {
    name: `split-${SUFFIX}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from(`split smoke ${SUFFIX}`, 'utf-8'),
  },
  pdf: {
    name: `split-${SUFFIX}.pdf`,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8'),
  },
  png: {
    name: `split-${SUFFIX}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function login(page: Page, creds: Credentials): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Пароль').fill(creds.password);
  await page.getByRole('button', { name: 'Войти' }).click();

  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  } catch {
    await loginViaApi(page, creds);
  }
}

async function logout(page: Page): Promise<void> {
  await page.locator('button:has(.MuiAvatar-root)').first().click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function openModule(page: Page, menuName: string, route: string, heading?: string): Promise<void> {
  const menuButton = page.getByRole('button', { name: new RegExp(`^${escapeRegExp(menuName)}$`) }).first();
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  } else {
    await page.goto(route);
  }
  await page.waitForURL(`**${route}`);
  if (heading) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
}

async function uploadViaFileChooser(page: Page, trigger: Locator, files: FilePayload | FilePayload[]): Promise<void> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), trigger.click()]);
  await chooser.setFiles(files);
}

async function createApiClient(page: Page) {
  return createBrowserApi(page);
}

test('users: create/reset/delete', async ({ page }) => {
  test.setTimeout(120_000);

  const email = `split-user-${SUFFIX}@hospital.local`;

  await login(page, ADMIN);
  await openModule(page, 'Пользователи', '/users', 'Управление пользователями');

  await page.getByRole('button', { name: 'Добавить пользователя' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Новый пользователь' });
  await createDialog.getByLabel('Фамилия *').fill('Сплитов');
  await createDialog.getByLabel('Имя *').fill('Тест');
  await createDialog.getByLabel('Email *').fill(email);
  await createDialog.getByRole('button', { name: 'Создать' }).click();

  const generatedDialog = page.getByRole('dialog', { name: 'Пользователь создан' });
  await expect(generatedDialog).toBeVisible();
  await generatedDialog.getByRole('button', { name: 'Закрыть' }).click();
  await expect(generatedDialog).toBeHidden();

  await page.getByPlaceholder('Поиск по ФИО, email, должности и отделению').fill(email);

  const row = page.locator('tr', { hasText: email }).first();
  await expect(row).toBeVisible();

  await row.locator('button').nth(1).click();
  const editDialog = page.getByRole('dialog', { name: 'Редактировать пользователя' });
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole('textbox', { name: 'Должность' }).fill('split-role');
  await editDialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(editDialog).toBeHidden();

  await row.locator('button').nth(0).click();
  const resetDialog = page.getByRole('dialog', { name: 'Новый пароль' });
  await expect(resetDialog).toBeVisible();
  await resetDialog.getByRole('button', { name: 'Закрыть' }).click();
  await expect(resetDialog).toBeHidden();

  await row.locator('button').nth(2).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Удалить пользователя?' });
  await deleteDialog.getByRole('button', { name: 'Удалить' }).click();
  await expect(page.locator('tr', { hasText: email })).toHaveCount(0);

  await logout(page);
});

test('contacts/messages: send and receive', async ({ page }) => {
  test.setTimeout(120_000);

  const subject = `split-message-${SUFFIX}`;

  await login(page, ADMIN);
  await openModule(page, 'Контакты', '/contacts');

  await page.getByPlaceholder('Поиск по ФИО...').fill('Петрова');
  await page.getByRole('button', { name: /Петрова Мария/ }).first().click();
  await page.getByRole('button', { name: 'Написать сообщение' }).click();

  const composeDialog = page.getByRole('dialog', { name: 'Новое сообщение' });
  await composeDialog.getByLabel('Тема').fill(subject);
  const editor = composeDialog.locator('.ProseMirror').first();
  await editor.click();
  await editor.pressSequentially(`split message body ${SUFFIX}`);
  await composeDialog.locator('input[type="file"]').setInputFiles(ASSETS.txt);
  await composeDialog.getByRole('button', { name: 'Отправить' }).click();
  await expect(composeDialog).toBeHidden();

  await openModule(page, 'Сообщения', '/messages');
  await page.getByRole('button', { name: 'Отправленные' }).click();
  await page.getByPlaceholder('Поиск сообщений...').fill(subject);
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 20000 });

  await logout(page);

  await login(page, PETROVA);
  await openModule(page, 'Сообщения', '/messages');
  await page.getByRole('button', { name: 'Входящие' }).click();
  await page.getByPlaceholder('Поиск сообщений...').fill(subject);
  await expect(page.getByText(subject).first()).toBeVisible({ timeout: 20000 });
  await logout(page);
});

test('org tree: load and controls', async ({ page }) => {
  test.setTimeout(90_000);

  await login(page, ADMIN);
  await openModule(page, 'Структура', '/org-tree');
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.react-flow__controls button')).toHaveCount(4);
  await expect(page.locator('.react-flow__controls button').first()).toBeDisabled();
  await logout(page);
});

test('tests module: create and pass', async ({ page }) => {
  test.setTimeout(150_000);

  const testTitle = `split-test-${SUFFIX}`;

  await login(page, ADMIN);
  await openModule(page, 'Тестирование', '/tests', 'Тестирование');

  await page.getByRole('button', { name: 'Новый тест' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новый тест' });

  await dialog.getByRole('textbox', { name: 'Название', exact: true }).fill(testTitle);
  await dialog.getByRole('textbox', { name: 'Описание', exact: true }).fill('split smoke test');

  const assignAll = dialog.getByLabel('Назначить всем пользователям');
  if (!(await assignAll.isChecked())) {
    await assignAll.click();
  }

  await dialog.getByLabel('Название этапа').fill('split stage');
  await dialog.getByLabel('Формулировка вопроса').fill('2 + 2 = ?');
  const optionFields = dialog.getByLabel('Текст варианта');
  await optionFields.nth(0).fill('4');
  await optionFields.nth(1).fill('5');
  await dialog.locator('input[type="radio"]').first().check();

  await uploadViaFileChooser(page, dialog.getByRole('button', { name: 'Загрузить файлы' }).first(), [ASSETS.txt, ASSETS.pdf]);
  await expect(dialog.getByText(ASSETS.txt.name)).toBeVisible();

  await dialog.getByRole('button', { name: 'Создать тест' }).click();
  await expect(dialog).toBeHidden();

  await page.getByPlaceholder('Поиск тестов...').fill(testTitle);
  await page.getByRole('button', { name: new RegExp(escapeRegExp(testTitle)) }).first().click();

  await page.getByRole('button', { name: 'Начать тест' }).click();
  await expect(page.getByText('Режим прохождения: окно нельзя закрыть без автосдачи.')).toBeVisible({ timeout: 20000 });
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Завершить тест' }).click();
  await expect(page.getByText(/Результат:/)).toBeVisible({ timeout: 20000 });

  await logout(page);
});

test('learning module: create and open', async ({ page }) => {
  test.setTimeout(150_000);

  const materialTitle = `split-learning-${SUFFIX}`;
  const marker = `learning-content-${SUFFIX}`;

  await login(page, ADMIN);
  await openModule(page, 'Обучение', '/learning', 'Обучение');

  await page.getByRole('button', { name: 'Новый материал' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новый обучающий материал' });

  await dialog.getByRole('textbox', { name: 'Название', exact: true }).fill(materialTitle);
  await dialog.getByRole('textbox', { name: 'Описание', exact: true }).fill('split learning material');

  const assignAll = dialog.getByLabel('Назначить всем пользователям');
  if (!(await assignAll.isChecked())) {
    await assignAll.click();
  }

  await dialog.getByLabel('Заголовок страницы').first().fill('split page');
  await dialog.getByLabel('Текст / контент страницы').first().fill(marker);

  await uploadViaFileChooser(page, dialog.getByRole('button', { name: 'Загрузить файлы' }).first(), [ASSETS.txt, ASSETS.png]);
  await expect(dialog.getByText(ASSETS.txt.name)).toBeVisible();

  await dialog.getByRole('button', { name: 'Создать материал' }).click();
  await expect(dialog).toBeHidden();

  await page.getByPlaceholder('Поиск материалов...').fill(materialTitle);
  await page.getByRole('button', { name: new RegExp(escapeRegExp(materialTitle)) }).first().click();
  await expect(page.getByRole('heading', { name: materialTitle })).toBeVisible();
  await expect(page.getByText(marker)).toBeVisible();

  await logout(page);

  await login(page, PETROVA);
  await openModule(page, 'Обучение', '/learning', 'Обучение');
  await page.getByPlaceholder('Поиск материалов...').fill(materialTitle);
  await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(materialTitle)) }).first()).toBeVisible({ timeout: 20000 });
  await logout(page);
});

test('backend api: core endpoints and uploads', async ({ page }) => {
  test.setTimeout(150_000);

  await login(page, ADMIN);
  const api = await createApiClient(page);
  await logout(page);
  const publicApi = await request.newContext({ baseURL: 'http://localhost:3001/api/' });

  const health = await publicApi.get('health');
  expect(health.ok()).toBeTruthy();

  expect((await api.get('users?page=1&limit=10')).ok()).toBeTruthy();
  expect((await api.get('contacts?page=1&limit=10')).ok()).toBeTruthy();
  expect((await api.get('messages/folders')).ok()).toBeTruthy();
  expect((await api.get('org-tree')).ok()).toBeTruthy();
  expect((await api.get('documents/threads')).ok()).toBeTruthy();
  expect((await api.get('tests')).ok()).toBeTruthy();
  expect((await api.get('learning')).ok()).toBeTruthy();

  const uploadMessage = await api.post('messages/attachments', {
    multipart: { file: ASSETS.txt },
  });
  expect(uploadMessage.ok()).toBeTruthy();

  const uploadTest = await api.post('tests/uploads', {
    multipart: { file: ASSETS.pdf },
  });
  expect(uploadTest.ok()).toBeTruthy();

  const uploadLearning = await api.post('learning/uploads', {
    multipart: { file: ASSETS.png },
  });
  expect(uploadLearning.ok()).toBeTruthy();

  const userEmail = `split-api-user-${SUFFIX}@hospital.local`;
  const createUser = await api.post('users', {
    data: { email: userEmail, firstName: 'API', lastName: 'Split', isAdmin: false },
  });
  expect(createUser.ok()).toBeTruthy();
  const createUserBody = await createUser.json();
  const userId = createUserBody.data.user.id as string;

  expect((await api.post(`users/${userId}/reset-password`)).ok()).toBeTruthy();
  expect((await api.delete(`users/${userId}`)).ok()).toBeTruthy();

  const nodeCreate = await api.post('org-tree/nodes', {
    data: { type: 'custom', customTitle: `API SPLIT ${SUFFIX}` },
  });
  expect(nodeCreate.ok()).toBeTruthy();
  const nodeBody = await nodeCreate.json();
  expect((await api.delete(`org-tree/nodes/${nodeBody.data.id}`)).ok()).toBeTruthy();

  const draftCreate = await api.post('messages/drafts', {
    data: { subject: `split draft ${SUFFIX}`, content: 'draft content' },
  });
  expect(draftCreate.ok()).toBeTruthy();
  const draftBody = await draftCreate.json();
  const draftId = draftBody.data.id as string;
  expect((await api.put(`messages/drafts/${draftId}`, { data: { content: 'updated' } })).ok()).toBeTruthy();
  expect((await api.delete(`messages/drafts/${draftId}`)).ok()).toBeTruthy();

  await api.dispose();
  await publicApi.dispose();
});
