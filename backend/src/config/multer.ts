
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './index.js';
import { buildFileFilter, sharedUploadTypes } from './uploadValidation.js';

// Убедимся, что папка существует
const uploadDir = path.resolve(config.paths.uploads, 'attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла, сохраняя расширение
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: Math.min(config.upload.maxFileSize, 10 * 1024 * 1024),
  },
  fileFilter: buildFileFilter({
    allowedMimeTypes: sharedUploadTypes.officeMimeTypes,
    allowedExtensions: sharedUploadTypes.officeExtensions,
    allowedMimePrefixes: ['image/'],
  }),
});
