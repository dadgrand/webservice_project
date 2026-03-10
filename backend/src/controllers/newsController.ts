import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { body, param } from 'express-validator';
import { AuthRequest } from '../types/index.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { config } from '../config/index.js';
import * as newsService from '../services/newsService.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Неизвестная ошибка';
}

export const createNewsValidation = [
  body('title').trim().notEmpty().withMessage('Заголовок новости обязателен'),
  body('content').trim().notEmpty().withMessage('Текст новости обязателен'),
  body('isPinned').optional().isBoolean().withMessage('isPinned должен быть boolean'),
  body('media').optional().isArray().withMessage('Список вложений должен быть массивом'),
];

export const updateNewsValidation = [
  param('id').isUUID().withMessage('Некорректный ID новости'),
  ...createNewsValidation,
];

export const newsIdValidation = [param('id').isUUID().withMessage('Некорректный ID новости')];

export async function listNews(_req: AuthRequest, res: Response) {
  try {
    const items = await newsService.listNews();
    return sendSuccess(res, items);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function getNewsById(req: AuthRequest, res: Response) {
  try {
    const item = await newsService.getNewsById(req.params.id);
    if (!item) {
      return sendError(res, 'Новость не найдена', 404);
    }

    return sendSuccess(res, item);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function createNews(req: AuthRequest, res: Response) {
  try {
    const created = await newsService.createNews(req.user!.id, req.body);
    return sendSuccess(res, created, 'Новость успешно создана', 201);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function updateNews(req: AuthRequest, res: Response) {
  try {
    const updated = await newsService.updateNews(req.params.id, req.body);
    if (!updated) {
      return sendError(res, 'Новость не найдена', 404);
    }

    return sendSuccess(res, updated, 'Новость успешно обновлена');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function deleteNews(req: AuthRequest, res: Response) {
  try {
    const deleted = await newsService.deleteNews(req.params.id);
    if (!deleted) {
      return sendError(res, 'Новость не найдена', 404);
    }

    return sendSuccess(res, null, 'Новость удалена');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

function resolveNewsFilePath(fileName: string): string {
  const safeName = path.basename(fileName);
  return path.resolve(config.paths.uploads, 'news', safeName);
}

function decodeOriginalFileName(originalName: string): string {
  const hasCyrillic = /[А-Яа-яЁё]/.test(originalName);
  const looksLikeMojibake = /[ÐÑÃ]/.test(originalName);
  if (hasCyrillic || !looksLikeMojibake) {
    return originalName;
  }

  try {
    const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
    return decoded || originalName;
  } catch {
    return originalName;
  }
}

export async function uploadMedia(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, 'Файл не загружен или формат не поддерживается', 400);
    }

    const file = {
      id: req.file.filename.split('.')[0],
      fileName: decodeOriginalFileName(req.file.originalname),
      fileUrl: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    };

    return sendSuccess(res, file, 'Медиафайл загружен');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function viewMedia(req: AuthRequest, res: Response) {
  try {
    const filePath = resolveNewsFilePath(req.params.fileName);

    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Файл не найден', 404);
    }

    return res.sendFile(filePath);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function downloadMedia(req: AuthRequest, res: Response) {
  try {
    const filePath = resolveNewsFilePath(req.params.fileName);

    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Файл не найден', 404);
    }

    const safeName = path.basename(req.params.fileName);
    return res.download(filePath, safeName);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}
