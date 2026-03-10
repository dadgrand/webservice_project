import path from 'path';
import type { FileFilterCallback } from 'multer';

const OFFICE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
];

const OFFICE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.json',
  '.zip',
];

interface UploadValidationOptions {
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  allowedMimePrefixes?: string[];
}

function normalizeList(values: string[] | undefined): Set<string> {
  return new Set((values || []).map((value) => value.toLowerCase()));
}

export function buildFileFilter(options: UploadValidationOptions) {
  const mimeTypes = normalizeList(options.allowedMimeTypes);
  const extensions = normalizeList(options.allowedExtensions);
  const mimePrefixes = (options.allowedMimePrefixes || []).map((value) => value.toLowerCase());

  return (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    const mimeType = file.mimetype.toLowerCase();
    const extension = path.extname(file.originalname).toLowerCase();
    const isMimeAllowed =
      mimeTypes.has(mimeType) ||
      mimePrefixes.some((prefix) => mimeType.startsWith(prefix));
    const isExtensionAllowed = extensions.has(extension);

    if (isMimeAllowed && isExtensionAllowed) {
      cb(null, true);
      return;
    }

    cb(new Error('Неподдерживаемый тип файла'));
  };
}

export const sharedUploadTypes = {
  officeMimeTypes: OFFICE_MIME_TYPES,
  officeExtensions: OFFICE_EXTENSIONS,
  officeAndMediaMimeTypes: [...OFFICE_MIME_TYPES],
  officeAndMediaExtensions: [...OFFICE_EXTENSIONS],
};
