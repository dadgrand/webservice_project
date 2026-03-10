import { Request, Response, NextFunction } from 'express';
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

  // В production не показываем детали ошибки
  const message = config.isDev ? err.message : 'Внутренняя ошибка сервера';

  sendError(res, message, 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Маршрут ${req.method} ${req.path} не найден`, 404);
}
