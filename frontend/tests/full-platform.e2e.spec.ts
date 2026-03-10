import { expect, request, test, type FilePayload, type Locator, type Page } from '@playwright/test';
import { createBrowserApi, loginViaApi, type Credentials } from './support/auth';

const ADMIN: Credentials = { email: 'admin@hospital.local', password: 'admin123' };
const PETROVA: Credentials = { email: 'petrova@hospital.local', password: 'user123' };

const RUNTIME = {
  suffix: `${Date.now()}`,
  messageSubject: '',
  testTitle: '',
  learningTitle: '',
  createdUserEmail: '',
  stageTextMarker: `stage-marker-${Date.now()}`,
  learningTextMarker: `learning-marker-${Date.now()}`,
};

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApMBgQn8vW4AAAAASUVORK5CYII=';

function makeAssets(): { [key: string]: FilePayload } {
  const suffix = RUNTIME.suffix;
  return {
    txt: {
      name: `smoke-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Smoke text file\n${RUNTIME.stageTextMarker}`, 'utf-8'),
    },
    csv: {
      name: `smoke-${suffix}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from('col1,col2\na,b\n', 'utf-8'),
    },
    json: {
      name: `smoke-${suffix}.json`,
      mimeType: 'application/json',
      buffer: Buffer.from('{"ok":true,"module":"smoke"}', 'utf-8'),
    },
    pdf: {
      name: `smoke-${suffix}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf-8'),
    },
    png: {
      name: `smoke-${suffix}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
    },
    mp4: {
      name: `smoke-${suffix}.mp4`,
      mimeType: 'video/mp4',
      buffer: Buffer.from('00000020667479706D703432000000006D70343269736F6D', 'hex'),
    },
    learningTxt: {
      name: `learning-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Learning file\n${RUNTIME.learningTextMarker}`, 'utf-8'),
    },
    messageTxt: {
      name: `message-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Message attachment ${suffix}`, 'utf-8'),
    },
  };
}

const ASSETS = makeAssets();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function login(page: Page, creds: Credentials): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Пароль').fill(creds.password);
  await page.getByRole('button', { name: 'Войти' }).click();

  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
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

test.describe('Full Platform UI + Backend Smoke', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin UI smoke: users, contacts, messages, org tree', async ({ page }) => {
    test.setTimeout(300_000);

    RUNTIME.createdUserEmail = `smoke-user-${RUNTIME.suffix}@hospital.local`;
    RUNTIME.messageSubject = `Smoke message ${RUNTIME.suffix}`;

    await login(page, ADMIN);

    // Users: CRUD + reset password buttons.
    await openModule(page, 'Пользователи', '/users', 'Управление пользователями');
    await page.getByPlaceholder('Поиск по ФИО, email, должности и отделению').fill('Петрова');
    await expect(page.locator('tr', { hasText: 'Петрова' }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Добавить пользователя' }).click();
    const userDialog = page.getByRole('dialog', { name: 'Новый пользователь' });
    await userDialog.getByLabel('Фамилия *').fill('Смоков');
    await userDialog.getByLabel('Имя *').fill('Тест');
    await userDialog.getByLabel('Email *').fill(RUNTIME.createdUserEmail);
    await userDialog.getByRole('button', { name: 'Создать' }).click();

    const generatedDialog = page.getByRole('dialog', { name: 'Пользователь создан' });
    await expect(generatedDialog).toBeVisible();
    await generatedDialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(generatedDialog).toBeHidden();

    await page.getByPlaceholder('Поиск по ФИО, email, должности и отделению').fill(RUNTIME.createdUserEmail);

    const userRow = page.locator('tr', { hasText: RUNTIME.createdUserEmail }).first();
    await expect(userRow).toBeVisible();

    // Reset password.
    await userRow.locator('button').nth(0).click();
    const resetDialog = page.getByRole('dialog', { name: 'Новый пароль' });
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(resetDialog).toBeHidden();

    // Delete user.
    await userRow.locator('button').nth(2).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Удалить пользователя?' });
    await deleteDialog.getByRole('button', { name: 'Удалить' }).click();
    await expect(page.locator('tr', { hasText: RUNTIME.createdUserEmail })).toHaveCount(0);

    // Contacts + compose message.
    await openModule(page, 'Контакты', '/contacts');
    await page.getByPlaceholder('Поиск по ФИО...').fill('Петрова');
    await page.getByRole('button', { name: /Петрова Мария/ }).first().click();
    await expect(page.getByRole('button', { name: 'Написать сообщение' })).toBeVisible();

    const favButton = page.getByRole('button', { name: /Избранное|В избранном/ }).first();
    await favButton.click();

    await page.getByRole('button', { name: 'Написать сообщение' }).click();
    const composeDialog = page.getByRole('dialog', { name: 'Новое сообщение' });
    await expect(composeDialog).toBeVisible();
    await composeDialog.getByLabel('Тема').fill(RUNTIME.messageSubject);
    const editor = composeDialog.locator('.ProseMirror').first();
    await editor.click();
    await editor.pressSequentially(`Сообщение автотеста ${RUNTIME.suffix}`);
    const messageFileInput = composeDialog.locator('input[type="file"]');
    await messageFileInput.setInputFiles(ASSETS.messageTxt);
    await messageFileInput.setInputFiles(ASSETS.png);
    await composeDialog.getByRole('button', { name: 'Отправить' }).click();
    await expect(composeDialog).toBeHidden();

    // Messages module buttons/functions.
    await openModule(page, 'Сообщения', '/messages');
    await page.getByRole('button', { name: 'Отправленные' }).click();
    await page.getByPlaceholder('Поиск сообщений...').fill(RUNTIME.messageSubject);
    await expect(page.getByText(RUNTIME.messageSubject).first()).toBeVisible({ timeout: 30000 });
    await page.getByText(RUNTIME.messageSubject).first().click();
    await expect(page.getByRole('heading', { name: RUNTIME.messageSubject })).toBeVisible();

    // Reply + Forward buttons from message view.
    await page.getByRole('button', { name: 'Ответить' }).first().click();
    const replyDialog = page.getByRole('dialog', { name: 'Новое сообщение' });
    await expect(replyDialog).toBeVisible();
    page.once('dialog', (dialog) => dialog.dismiss());
    await replyDialog.getByRole('button', { name: 'Отмена' }).click();

    await page.getByRole('button', { name: 'Переслать' }).first().click();
    const forwardDialog = page.getByRole('dialog', { name: 'Новое сообщение' });
    await expect(forwardDialog).toBeVisible();
    page.once('dialog', (dialog) => dialog.dismiss());
    await forwardDialog.getByRole('button', { name: 'Отмена' }).click();

    // Org tree: render + controls smoke.
    await openModule(page, 'Структура', '/org-tree');
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 30000 });
    await page.locator('.react-flow__controls button').first().click();
    await page.locator('.react-flow__controls button').nth(1).click();

    await logout(page);
  });

  test('admin UI smoke: tests module with mixed file formats', async ({ page }) => {
    test.setTimeout(300_000);

    RUNTIME.testTitle = `Smoke test ${RUNTIME.suffix}`;

    await login(page, ADMIN);
    await openModule(page, 'Тестирование', '/tests', 'Тестирование');

    await page.getByRole('button', { name: 'Новый тест' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Новый тест' });

    await createDialog.getByLabel('Название').fill(RUNTIME.testTitle);
    await createDialog.getByLabel('Описание').fill('Сквозной smoke тест для проверки UI/BE.');

    const assignAllSwitch = createDialog.getByLabel('Назначить всем пользователям');
    if (!(await assignAllSwitch.isChecked())) {
      await assignAllSwitch.click();
    }

    await createDialog.getByLabel('Название этапа').fill('Этап smoke');
    await createDialog.getByLabel('Формулировка вопроса').fill('Выберите правильный вариант ответа');

    const optionTextFields = createDialog.getByLabel('Текст варианта');
    await optionTextFields.nth(0).fill('Вариант A');
    await optionTextFields.nth(1).fill('Вариант B');
    await createDialog.locator('input[type="radio"]').first().check();

    await uploadViaFileChooser(page, createDialog.getByRole('button', { name: 'Загрузить файлы' }).first(), [
      ASSETS.txt,
      ASSETS.csv,
      ASSETS.json,
      ASSETS.pdf,
      ASSETS.png,
      ASSETS.mp4,
    ]);

    await expect(createDialog.getByText(ASSETS.txt.name)).toBeVisible();
    await expect(createDialog.getByText(ASSETS.mp4.name)).toBeVisible();

    await uploadViaFileChooser(page, createDialog.getByRole('button', { name: 'Медиа' }).first(), ASSETS.png);
    await expect(createDialog.getByRole('button', { name: 'Убрать медиа' }).first()).toBeVisible();

    await createDialog.getByRole('button', { name: 'Создать тест' }).click();
    await expect(createDialog).toBeHidden();

    await page.getByPlaceholder('Поиск тестов...').fill(RUNTIME.testTitle);
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(RUNTIME.testTitle)) }).first()).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: new RegExp(escapeRegExp(RUNTIME.testTitle)) }).first().click();

    await expect(page.getByRole('heading', { name: RUNTIME.testTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Начать тест' }).click();

    await expect(page.getByText('Режим прохождения: окно нельзя закрыть без автосдачи.')).toBeVisible({ timeout: 30000 });

    const markerText = page.getByText(RUNTIME.stageTextMarker).first();
    if (await markerText.isVisible().catch(() => false)) {
      await markerText.click();
      await expect(page.getByRole('button', { name: 'Закрыть' }).last()).toBeVisible();
      await page.getByRole('button', { name: 'Закрыть' }).last().click();
    }

    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Завершить тест' }).click();
    await expect(page.getByText(/Результат:/)).toBeVisible({ timeout: 30000 });

    await logout(page);
  });

  test('learning module smoke + cross-user visibility', async ({ page }) => {
    test.setTimeout(300_000);

    RUNTIME.learningTitle = `Smoke learning ${RUNTIME.suffix}`;

    await login(page, ADMIN);
    await openModule(page, 'Обучение', '/learning', 'Обучение');

    await page.getByRole('button', { name: 'Новый материал' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Новый обучающий материал' });

    await createDialog.getByLabel('Название').fill(RUNTIME.learningTitle);
    await createDialog.getByLabel('Описание').fill('Smoke material created by automated test');

    await createDialog.getByLabel('Тип материала').click();
    await page.getByRole('option', { name: 'Многостраничный' }).click();

    const assignAllSwitch = createDialog.getByLabel('Назначить всем пользователям');
    if (!(await assignAllSwitch.isChecked())) {
      await assignAllSwitch.click();
    }

    await createDialog.getByLabel('Заголовок страницы').nth(0).fill('Страница 1 smoke');
    await createDialog.getByLabel('Текст / контент страницы').nth(0).fill(`Контент страницы 1\n${RUNTIME.learningTextMarker}`);

    await createDialog.getByRole('button', { name: 'Добавить страницу' }).click();
    await createDialog.getByLabel('Заголовок страницы').nth(1).fill('Страница 2 smoke');
    await createDialog.getByLabel('Текст / контент страницы').nth(1).fill('Контент страницы 2');

    await uploadViaFileChooser(page, createDialog.getByRole('button', { name: 'Загрузить файлы' }).first(), [
      ASSETS.learningTxt,
      ASSETS.pdf,
      ASSETS.png,
      ASSETS.mp4,
      ASSETS.json,
    ]);

    await expect(createDialog.getByText(ASSETS.learningTxt.name)).toBeVisible();
    await createDialog.getByRole('button', { name: 'Создать материал' }).click();
    await expect(createDialog).toBeHidden();

    await page.getByPlaceholder('Поиск материалов...').fill(RUNTIME.learningTitle);
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(RUNTIME.learningTitle)) }).first()).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: new RegExp(escapeRegExp(RUNTIME.learningTitle)) }).first().click();

    await expect(page.getByRole('heading', { name: RUNTIME.learningTitle })).toBeVisible();

    const learningMarker = page.getByText(RUNTIME.learningTextMarker).first();
    if (await learningMarker.isVisible().catch(() => false)) {
      await learningMarker.click();
      await expect(page.getByRole('button', { name: 'Закрыть' }).last()).toBeVisible();
      await page.getByRole('button', { name: 'Закрыть' }).last().click();
    }

    await page.getByRole('tab', { name: 'Страница 2 smoke' }).click();
    await expect(page.getByText('Контент страницы 2')).toBeVisible();

    await logout(page);

    // Recipient user checks delivery and visibility.
    await login(page, PETROVA);

    await openModule(page, 'Сообщения', '/messages');
    await page.getByRole('button', { name: 'Входящие' }).click();
    await page.getByPlaceholder('Поиск сообщений...').fill(RUNTIME.messageSubject);
    await expect(page.getByText(RUNTIME.messageSubject).first()).toBeVisible({ timeout: 30000 });

    await openModule(page, 'Тестирование', '/tests', 'Тестирование');
    await page.getByPlaceholder('Поиск тестов...').fill(RUNTIME.testTitle);
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(RUNTIME.testTitle)) }).first()).toBeVisible({ timeout: 30000 });

    await openModule(page, 'Обучение', '/learning', 'Обучение');
    await page.getByPlaceholder('Поиск материалов...').fill(RUNTIME.learningTitle);
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(RUNTIME.learningTitle)) }).first()).toBeVisible({ timeout: 30000 });

    await logout(page);
  });

  test('backend API smoke: core endpoints + uploads', async ({ page }) => {
    test.setTimeout(240_000);

    await login(page, ADMIN);
    const api = await createApiClient(page);
    await logout(page);
    const publicApi = await request.newContext({ baseURL: 'http://localhost:3001/api/' });

    // Health + base listings.
    const health = await publicApi.get('health');
    expect(health.ok()).toBeTruthy();

    const usersResp = await api.get('users?page=1&limit=20');
    expect(usersResp.ok()).toBeTruthy();
    const usersBody = await usersResp.json();
    expect(Array.isArray(usersBody.data)).toBeTruthy();

    const contactsResp = await api.get('contacts?page=1&limit=20');
    expect(contactsResp.ok()).toBeTruthy();

    const foldersResp = await api.get('messages/folders');
    expect(foldersResp.ok()).toBeTruthy();

    const orgResp = await api.get('org-tree');
    expect(orgResp.ok()).toBeTruthy();

    const docsResp = await api.get('documents/threads');
    expect(docsResp.ok()).toBeTruthy();

    const testsResp = await api.get('tests');
    expect(testsResp.ok()).toBeTruthy();

    const learningResp = await api.get('learning');
    expect(learningResp.ok()).toBeTruthy();

    // Create/update/reset/delete user.
    const tempEmail = `api-user-${RUNTIME.suffix}@hospital.local`;
    const createUserResp = await api.post('users', {
      data: {
        email: tempEmail,
        firstName: 'API',
        lastName: 'Smoke',
        isAdmin: false,
      },
    });
    expect(createUserResp.ok()).toBeTruthy();
    const createUserBody = await createUserResp.json();
    const tempUserId = createUserBody.data.id as string;

    const resetResp = await api.post(`users/${tempUserId}/reset-password`);
    expect(resetResp.ok()).toBeTruthy();

    const updateResp = await api.put(`users/${tempUserId}`, {
      data: {
        position: 'API QA',
        isActive: true,
      },
    });
    expect(updateResp.ok()).toBeTruthy();

    const deleteResp = await api.delete(`users/${tempUserId}`);
    expect(deleteResp.ok()).toBeTruthy();

    // Messages draft + attachment + send.
    const uploadMessageAttachment = await api.post('messages/attachments', {
      multipart: {
        file: {
          name: `api-msg-${RUNTIME.suffix}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from('api message attachment', 'utf-8'),
        },
      },
    });
    expect(uploadMessageAttachment.ok()).toBeTruthy();
    const attachmentBody = await uploadMessageAttachment.json();
    const attachment = attachmentBody.data;

    const contactsBody = await contactsResp.json();
    const recipient = (contactsBody.data as Array<{ id: string; email: string }>).find((c) => c.email === PETROVA.email);
    expect(recipient).toBeTruthy();

    const sendResp = await api.post('messages', {
      data: {
        subject: `API smoke subject ${RUNTIME.suffix}`,
        content: '<p>API smoke content</p>',
        recipientIds: [recipient!.id],
        attachments: [attachment],
      },
    });
    expect(sendResp.ok()).toBeTruthy();

    const draftCreateResp = await api.post('messages/drafts', {
      data: {
        subject: `API draft ${RUNTIME.suffix}`,
        content: 'Draft content',
      },
    });
    expect(draftCreateResp.ok()).toBeTruthy();
    const draftBody = await draftCreateResp.json();
    const draftId = draftBody.data.id as string;

    const draftUpdateResp = await api.put(`messages/drafts/${draftId}`, {
      data: { content: 'Draft updated' },
    });
    expect(draftUpdateResp.ok()).toBeTruthy();

    const draftDeleteResp = await api.delete(`messages/drafts/${draftId}`);
    expect(draftDeleteResp.ok()).toBeTruthy();

    // Org tree create/delete.
    const orgCreateResp = await api.post('org-tree/nodes', {
      data: {
        type: 'custom',
        customTitle: `API NODE ${RUNTIME.suffix}`,
      },
    });
    expect(orgCreateResp.ok()).toBeTruthy();
    const orgCreateBody = await orgCreateResp.json();
    const nodeId = orgCreateBody.data.id as string;

    const orgDeleteResp = await api.delete(`org-tree/nodes/${nodeId}`);
    expect(orgDeleteResp.ok()).toBeTruthy();

    // Tests upload + create + fetch.
    const testUploadResp = await api.post('tests/uploads', {
      multipart: {
        file: {
          name: `api-test-${RUNTIME.suffix}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from('api test media', 'utf-8'),
        },
      },
    });
    expect(testUploadResp.ok()).toBeTruthy();
    const testUploadBody = await testUploadResp.json();
    const testFile = testUploadBody.data;

    const apiTestTitle = `API test ${RUNTIME.suffix}`;
    const apiTestCreateResp = await api.post('tests', {
      data: {
        title: apiTestTitle,
        description: 'API smoke test',
        assignToAll: true,
        isPublished: true,
        questions: [
          {
            stageTitle: 'Stage 1',
            question: '2 + 2 = ? ',
            questionType: 'single',
            points: 1,
            media: [testFile],
            options: [
              { id: `opt-a-${RUNTIME.suffix}`, text: '4', image: null },
              { id: `opt-b-${RUNTIME.suffix}`, text: '5', image: null },
            ],
            correctOptionIds: [`opt-a-${RUNTIME.suffix}`],
          },
        ],
      },
    });
    expect(apiTestCreateResp.ok()).toBeTruthy();
    const apiTestCreateBody = await apiTestCreateResp.json();
    const apiTestId = apiTestCreateBody.data.id as string;

    const apiTestDetail = await api.get(`tests/${apiTestId}`);
    expect(apiTestDetail.ok()).toBeTruthy();

    // Learning upload + create + detail + visit.
    const learningUploadResp = await api.post('learning/uploads', {
      multipart: {
        file: {
          name: `api-learning-${RUNTIME.suffix}.txt`,
          mimeType: 'text/plain',
          buffer: Buffer.from('api learning file', 'utf-8'),
        },
      },
    });
    expect(learningUploadResp.ok()).toBeTruthy();
    const learningUploadBody = await learningUploadResp.json();
    const learningFile = learningUploadBody.data;

    const apiLearningCreateResp = await api.post('learning', {
      data: {
        title: `API learning ${RUNTIME.suffix}`,
        description: 'API learning material',
        materialType: 'single_page',
        assignToAll: true,
        isPublished: true,
        pages: [
          {
            title: 'API page',
            content: 'Learning content',
            order: 0,
            files: [learningFile],
          },
        ],
      },
    });
    expect(apiLearningCreateResp.ok()).toBeTruthy();
    const apiLearningBody = await apiLearningCreateResp.json();
    const learningId = apiLearningBody.data.id as string;

    const learningDetailResp = await api.get(`learning/${learningId}`);
    expect(learningDetailResp.ok()).toBeTruthy();
    const learningDetailBody = await learningDetailResp.json();
    const firstPageId = learningDetailBody.data.pages[0]?.id as string | undefined;

    const visitResp = await api.post(`learning/${learningId}/visit`, {
      data: {
        pageId: firstPageId,
      },
    });
    expect(visitResp.ok()).toBeTruthy();

    await api.dispose();
    await publicApi.dispose();
  });
});
