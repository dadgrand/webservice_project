
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';
import { config } from '../config/index.js';

// Загрузить вложение (временное, возвращает путь)
export async function uploadAttachment(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, 'Файл не загружен', 400);
    }

    // Возвращаем путь к API для скачивания (но пока файл не привязан, это просто загрузка)
    // Файл лежит в uploads/attachments.
    // Если мы отключим статику, как получить доступ к только что загруженному файлу для предпросмотра?
    // Обычно делают временный токен или разрешают доступ автору загрузки.
    // Пока оставим fileUrl как путь к файлу, но скачивание реализуем через API.
    
    // Внимание: мы возвращаем объект, который фронт отправит обратно при создании сообщения.
    // fileUrl здесь - это локальный путь или URL?
    // Раньше было: const fileUrl = `/uploads/attachments/${req.file.filename}`;
    
    const filename = req.file.filename;
    
    const attachment = {
      id: filename.split('.')[0], // Временный ID
      fileName: req.file.originalname,
      fileUrl: filename, // Храним только имя файла, URL построим на клиенте или при получении
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    };

    return sendSuccess(res, attachment, 'Файл загружен');
  } catch (error) {
    console.error('Upload attachment error:', error);
    return sendError(res, 'Ошибка загрузки файла', 500);
  }
}

// Скачать вложение сообщения
export async function downloadMessageAttachment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const attachment = await prisma.messageAttachment.findUnique({
      where: { id },
      include: { message: { include: { recipients: true } } },
    });

    if (!attachment) {
      return sendError(res, 'Файл не найден', 404);
    }

    // Проверка прав: отправитель или получатель
    const isSender = attachment.message.senderId === userId;
    const isRecipient = attachment.message.recipients.some(r => r.userId === userId);

    if (!isSender && !isRecipient) {
      return sendError(res, 'Доступ запрещен', 403);
    }

    const fileName = path.basename(attachment.fileUrl);
    const absolutePath = path.resolve(config.paths.uploads, 'attachments', fileName);

    if (!fs.existsSync(absolutePath)) {
        return sendError(res, 'Файл отсутствует на диске', 404);
    }

    res.download(absolutePath, attachment.fileName);
  } catch (error) {
    console.error('Download error:', error);
    return sendError(res, 'Ошибка скачивания', 500);
  }
}

// Скачать вложение черновика
export async function downloadDraftAttachment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const attachment = await prisma.messageDraftAttachment.findUnique({
      where: { id },
      include: { draft: true },
    });

    if (!attachment) {
      return sendError(res, 'Файл не найден', 404);
    }

    // Проверка прав: только автор черновика
    if (attachment.draft.userId !== userId) {
      return sendError(res, 'Доступ запрещен', 403);
    }

    const fileName = path.basename(attachment.fileUrl);
    const absolutePath = path.resolve(config.paths.uploads, 'attachments', fileName);

    if (!fs.existsSync(absolutePath)) {
        return sendError(res, 'Файл отсутствует на диске', 404);
    }

    res.download(absolutePath, attachment.fileName);
  } catch (error) {
    console.error('Download error:', error);
    return sendError(res, 'Ошибка скачивания', 500);
  }
}
