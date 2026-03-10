import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { body, param, query } from 'express-validator';
import { AuthRequest } from '../types/index.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { config } from '../config/index.js';
import * as documentService from '../services/documentService.js';

function handleServiceError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof documentService.DocumentServiceError) {
    return sendError(res, error.message, error.statusCode);
  }

  console.error('Documents module error:', error);
  return sendError(res, fallbackMessage, 500);
}

export const createThreadValidation = [
  body('title').trim().notEmpty().withMessage('Название треда обязательно'),
  body('mode')
    .isIn(documentService.DOCUMENT_THREAD_MODES)
    .withMessage(`Режим должен быть одним из: ${documentService.DOCUMENT_THREAD_MODES.join(', ')}`),
  body('distributionType')
    .isIn(documentService.DOCUMENT_DISTRIBUTION_TYPES)
    .withMessage(`Тип рассылки должен быть одним из: ${documentService.DOCUMENT_DISTRIBUTION_TYPES.join(', ')}`),
  body('recipientIds').optional().isArray().withMessage('recipientIds должен быть массивом'),
  body('departmentIds').optional().isArray().withMessage('departmentIds должен быть массивом'),
  body('groupIds').optional().isArray().withMessage('groupIds должен быть массивом'),
  body('files').optional().isArray().withMessage('files должен быть массивом'),
];

export const createGroupValidation = [
  body('name').trim().notEmpty().withMessage('Название группы обязательно'),
  body('memberIds').isArray({ min: 1 }).withMessage('Для группы нужен хотя бы один участник'),
];

export const addFilesValidation = [
  param('id').isUUID().withMessage('Некорректный ID треда'),
  body('files').isArray({ min: 1 }).withMessage('Добавьте хотя бы один файл'),
];

export const threadIdValidation = [
  param('id').isUUID().withMessage('Некорректный ID треда'),
];

export const decisionValidation = [
  param('id').isUUID().withMessage('Некорректный ID треда'),
  body('decision').isIn(['approved', 'changes_requested']).withMessage('Некорректное решение'),
  body('comment').optional().isString().withMessage('Комментарий должен быть строкой'),
];

export const threadFileValidation = [
  param('threadId').isUUID().withMessage('Некорректный ID треда'),
  param('fileId').isUUID().withMessage('Некорректный ID файла'),
];

export const listThreadsValidation = [
  query('mode').optional().isString(),
  query('status').optional().isString(),
  query('q').optional().isString(),
];

export async function getThreads(req: AuthRequest, res: Response) {
  try {
    const threads = await documentService.listThreads(req.user!.id, {
      mode: req.query.mode as string | undefined,
      status: req.query.status as string | undefined,
      q: req.query.q as string | undefined,
    });

    return sendSuccess(res, threads);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка получения списка тредов документов');
  }
}

export async function getThread(req: AuthRequest, res: Response) {
  try {
    const thread = await documentService.getThreadById(req.params.id, req.user!.id);
    return sendSuccess(res, thread);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка получения треда документов');
  }
}

export async function createThread(req: AuthRequest, res: Response) {
  try {
    const thread = await documentService.createThread(req.user!.id, {
      title: req.body.title,
      description: req.body.description,
      mode: req.body.mode,
      distributionType: req.body.distributionType,
      requiresReadReceipt: req.body.requiresReadReceipt,
      recipientIds: req.body.recipientIds,
      departmentIds: req.body.departmentIds,
      groupIds: req.body.groupIds,
      files: req.body.files,
    });

    return sendSuccess(res, thread, 'Тред документов создан', 201);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка создания треда документов');
  }
}

export async function markThreadAsRead(req: AuthRequest, res: Response) {
  try {
    const thread = await documentService.markThreadAsRead(req.params.id, req.user!.id);
    return sendSuccess(res, thread, 'Тред отмечен как прочитанный');
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка обновления статуса прочтения');
  }
}

export async function submitDecision(req: AuthRequest, res: Response) {
  try {
    const thread = await documentService.submitDecision(
      req.params.id,
      req.user!.id,
      req.body.decision,
      req.body.comment
    );

    return sendSuccess(res, thread, 'Решение по треду сохранено');
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка сохранения решения согласования');
  }
}

export async function resubmitThread(req: AuthRequest, res: Response) {
  try {
    const thread = await documentService.resubmitThread(req.params.id, req.user!.id, req.body.comment);
    return sendSuccess(res, thread, 'Тред отправлен на повторное согласование');
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка повторной отправки треда');
  }
}

export async function addFilesToThread(req: AuthRequest, res: Response) {
  try {
    const thread = await documentService.addFilesToThread(req.params.id, req.user!.id, req.body.files);
    return sendSuccess(res, thread, 'Файлы добавлены в тред');
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка добавления файлов');
  }
}

export async function deleteThreadFile(req: AuthRequest, res: Response) {
  try {
    const thread = await documentService.removeThreadFile(req.params.threadId, req.params.fileId, req.user!.id);
    return sendSuccess(res, thread, 'Файл помечен как удаленный');
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка удаления файла');
  }
}

export async function uploadFile(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, 'Файл не загружен', 400);
    }

    const attachment = {
      id: req.file.filename.split('.')[0],
      fileName: req.file.originalname,
      fileUrl: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    };

    return sendSuccess(res, attachment, 'Файл загружен');
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка загрузки файла');
  }
}

export async function downloadThreadFile(req: AuthRequest, res: Response) {
  try {
    const file = await documentService.getThreadFileById(req.params.threadId, req.params.fileId, req.user!.id);

    const fileName = path.basename(file.fileUrl);
    const absolutePath = path.resolve(config.paths.uploads, 'documents', fileName);

    if (!fs.existsSync(absolutePath)) {
      return sendError(res, 'Файл отсутствует на диске', 404);
    }

    return res.download(absolutePath, file.fileName);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка скачивания файла');
  }
}

export async function viewThreadFile(req: AuthRequest, res: Response) {
  try {
    const file = await documentService.getThreadFileById(req.params.threadId, req.params.fileId, req.user!.id);

    const fileName = path.basename(file.fileUrl);
    const absolutePath = path.resolve(config.paths.uploads, 'documents', fileName);

    if (!fs.existsSync(absolutePath)) {
      return sendError(res, 'Файл отсутствует на диске', 404);
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);

    return res.sendFile(absolutePath);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка просмотра файла');
  }
}

export async function getSupportedFormats(_req: AuthRequest, res: Response) {
  try {
    return sendSuccess(res, documentService.getSupportedFormats());
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка получения форматов документов');
  }
}

export async function getGroups(req: AuthRequest, res: Response) {
  try {
    const groups = await documentService.listGroups(req.user!.id);
    return sendSuccess(res, groups);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка получения групп рассылки');
  }
}

export async function createGroup(req: AuthRequest, res: Response) {
  try {
    const group = await documentService.createGroup(req.user!.id, {
      name: req.body.name,
      description: req.body.description,
      memberIds: req.body.memberIds,
    });

    return sendSuccess(res, group, 'Группа получателей создана', 201);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка создания группы получателей');
  }
}

export async function getAudienceOptions(req: AuthRequest, res: Response) {
  try {
    const options = await documentService.getAudienceOptions(req.user!.id);
    return sendSuccess(res, options);
  } catch (error) {
    return handleServiceError(res, error, 'Ошибка получения списка получателей');
  }
}
