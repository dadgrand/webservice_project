import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import logger from '../config/logger.js';
import { sendError } from '../utils/response.js';
import { config } from '../config/index.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`Error: ${err.message}`, { 
    stack: err.stack,
    path: req.path,
    method: req.method 
  });

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const isAvatarUpload = req.path.endsWith('/contacts/me/avatar');
      sendError(
        res,
        isAvatarUpload
          ? 'Фотография слишком большая. Максимальный размер файла: 5 МБ.'
          : 'Файл слишком большой для загрузки.',
        400
      );
      return;
    }

    sendError(res, 'Ошибка загрузки файла.', 400);
    return;
  }

  if (err.message === 'Неподдерживаемый тип файла') {
    const isAvatarUpload = req.path.endsWith('/contacts/me/avatar');
    sendError(
      res,
      isAvatarUpload
        ? 'Неподдерживаемый формат фотографии. Поддерживаются JPG, JPEG, PNG, GIF, SVG и WEBP.'
        : 'Неподдерживаемый тип файла.',
      400
    );
    return;
  }

  // В production не показываем детали ошибки
  const message = config.isDev ? err.message : 'Внутренняя ошибка сервера';

  sendError(res, message, 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Маршрут ${req.method} ${req.path} не найден`, 404);
}
