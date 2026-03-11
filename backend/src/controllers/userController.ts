import { Request, Response } from 'express';
import { body, param } from 'express-validator';
import * as userService from '../services/userService.js';
import * as permissionService from '../services/permissionService.js';
import { sendSuccess, sendError, sendPaginated, getPaginationParams } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';
import { generateRandomPassword } from '../utils/auth.js';
import { isValidRussianPhone } from '../utils/phone.js';

// Валидаторы
export const createUserValidation = [
  body('email').isEmail().withMessage('Введите корректный email'),
  body('firstName').notEmpty().withMessage('Имя обязательно'),
  body('lastName').notEmpty().withMessage('Фамилия обязательна'),
  body('phone').optional({ nullable: true }).custom((value) => isValidRussianPhone(value)).withMessage('Телефон должен быть в формате +7-999-999-99-99'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Пароль должен быть минимум 8 символов'),
];

export const updateUserValidation = [
  param('id').isUUID().withMessage('Некорректный ID пользователя'),
  body('email').optional().isEmail().withMessage('Введите корректный email'),
  body('phone').optional({ nullable: true }).custom((value) => isValidRussianPhone(value)).withMessage('Телефон должен быть в формате +7-999-999-99-99'),
];

// Контроллеры

// Получить всех пользователей
export async function getUsers(req: Request, res: Response) {
  try {
    const { page, limit } = getPaginationParams(req.query as any);
    const search = req.query.search as string | undefined;

    const { users, total } = await userService.getAllUsers(page, limit, search);

    return sendPaginated(res, users, page, limit, total);
  } catch (error) {
    return sendError(res, 'Ошибка при получении списка пользователей', 500);
  }
}

// Получить пользователя по ID
export async function getUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    if (!user) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    return sendSuccess(res, user);
  } catch (error) {
    return sendError(res, 'Ошибка при получении пользователя', 500);
  }
}

// Создать пользователя
export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { email, firstName, lastName, middleName, position, departmentId, phone, isAdmin, permissions } = req.body;
    const normalizedDepartmentId =
      typeof departmentId === 'string' && departmentId.trim().length === 0 ? undefined : departmentId;
    
    // Проверка уникальности email
    if (await userService.emailExists(email)) {
      return sendError(res, 'Пользователь с таким email уже существует', 400);
    }

    // Генерируем случайный пароль если не указан
    const password = req.body.password || generateRandomPassword();

    const user = await userService.createUser(
      {
        email,
        password,
        firstName,
        lastName,
        middleName,
        position,
        departmentId: normalizedDepartmentId,
        phone,
        isAdmin,
        permissions,
      },
      req.user!.id
    );

    // Возвращаем пользователя и сгенерированный пароль
    return sendSuccess(
      res,
      { user, generatedPassword: req.body.password ? undefined : password },
      'Пользователь успешно создан',
      201
    );
  } catch (error) {
    console.error('Create user error:', error);
    return sendError(res, 'Ошибка при создании пользователя', 500);
  }
}

// Обновить пользователя
export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, middleName, position, departmentId, phone, isActive, isAdmin, permissions } = req.body;
    const normalizedDepartmentId =
      departmentId === undefined
        ? undefined
        : typeof departmentId === 'string' && departmentId.trim().length === 0
          ? null
          : departmentId;

    // Проверка уникальности email
    if (email && await userService.emailExists(email, id)) {
      return sendError(res, 'Пользователь с таким email уже существует', 400);
    }

    const user = await userService.updateUser(
      id,
      { email, firstName, lastName, middleName, position, departmentId: normalizedDepartmentId, phone, isActive, isAdmin, permissions },
      req.user!.id
    );

    if (!user) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    return sendSuccess(res, user, 'Пользователь успешно обновлен');
  } catch (error) {
    return sendError(res, 'Ошибка при обновлении пользователя', 500);
  }
}

// Удалить пользователя
export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Нельзя удалить самого себя
    if (id === req.user!.id) {
      return sendError(res, 'Нельзя удалить свою учетную запись', 400);
    }

    const success = await userService.deleteUser(id);

    if (!success) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    return sendSuccess(res, null, 'Пользователь успешно удален');
  } catch (error) {
    return sendError(res, 'Ошибка при удалении пользователя', 500);
  }
}

// Сбросить пароль пользователя (админ)
export async function resetUserPassword(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const newPassword = req.body.password || generateRandomPassword();

    const success = await userService.resetPassword(id, newPassword);

    if (!success) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    return sendSuccess(
      res,
      { generatedPassword: req.body.password ? undefined : newPassword },
      'Пароль успешно сброшен'
    );
  } catch (error) {
    return sendError(res, 'Ошибка при сбросе пароля', 500);
  }
}

// Получить все доступные разрешения
export async function getPermissions(req: Request, res: Response) {
  try {
    const permissions = await permissionService.getAllPermissions();
    return sendSuccess(res, permissions);
  } catch (error) {
    return sendError(res, 'Ошибка при получении списка разрешений', 500);
  }
}
