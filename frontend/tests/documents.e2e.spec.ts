import { expect, test, type Locator, type Page } from '@playwright/test';
import { createBrowserApi, loginViaApi, type Credentials } from './support/auth';

const ADMIN: Credentials = { email: 'admin@hospital.local', password: 'admin123' };
const PETROVA: Credentials = { email: 'petrova@hospital.local', password: 'user123' };
const KOZLOVA: Credentials = { email: 'kozlova@hospital.local', password: 'user123' };
const NOVIKOV: Credentials = { email: 'novikov@hospital.local', password: 'user123' };

const created: {
  titlePrefix: string;
  distributionThreadId?: string;
  distributionFileId?: string;
  approvalThreadId?: string;
  approvalFileId?: string;
  departmentThreadId?: string;
  departmentFileId?: string;
} = {
  titlePrefix: `e2e-doc-${Date.now()}`,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function threadListItem(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(escapeRegExp(title)) }).first();
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

async function openDocuments(page: Page): Promise<void> {
  const documentsButton = page.getByRole('button', { name: 'Документы' });
  if (await documentsButton.isVisible().catch(() => false)) {
    await documentsButton.click();
  } else {
    await page.goto('/documents');
  }
  await page.waitForURL('**/documents');
  await expect(page.getByRole('heading', { name: 'Документы' })).toBeVisible();
}

async function chooseSelectOption(page: Page, container: Page | Locator, label: string, option: string): Promise<void> {
  await container.getByLabel(label).click();
  await page.getByRole('option', { name: option }).click();
}

async function findThreadByTitle(page: Page, title: string): Promise<{ id: string; fileId: string }> {
  const api = await createBrowserApi(page);
  let thread: { id: string; title: string } | undefined;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const listResp = await api.get('documents/threads');
    expect(listResp.ok()).toBeTruthy();
    const listBody = await listResp.json();
    thread = (listBody.data as Array<{ id: string; title: string }>).find((item) => item.title === title);
    if (thread) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  expect(thread).toBeTruthy();

  const threadResp = await api.get(`documents/threads/${thread!.id}`);
  expect(threadResp.ok()).toBeTruthy();
  const threadBody = await threadResp.json();
  const activeFile = (threadBody.data.files as Array<{ id: string; isActive: boolean }>).find((f) => f.isActive);
  expect(activeFile).toBeTruthy();

  await api.dispose();
  return { id: thread!.id, fileId: activeFile!.id };
}

