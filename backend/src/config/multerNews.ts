import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './index.js';
import { buildFileFilter, sharedUploadTypes } from './uploadValidation.js';

const uploadDir = path.resolve(config.paths.uploads, 'news');

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

export const uploadNews = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: buildFileFilter({
    allowedMimeTypes: [
      ...sharedUploadTypes.officeMimeTypes.filter((mime) =>
        mime === 'application/pdf' ||
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ),
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.mp4'],
    allowedMimePrefixes: ['image/', 'video/'],
  }),
});
