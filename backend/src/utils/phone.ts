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

export function normalizeRussianPhone(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digits = normalizeRussianDigits(trimmed);
  if (!digits) {
    return null;
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

export function normalizeInternalPhone(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const digits = value.replace(/\D/g, '').slice(0, 6);
  return digits.length > 0 ? digits : null;
}

export function isValidRussianPhone(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }

  const normalized = normalizeRussianPhone(value);
  return typeof normalized === 'string' && COMPLETE_PHONE_REGEX.test(normalized);
}

export function isValidInternalPhone(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }

  const normalized = normalizeInternalPhone(value);
  return typeof normalized === 'string' && COMPLETE_INTERNAL_PHONE_REGEX.test(normalized);
}
