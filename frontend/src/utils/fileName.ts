export function normalizeUploadedFileName(fileName: string): string {
  if ([...fileName].some((char) => char.charCodeAt(0) > 255)) {
    return fileName;
  }

  try {
    const bytes = Uint8Array.from(fileName, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const sourceHasCyrillic = /[А-Яа-яЁё]/.test(fileName);
    const decodedHasCyrillic = /[А-Яа-яЁё]/.test(decoded);
    if (!sourceHasCyrillic && decodedHasCyrillic) {
      return decoded;
    }
  } catch {
    // Keep original if conversion failed.
  }

  return fileName;
}
