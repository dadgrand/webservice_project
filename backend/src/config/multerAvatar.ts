
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './index.js';
import { buildFileFilter } from './uploadValidation.js';

const uploadDir = path.resolve(config.paths.uploads, 'avatars');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

export const uploadAvatarConfig = multer({
  storage,
  limits: {
    fileSize: Math.min(config.upload.maxFileSize, 5 * 1024 * 1024),
  },
  fileFilter: buildFileFilter({
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'],
    allowedMimePrefixes: ['image/'],
  }),
});
