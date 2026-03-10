import { expect, test } from '@playwright/test';
import { createBrowserApi, loginViaApi, type Credentials } from './support/auth';

type ProfileState = {
  firstName: string;
  lastName: string;
  middleName: string | null;
  position: string | null;
  email: string;
  phone: string | null;
  phoneInternal: string | null;
  bio: string | null;
};

type AuthMePayload = {
  firstName: string;
  lastName: string;
  middleName: string | null;
  position: string | null;
  email: string;
  phone: string | null;
  phoneInternal: string | null;
  bio: string | null;
};

const ADMIN: Credentials = { email: 'admin@hospital.local', password: 'admin123' };
const RUN_SUFFIX = `${Date.now()}`;
const TEST_AVATAR_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f6e6e" />
        <stop offset="100%" stop-color="#1f5f82" />
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="24" fill="url(#grad)" />
    <circle cx="48" cy="36" r="16" fill="#eff9ff" />
    <path d="M24 78c5-12 17-18 24-18s19 6 24 18" fill="#eff9ff" />
  </svg>
`.trim();

function toProfileState(data: AuthMePayload): ProfileState {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName ?? null,
    position: data.position ?? null,
    email: data.email,
    phone: data.phone ?? null,
    phoneInternal: data.phoneInternal ?? null,
    bio: data.bio ?? null,
  };
}

test('settings: menu navigation, reset/save form, avatar upload', async ({ page }) => {
  test.setTimeout(120_000);

  await loginViaApi(page, ADMIN);
  const api = await createBrowserApi(page);

  const meResponse = await api.get('auth/me');
  expect(meResponse.ok()).toBeTruthy();
  const meBody = await meResponse.json();
  const original = toProfileState(meBody.data);

  const updated: ProfileState = {
    firstName: `${original.firstName}${RUN_SUFFIX.slice(-4)}`,
    lastName: `${original.lastName}${RUN_SUFFIX.slice(-3)}`,
    middleName: `UI-${RUN_SUFFIX.slice(-2)}`,
    position: `Специалист ${RUN_SUFFIX.slice(-2)}`,
    email: original.email,
    phone: `+7 (900) 10${RUN_SUFFIX.slice(-2)}-20-30`,
    phoneInternal: `${RUN_SUFFIX.slice(-4)}`,
    bio: `Профиль обновлён автотестом ${RUN_SUFFIX}`,
  };

  try {
    await page.locator('button:has(.MuiAvatar-root)').first().click();
    await page.getByRole('menuitem', { name: 'Настройки' }).click();
    await page.waitForURL('**/settings');
    await expect(page.getByRole('heading', { name: 'Настройки профиля' })).toBeVisible();
    const layoutAvatar = page.locator('[data-testid="layout-user-avatar"]');
    const settingsAvatar = page.locator('[data-testid="settings-profile-avatar"]');
    const layoutAvatarImage = layoutAvatar.locator('img');
    const settingsAvatarImage = settingsAvatar.locator('img');
    const avatarSrcBefore = await layoutAvatar.evaluate((element) =>
      element.querySelector('img')?.getAttribute('src') ?? null
    );

    // Проверяем кнопку сброса.
    await page.getByLabel('Имя').fill(`temp-${RUN_SUFFIX.slice(-3)}`);
    await page.getByRole('button', { name: 'Сбросить изменения' }).click();
    await expect(page.getByLabel('Имя')).toHaveValue(original.firstName);

    await page.getByLabel('Фамилия').fill(updated.lastName);
    await page.getByLabel('Имя').fill(updated.firstName);
    await page.getByLabel('Отчество').fill(updated.middleName ?? '');
    await page.getByLabel('Должность').fill(updated.position ?? '');
    await page.getByLabel('Email').fill(updated.email);
    await page.getByLabel('Телефон').fill(updated.phone ?? '');
    await page.getByLabel('Внутренний номер').fill(updated.phoneInternal ?? '');
    await page.getByLabel('О себе').fill(updated.bio ?? '');
    await page.getByRole('button', { name: 'Сохранить изменения' }).click();

    await expect(page.getByText('Профиль успешно обновлён')).toBeVisible();

    const meAfterSave = await api.get('auth/me');
    expect(meAfterSave.ok()).toBeTruthy();
    const meAfterSaveBody = await meAfterSave.json();
    expect(meAfterSaveBody.data.firstName).toBe(updated.firstName);
    expect(meAfterSaveBody.data.lastName).toBe(updated.lastName);
    expect(meAfterSaveBody.data.middleName).toBe(updated.middleName);
    expect(meAfterSaveBody.data.position).toBe(updated.position);
    expect(meAfterSaveBody.data.phone).toBe(updated.phone);
    expect(meAfterSaveBody.data.phoneInternal).toBe(updated.phoneInternal);
    expect(meAfterSaveBody.data.bio).toBe(updated.bio);

    await page.locator('input[type="file"]').setInputFiles({
      name: `avatar-${RUN_SUFFIX}.svg`,
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(TEST_AVATAR_SVG, 'utf8'),
    });
    await expect(page.getByText('Фотография профиля обновлена')).toBeVisible();

    const meAfterAvatar = await api.get('auth/me');
    expect(meAfterAvatar.ok()).toBeTruthy();
    const meAfterAvatarBody = await meAfterAvatar.json();
    expect(meAfterAvatarBody.data.avatarUrl).toContain('/uploads/avatars/');
    await expect(layoutAvatarImage).toBeVisible();
    await expect(settingsAvatarImage).toBeVisible();

    const avatarSrcAfter = await layoutAvatarImage.getAttribute('src');
    expect(avatarSrcAfter).toContain('/uploads/avatars/');
    expect(avatarSrcAfter).not.toBe(avatarSrcBefore);
    await expect(settingsAvatarImage).toHaveAttribute('src', avatarSrcAfter!);

    await page.reload();
    await page.waitForURL('**/settings');
    await expect(page.getByLabel('Имя')).toHaveValue(updated.firstName);
    await expect(page.locator('[data-testid="layout-user-avatar"] img')).toHaveAttribute('src', avatarSrcAfter!);
    await expect(page.locator('[data-testid="settings-profile-avatar"] img')).toHaveAttribute('src', avatarSrcAfter!);
  } finally {
    await api.put('contacts/me', {
      data: {
        firstName: original.firstName,
        lastName: original.lastName,
        middleName: original.middleName,
        position: original.position,
        email: original.email,
        phone: original.phone,
        phoneInternal: original.phoneInternal,
        bio: original.bio,
      },
    });
    await api.dispose();
  }
});
