import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from './index.js';
import { buildFileFilter, sharedUploadTypes } from './uploadValidation.js';

const uploadDir = path.resolve(config.paths.uploads, 'documents');

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

export const uploadDocuments = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: buildFileFilter({
    allowedMimeTypes: sharedUploadTypes.officeMimeTypes,
    allowedExtensions: sharedUploadTypes.officeExtensions,
    allowedMimePrefixes: ['image/'],
  }),
});
