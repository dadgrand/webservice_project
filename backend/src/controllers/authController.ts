import { Request, Response } from 'express';
import { body } from 'express-validator';
import * as userService from '../services/userService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';
import { config } from '../config/index.js';

function isSecureCookieRequest(req: Request): boolean {
  if (config.auth.cookieSecureMode === true) {
    return true;
  }

  if (config.auth.cookieSecureMode === false) {
    return false;
  }

  if (req.secure) {
    return true;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const value = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return typeof value === 'string' && value.split(',')[0]?.trim() === 'https';
}

function setAuthCookie(req: Request, res: Response, token: string): void {
  res.cookie(config.auth.cookieName, token, {
    httpOnly: true,
    secure: isSecureCookieRequest(req),
    sameSite: config.auth.cookieSameSite,
    maxAge: config.auth.cookieMaxAgeMs,
    path: '/',
  });
}

function clearAuthCookie(req: Request, res: Response): void {
  res.clearCookie(config.auth.cookieName, {
    httpOnly: true,
    secure: isSecureCookieRequest(req),
    sameSite: config.auth.cookieSameSite,
    path: '/',
  });
}

// Валидаторы
export const loginValidation = [
  body('email').isEmail().withMessage('Введите корректный email'),
  body('password').notEmpty().withMessage('Пароль обязателен'),
];

export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Новый пароль должен быть минимум 8 символов'),
];

// Контроллеры
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    const result = await userService.loginUser(email, password);

    if (!result) {
      return sendError(res, 'Неверный email или пароль', 401);
    }

    setAuthCookie(req, res, result.token);
    return sendSuccess(res, result, 'Вход выполнен успешно');
  } catch (error) {
    return sendError(res, 'Ошибка при авторизации', 500);
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return sendError(res, 'Не авторизован', 401);
    }

    const user = await userService.getUserById(req.user.id);

    if (!user) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    return sendSuccess(res, user);
  } catch (error) {
    return sendError(res, 'Ошибка при получении данных пользователя', 500);
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return sendError(res, 'Не авторизован', 401);
    }

    const { currentPassword, newPassword } = req.body;

    const success = await userService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    if (!success) {
      return sendError(res, 'Неверный текущий пароль', 400);
    }

    return sendSuccess(res, null, 'Пароль успешно изменен');
  } catch (error) {
    return sendError(res, 'Ошибка при смене пароля', 500);
  }
}

export async function logout(req: AuthRequest, res: Response) {
  clearAuthCookie(req, res);
  return sendSuccess(res, null, 'Выход выполнен успешно');
}
