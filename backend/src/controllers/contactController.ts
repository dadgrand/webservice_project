import { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import * as contactService from '../services/contactService.js';
import * as userService from '../services/userService.js';
import { sendSuccess, sendError, sendPaginated, getPaginationParams } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';

// Валидаторы
export const createDepartmentValidation = [
  body('name').notEmpty().withMessage('Название обязательно'),
];

export const updateDepartmentValidation = [
  param('id').isUUID().withMessage('Некорректный ID'),
];

export const updateProfileValidation = [
  body('email').optional().isEmail().withMessage('Введите корректный email'),
  body('firstName').optional().trim().notEmpty().withMessage('Имя обязательно'),
  body('lastName').optional().trim().notEmpty().withMessage('Фамилия обязательна'),
];

// Контроллеры

// Получить избранные контакты
export async function getFavorites(req: AuthRequest, res: Response) {
  try {
    const favorites = await contactService.getFavorites(req.user!.id);
    return sendSuccess(res, favorites);
  } catch (error) {
    return sendError(res, 'Ошибка получения избранного', 500);
  }
}

// Добавить/Убрать из избранного
export async function toggleFavorite(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params; // contactId
    const { isFavorite } = req.body;

    let success;
    if (isFavorite) {
      success = await contactService.addToFavorites(req.user!.id, id);
    } else {
      success = await contactService.removeFromFavorites(req.user!.id, id);
    }

    if (!success) {
      return sendError(res, 'Не удалось обновить статус избранного', 400);
    }

    return sendSuccess(res, { isFavorite }, isFavorite ? 'Добавлено в избранное' : 'Убрано из избранного');
  } catch (error) {
    return sendError(res, 'Ошибка обновления', 500);
  }
}

// Обновить свой профиль
export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { firstName, lastName, middleName, position, phone, phoneInternal, email, bio } = req.body;

    if (email && await userService.emailExists(email, req.user!.id)) {
      return sendError(res, 'Пользователь с таким email уже существует', 400);
    }

    const updated = await contactService.updateProfile(req.user!.id, {
      firstName,
      lastName,
      middleName,
      position,
      phone,
      phoneInternal,
      email,
      bio,
    });

    if (!updated) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    const user = await userService.toUserDto(req.user!.id);
    if (!user) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    return sendSuccess(res, user, 'Профиль обновлен');
  } catch (error) {
    const prismaCode =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: string }).code
        : undefined;
    if (prismaCode === 'P2002') {
      return sendError(res, 'Пользователь с таким email уже существует', 400);
    }
    return sendError(res, 'Ошибка обновления профиля', 500);
  }
}

// Загрузить аватар
export async function uploadAvatar(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return sendError(res, 'Файл не загружен', 400);
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const updated = await contactService.updateProfile(req.user!.id, {
      avatarUrl,
    });

    if (!updated) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    const user = await userService.toUserDto(req.user!.id);
    if (!user) {
      return sendError(res, 'Пользователь не найден', 404);
    }

    return sendSuccess(res, { user, avatarUrl }, 'Аватар обновлен');
  } catch (error) {
    console.error('Avatar upload error:', error);
    return sendError(res, 'Ошибка загрузки аватара', 500);
  }
}

// Поиск контактов
export async function searchContacts(req: Request, res: Response) {
  try {
    const { page, limit } = getPaginationParams(req.query as any);
    const search = req.query.search as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;

    const { contacts, total } = await contactService.searchContacts(
      search,
      departmentId,
      page,
      limit
    );

    return sendPaginated(res, contacts, page, limit, total);
  } catch (error) {
    console.error('Search contacts error:', error);
    return sendError(res, 'Ошибка поиска контактов', 500);
  }
}

// Получить контакт по ID
export async function getContact(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const contact = await contactService.getContactById(id);

    if (!contact) {
      return sendError(res, 'Контакт не найден', 404);
    }

    return sendSuccess(res, contact);
  } catch (error) {
    return sendError(res, 'Ошибка получения контакта', 500);
  }
}

// Получить все отделения
export async function getDepartments(req: Request, res: Response) {
  try {
    const departments = await contactService.getAllDepartments();
    return sendSuccess(res, departments);
  } catch (error) {
    return sendError(res, 'Ошибка получения отделений', 500);
  }
}

// Получить дерево отделений
export async function getDepartmentTree(req: Request, res: Response) {
  try {
    const tree = await contactService.getDepartmentTree();
    return sendSuccess(res, tree);
  } catch (error) {
    return sendError(res, 'Ошибка получения структуры', 500);
  }
}

// Создать отделение (только админ)
export async function createDepartment(req: AuthRequest, res: Response) {
  try {
    const { name, description, parentId, headId, order, color } = req.body;

    const department = await contactService.createDepartment({
      name,
      description,
      parentId,
      headId,
      order,
      color,
    });

    return sendSuccess(res, department, 'Отделение создано', 201);
  } catch (error) {
    console.error('Create department error:', error);
    return sendError(res, 'Ошибка создания отделения', 500);
  }
}

// Обновить отделение (только админ)
export async function updateDepartment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, parentId, headId, order, color } = req.body;

    const department = await contactService.updateDepartment(id, {
      name,
      description,
      parentId,
      headId,
      order,
      color,
    });

    if (!department) {
      return sendError(res, 'Отделение не найдено', 404);
    }

    return sendSuccess(res, department, 'Отделение обновлено');
  } catch (error) {
    return sendError(res, 'Ошибка обновления отделения', 500);
  }
}

// Удалить отделение (только админ)
export async function deleteDepartment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const success = await contactService.deleteDepartment(id);

    if (!success) {
      return sendError(res, 'Отделение не найдено', 404);
    }

    return sendSuccess(res, null, 'Отделение удалено');
  } catch (error) {
    return sendError(res, 'Ошибка удаления отделения', 500);
  }
}
