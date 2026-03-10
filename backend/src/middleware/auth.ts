import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { extractTokenFromRequest, verifyToken } from '../utils/auth.js';
import { sendError } from '../utils/response.js';
import prisma from '../config/database.js';

// Middleware для проверки JWT токена
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      sendError(res, 'Токен авторизации не предоставлен', 401);
      return;
    }
    const payload = verifyToken(token);

    if (!payload) {
      sendError(res, 'Недействительный или истекший токен', 401);
      return;
    }

    // Проверяем, что пользователь существует и активен
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!user || !user.isActive) {
      sendError(res, 'Пользователь не найден или деактивирован', 401);
      return;
    }

    // Обновляем payload с актуальными разрешениями
    req.user = {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      permissions: user.permissions.map((up) => up.permission.code),
    };

    next();
  } catch (error) {
    sendError(res, 'Ошибка аутентификации', 401);
  }
}

// Middleware для проверки прав администратора
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.isAdmin) {
    sendError(res, 'Требуются права администратора', 403);
    return;
  }
  next();
}

// Middleware для проверки наличия одного из разрешений
export function requirePermission(...permissionCodes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Требуется авторизация', 401);
      return;
    }

    // Админ имеет все права
    if (req.user.isAdmin) {
      next();
      return;
    }

    // Проверяем наличие хотя бы одного из требуемых разрешений
    const hasPermission = permissionCodes.some((code) =>
      req.user!.permissions.includes(code)
    );

    if (!hasPermission) {
      sendError(
        res,
        `Недостаточно прав. Требуется одно из: ${permissionCodes.join(', ')}`,
        403
      );
      return;
    }

    next();
  };
}

// Middleware для проверки наличия ВСЕХ указанных разрешений
export function requireAllPermissions(...permissionCodes: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Требуется авторизация', 401);
      return;
    }

    // Админ имеет все права
    if (req.user.isAdmin) {
      next();
      return;
    }

    // Проверяем наличие всех требуемых разрешений
    const hasAllPermissions = permissionCodes.every((code) =>
      req.user!.permissions.includes(code)
    );

    if (!hasAllPermissions) {
      sendError(
        res,
        `Недостаточно прав. Требуются все: ${permissionCodes.join(', ')}`,
        403
      );
      return;
    }

    next();
  };
}
