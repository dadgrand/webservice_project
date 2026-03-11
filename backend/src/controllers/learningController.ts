import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { body, param } from 'express-validator';
import { AuthRequest } from '../types/index.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { config } from '../config/index.js';
import * as learningService from '../services/learningService.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Неизвестная ошибка';
}

export const createMaterialValidation = [
  body('title').trim().notEmpty().withMessage('Название материала обязательно'),
  body('materialType').isIn(['single_page', 'multi_page']).withMessage('Некорректный тип материала'),
  body('pages').isArray({ min: 1 }).withMessage('Добавьте хотя бы одну страницу'),
  body('expiresAt').optional({ nullable: true }).isISO8601().withMessage('Некорректная дата срока действия'),
];

export const materialIdValidation = [param('id').isUUID().withMessage('Некорректный ID материала')];

export async function getSummary(req: AuthRequest, res: Response) {
  try {
    const canEditMaterials = req.user!.permissions.includes('learning.edit');
    const summary = await learningService.getLearningSummary(req.user!.id, req.user!.isAdmin, canEditMaterials);
    return sendSuccess(res, summary);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function getAudienceOptions(_req: AuthRequest, res: Response) {
  try {
    const options = await learningService.getAudienceOptions();
    return sendSuccess(res, options);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function listMaterials(req: AuthRequest, res: Response) {
  try {
    const canEditMaterials = req.user!.permissions.includes('learning.edit');
    const archived = req.query.archived === 'true';
    const materials = await learningService.listMaterialsForUser({
      userId: req.user!.id,
      isAdmin: req.user!.isAdmin,
      canEditMaterials,
      archived,
    });
    return sendSuccess(res, materials);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function getMaterialById(req: AuthRequest, res: Response) {
  try {
    const canEditMaterials = req.user!.permissions.includes('learning.edit');
    const material = await learningService.getMaterialById(req.params.id, req.user!.id, req.user!.isAdmin, canEditMaterials);
    if (!material) {
      return sendError(res, 'Материал не найден или недоступен', 404);
    }
    return sendSuccess(res, material);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

export async function createMaterial(req: AuthRequest, res: Response) {
  try {
    const created = await learningService.createMaterial(req.user!.id, req.body);
    return sendSuccess(res, created, 'Обучающий материал создан', 201);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function deleteMaterial(req: AuthRequest, res: Response) {
  try {
    await learningService.deleteMaterial(req.params.id);
    return sendSuccess(res, null, 'Материал удален');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function archiveMaterial(req: AuthRequest, res: Response) {
  try {
    await learningService.archiveMaterial(req.params.id);
    return sendSuccess(res, null, 'Материал перенесен в архив');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function restoreMaterial(req: AuthRequest, res: Response) {
  try {
    await learningService.restoreMaterial(req.params.id);
    return sendSuccess(res, null, 'Материал возвращен из архива');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 400);
  }
}

export async function markVisited(req: AuthRequest, res: Response) {
  try {
    const canEditMaterials = req.user!.permissions.includes('learning.edit');
    const success = await learningService.recordVisit(
      req.params.id,
      req.user!.id,
      req.user!.isAdmin,
      canEditMaterials,
      typeof req.body?.pageId === 'string' ? req.body.pageId : undefined
    );

    if (!success) {
      return sendError(res, 'Материал недоступен для просмотра', 403);
    }

    return sendSuccess(res, null, 'Посещение зафиксировано');
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}

function resolveLearningFilePath(fileName: string): string {
  const safeName = path.basename(fileName);
  return path.resolve(config.paths.uploads, 'learning', safeName);
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

export async function viewFile(req: AuthRequest, res: Response) {
  try {
    const canEditMaterials = req.user!.permissions.includes('learning.edit');
    const file = await learningService.getAccessibleFile(
      req.params.fileName,
      req.user!.id,
      req.user!.isAdmin,
      canEditMaterials
    );

    if (!file) {
      return sendError(res, 'Файл не найден', 404);
    }

    const filePath = resolveLearningFilePath(file.fileUrl);

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
    const canEditMaterials = req.user!.permissions.includes('learning.edit');
    const file = await learningService.getAccessibleFile(
      req.params.fileName,
      req.user!.id,
      req.user!.isAdmin,
      canEditMaterials
    );

    if (!file) {
      return sendError(res, 'Файл не найден', 404);
    }

    const filePath = resolveLearningFilePath(file.fileUrl);

    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Файл не найден', 404);
    }

    return res.download(filePath, file.fileName);
  } catch (error) {
    return sendError(res, getErrorMessage(error), 500);
  }
}
