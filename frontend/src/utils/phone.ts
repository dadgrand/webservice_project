const COMPLETE_PHONE_REGEX = /^\+7-\d{3}-\d{3}-\d{2}-\d{2}$/;
const COMPLETE_INTERNAL_PHONE_REGEX = /^\d{2,6}$/;

function normalizeRussianDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  let normalized = digits;

  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  } else if (normalized.startsWith('9')) {
    normalized = `7${normalized}`;
  } else if (!normalized.startsWith('7')) {
    normalized = `7${normalized}`;
  }

  return normalized.slice(0, 11);
}

export function formatRussianPhone(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  const digits = normalizeRussianDigits(value);
  if (!digits) {
    return '';
  }

  const national = digits.slice(1);
  const groups = [
    national.slice(0, 3),
    national.slice(3, 6),
    national.slice(6, 8),
    national.slice(8, 10),
  ].filter(Boolean);

  return ['+7', ...groups].join('-');
}

export function normalizeInternalPhone(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value.replace(/\D/g, '').slice(0, 6);
}

export function isValidRussianPhone(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }

  return COMPLETE_PHONE_REGEX.test(formatRussianPhone(value));
}

export function isValidInternalPhone(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }

  return COMPLETE_INTERNAL_PHONE_REGEX.test(normalizeInternalPhone(value));
}

export const RUSSIAN_PHONE_PLACEHOLDER = '+7-999-999-99-99';
