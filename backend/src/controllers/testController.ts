import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { body, param } from 'express-validator';
import { AuthRequest } from '../types/index.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { config } from '../config/index.js';
import * as testService from '../services/testService.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Неизвестная ошибка';
}

export const createTestValidation = [
  body('title').trim().notEmpty().withMessage('Название теста обязательно'),
  body('questions').isArray({ min: 1 }).withMessage('Добавьте хотя бы один вопрос'),
  body('passingScore').optional().isInt({ min: 1, max: 100 }).withMessage('Проходной балл должен быть от 1 до 100'),
  body('timeLimit').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Лимит времени должен быть положительным числом'),
  body('maxAttempts').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Макс. попыток должно быть положительным числом'),
];

export const testIdValidation = [
  param('id').isUUID().withMessage('Некорректный ID теста'),
];

export const attemptIdValidation = [
  param('attemptId').isUUID().withMessage('Некорректный ID попытки'),
];

export const submitAttemptValidation = [
  param('id').isUUID().withMessage('Некорректный ID теста'),
  body('answers').isArray().withMessage('answers должен быть массивом'),
  body('timeSpent').optional().isInt({ min: 0 }).withMessage('timeSpent должен быть неотрицательным числом'),
];

export const reviewAttemptValidation = [
  param('attemptId').isUUID().withMessage('Некорректный ID попытки'),
  body('reviews').isArray({ min: 1 }).withMessage('Передайте хотя бы одну проверку'),
  body('feedback').optional().isString().withMessage('feedback должен быть строкой'),
];

export async function getSummary(req: AuthRequest, res: Response) {
  try {
    const summary = await testService.getUserSummary(req.user!.id, req.user!.isAdmin);
    return sendSuccess(res, summary);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function getAudienceOptions(_req: AuthRequest, res: Response) {
  try {
    const options = await testService.getAudienceOptions();
    return sendSuccess(res, options);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function listTests(req: AuthRequest, res: Response) {
  try {
    const tests = await testService.listTestsForUser(req.user!.id, req.user!.isAdmin);
    return sendSuccess(res, tests);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function getTestById(req: AuthRequest, res: Response) {
  try {
    const test = await testService.getTestById(req.params.id, req.user!.id, req.user!.isAdmin);
    if (!test) {
      return sendError(res, 'Тест не найден или недоступен', 404);
    }

    return sendSuccess(res, test);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function createTest(req: AuthRequest, res: Response) {
  try {
    const created = await testService.createTest(req.user!.id, req.body);
    return sendSuccess(res, created, 'Тест успешно создан', 201);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function submitAttempt(req: AuthRequest, res: Response) {
  try {
    const result = await testService.submitAttempt(req.params.id, req.user!.id, req.user!.isAdmin, req.body);
    return sendSuccess(res, result, 'Тест завершен');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function getAttemptById(req: AuthRequest, res: Response) {
  try {
    const attempt = await testService.getAttemptById(req.params.attemptId, req.user!.id, req.user!.isAdmin);
    if (!attempt) {
      return sendError(res, 'Попытка не найдена или недоступна', 404);
    }

    return sendSuccess(res, attempt);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function reviewAttempt(req: AuthRequest, res: Response) {
  try {
    const reviewed = await testService.reviewAttempt(req.params.attemptId, req.user!.id, req.user!.isAdmin, req.body);
    return sendSuccess(res, reviewed, 'Ручная проверка сохранена');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function uploadFile(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, 'Файл не загружен', 400);
    }

    const file = {
      id: req.file.filename.split('.')[0],
      fileName: decodeOriginalFileName(req.file.originalname),
      fileUrl: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    };

    return sendSuccess(res, file, 'Файл загружен');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

function resolveTestFilePath(fileName: string): string {
  const safeName = path.basename(fileName);
  return path.resolve(config.paths.uploads, 'tests', safeName);
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

export async function viewFile(req: AuthRequest, res: Response) {
  try {
    const file = await testService.getAccessibleFile(req.params.fileName, req.user!.id, req.user!.isAdmin);

    if (!file) {
      return sendError(res, 'Файл не найден', 404);
    }

    const filePath = resolveTestFilePath(file.fileUrl);

    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Файл не найден', 404);
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    return res.sendFile(filePath);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function downloadFile(req: AuthRequest, res: Response) {
  try {
    const file = await testService.getAccessibleFile(req.params.fileName, req.user!.id, req.user!.isAdmin);

    if (!file) {
      return sendError(res, 'Файл не найден', 404);
    }

    const filePath = resolveTestFilePath(file.fileUrl);

    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Файл не найден', 404);
    }

    return res.download(filePath, file.fileName);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}
