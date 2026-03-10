import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './index.js';
import { buildFileFilter, sharedUploadTypes } from './uploadValidation.js';

const uploadDir = path.resolve(config.paths.uploads, 'tests');

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

export const uploadTests = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: buildFileFilter({
    allowedMimeTypes: sharedUploadTypes.officeAndMediaMimeTypes,
    allowedExtensions: [...sharedUploadTypes.officeAndMediaExtensions, '.mp4'],
    allowedMimePrefixes: ['image/', 'video/'],
  }),
});