test.describe('Documents Module Chromium E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin: create threads and exercise all main buttons in Documents', async ({ page }) => {
    await login(page, ADMIN);
    await openDocuments(page);

    // Refresh + filters buttons
    await page.getByRole('button', { name: 'Обновить' }).click();
    await page.getByRole('button', { name: 'Применить фильтры' }).click();

    const distributionTitle = `${created.titlePrefix}-distribution`;
    await page.getByRole('button', { name: 'Новый тред' }).click();
    await expect(page.getByRole('dialog', { name: 'Новый тред документов' })).toBeVisible();

    const createDialog = page.getByRole('dialog', { name: 'Новый тред документов' });
    await createDialog.getByLabel('Название треда').fill(distributionTitle);
    await createDialog.getByLabel('Описание').fill('Distribution e2e thread');

    await createDialog.getByLabel('Получатели').click();
    await createDialog.getByLabel('Получатели').fill('Петрова');
    await page.getByRole('option', { name: /Петрова Мария/ }).click();

    await createDialog.locator('input[type="file"]').setInputFiles([
      {
        name: 'dist-a.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('distribution alpha', 'utf-8'),
      },
      {
        name: 'dist-b.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('col1,col2\na,b\n', 'utf-8'),
      },
    ]);

    await createDialog.getByRole('button', { name: 'Создать тред' }).click();
    await expect(page.getByRole('dialog', { name: 'Новый тред документов' })).toBeHidden();

    await expect(threadListItem(page, distributionTitle)).toBeVisible();

    // Click file card -> metadata dialog with actions
    const firstFileCard = page.locator('[data-testid^="document-file-card-"]').first();
    await firstFileCard.click();
    await expect(page.getByRole('dialog', { name: 'Метаданные файла' })).toBeVisible();

    // Open preview from metadata dialog
    await page.getByRole('button', { name: 'Открыть' }).click();
    const previewDialog = page.getByRole('dialog').filter({ hasText: 'Закрыть' }).last();
    await expect(previewDialog).toBeVisible();

    const previewBox = await previewDialog.boundingBox();
    expect(previewBox).not.toBeNull();
    expect((previewBox?.width || 0) > 1200).toBeTruthy();
    expect((previewBox?.height || 0) > 800).toBeTruthy();
    await previewDialog.getByRole('button', { name: 'Закрыть' }).click();

    const downloadFromMetadata = page.waitForResponse((resp) => resp.url().includes('/documents/threads/') && resp.url().includes('/download') && resp.status() === 200);
    await page.getByRole('dialog', { name: 'Метаданные файла' }).getByRole('button', { name: 'Скачать' }).click();
    await downloadFromMetadata;
    await page.getByRole('button', { name: 'Закрыть' }).click();

    // Eye button opens fullscreen preview
    const eyeButton = page.locator('button[aria-label^="Предпросмотр "]').first();
    await eyeButton.click();
    const fullPreviewDialog = page.getByRole('dialog').filter({ hasText: 'Закрыть' }).last();
    await expect(fullPreviewDialog).toBeVisible();
    await fullPreviewDialog.getByRole('button', { name: 'Закрыть' }).click();

    // Delete one active file -> should create new version with one file
    page.once('dialog', (d) => d.accept());
    await page.locator('button[aria-label^="Удалить "]').first().click();
    await expect(page.getByTestId('document-version-2')).toBeVisible();
    await page.getByTestId('document-version-2').click();
    await expect(page.locator('[data-testid^="document-file-card-"]')).toHaveCount(1);

    // Add file to thread -> create next version preserving remaining previous files
    await page.getByRole('button', { name: 'Добавить файлы' }).locator('input[type="file"]').setInputFiles([
      {
        name: 'dist-c.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('distribution gamma', 'utf-8'),
      },
    ]);

    await expect(page.getByTestId('document-version-3')).toBeVisible();
    await page.getByTestId('document-version-3').click();
    await expect(page.locator('[data-testid^="document-file-card-"]')).toHaveCount(2);

    const distributionRef = await findThreadByTitle(page, distributionTitle);
    created.distributionThreadId = distributionRef.id;
    created.distributionFileId = distributionRef.fileId;

    // Approval thread creation
    const approvalTitle = `${created.titlePrefix}-approval`;
    await page.getByRole('button', { name: 'Новый тред' }).click();
    const approvalDialog = page.getByRole('dialog', { name: 'Новый тред документов' });
    await approvalDialog.getByLabel('Название треда').fill(approvalTitle);
    await approvalDialog.getByLabel('Описание').fill('Approval e2e thread');
    await chooseSelectOption(page, approvalDialog, 'Режим', 'Согласование');
    await approvalDialog.getByLabel('Получатели').click();
    await approvalDialog.getByLabel('Получатели').fill('Петрова');
    await page.getByRole('option', { name: /Петрова Мария/ }).click();
    await approvalDialog.locator('input[type="file"]').setInputFiles([
      {
        name: 'approval-a.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('approval content', 'utf-8'),
      },
    ]);
    await approvalDialog.getByRole('button', { name: 'Создать тред' }).click();
    await expect(approvalDialog).toBeHidden();

    const approvalRef = await findThreadByTitle(page, approvalTitle);
    created.approvalThreadId = approvalRef.id;
    created.approvalFileId = approvalRef.fileId;

    // Department thread creation
    const departmentTitle = `${created.titlePrefix}-department`;
    await page.getByRole('button', { name: 'Новый тред' }).click();
    const departmentDialog = page.getByRole('dialog', { name: 'Новый тред документов' });
    await departmentDialog.getByLabel('Название треда').fill(departmentTitle);
    await departmentDialog.getByLabel('Описание').fill('Department e2e thread');
    await chooseSelectOption(page, departmentDialog, 'Адресация', 'По отделениям');

    const departmentCombo = departmentDialog.getByRole('combobox', { name: 'Отделения', exact: true });
    await departmentCombo.click();
    await departmentCombo.fill('Терапевтическое');
    await page.getByRole('option', { name: /Терапевтическое отделение/ }).click();

    await departmentDialog.locator('input[type="file"]').setInputFiles([
      {
        name: 'department-a.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('department content', 'utf-8'),
      },
    ]);
    await departmentDialog.getByRole('button', { name: 'Создать тред' }).click();

    const departmentRef = await findThreadByTitle(page, departmentTitle);
    created.departmentThreadId = departmentRef.id;
    created.departmentFileId = departmentRef.fileId;

    await logout(page);
  });

  test('petrova: can read/approve and access file URLs', async ({ page }) => {
    await login(page, PETROVA);
    await openDocuments(page);

    await expect(threadListItem(page, `${created.titlePrefix}-distribution`)).toBeVisible();
    await expect(threadListItem(page, `${created.titlePrefix}-approval`)).toBeVisible();
    await expect(threadListItem(page, `${created.titlePrefix}-department`)).toBeVisible();

    // Read receipt mark button in distribution thread
    await threadListItem(page, `${created.titlePrefix}-distribution`).click();
    const readBtn = page.getByRole('button', { name: 'Отметить прочтение' });
    if (await readBtn.isVisible()) {
      await readBtn.click();
    }

    // Approval decision: request changes
    await threadListItem(page, `${created.titlePrefix}-approval`).click();
    await page.getByPlaceholder('Комментарий (необязательно)').fill('Нужна доработка формулировки');
    await page.getByRole('button', { name: 'Возражение' }).click();
    await expect(threadListItem(page, `${created.titlePrefix}-approval`)).toContainText('Есть возражения');

    // Access check via API should be allowed for recipient
    const api = await createBrowserApi(page);

    const viewResp = await api.get(`documents/threads/${created.distributionThreadId}/files/${created.distributionFileId}/view`);
    expect(viewResp.status()).toBe(200);

    const downloadResp = await api.get(`documents/threads/${created.departmentThreadId}/files/${created.departmentFileId}/download`);
    expect(downloadResp.status()).toBe(200);

    await api.dispose();
    await logout(page);
  });

  test('admin: can resubmit approval thread after objections', async ({ page }) => {
    await login(page, ADMIN);
    await openDocuments(page);

    await threadListItem(page, `${created.titlePrefix}-approval`).click();
    await expect(threadListItem(page, `${created.titlePrefix}-approval`)).toContainText('Есть возражения');

    await page.getByPlaceholder('Комментарий к доработке (опционально)').fill('Обновил формулировку, отправляю повторно');
    await page.getByRole('button', { name: 'На повторное согласование' }).click();

    await expect(threadListItem(page, `${created.titlePrefix}-approval`)).toContainText('На согласовании');
    await logout(page);
  });

  test('non-recipients: files and threads are inaccessible', async ({ page }) => {
    await login(page, NOVIKOV);
    await openDocuments(page);

    // Novikov should not see individually distributed or department thread.
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(`${created.titlePrefix}-distribution`)) })).toHaveCount(0);
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(`${created.titlePrefix}-department`)) })).toHaveCount(0);

    const api = await createBrowserApi(page);

    const deniedView = await api.get(`documents/threads/${created.distributionThreadId}/files/${created.distributionFileId}/view`);
    expect(deniedView.status()).toBe(403);

    const deniedDownload = await api.get(`documents/threads/${created.departmentThreadId}/files/${created.departmentFileId}/download`);
    expect(deniedDownload.status()).toBe(403);

    await api.dispose();
    await logout(page);

    // Kozlova (cardiology) must also not access therapy-department thread.
    await login(page, KOZLOVA);
    await openDocuments(page);
    await expect(page.getByRole('button', { name: new RegExp(escapeRegExp(`${created.titlePrefix}-department`)) })).toHaveCount(0);

    const apiS = await createBrowserApi(page);
    const deniedDept = await apiS.get(`documents/threads/${created.departmentThreadId}/files/${created.departmentFileId}/view`);
    expect(deniedDept.status()).toBe(403);
    await apiS.dispose();
  });
});
