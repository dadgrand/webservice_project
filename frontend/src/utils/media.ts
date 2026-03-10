import { resolveApiUrl } from '../services/api';

const ABSOLUTE_URL_RE = /^[a-z][a-z\d+.-]*:/i;

export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  if (ABSOLUTE_URL_RE.test(path)) {
    return path;
  }

  return resolveApiUrl(path);
}
