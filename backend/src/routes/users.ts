import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

// GET /api/users - Список пользователей
router.get('/', requirePermission('users.view', 'users.manage'), userController.getUsers);

// GET /api/users/permissions - Список всех разрешений
router.get('/permissions', requirePermission('users.view', 'users.manage'), userController.getPermissions);

// GET /api/users/:id - Получить пользователя
router.get('/:id', requirePermission('users.view', 'users.manage'), userController.getUser);

// POST /api/users - Создать пользователя
router.post(
  '/',
  requirePermission('users.manage'),
  validate(userController.createUserValidation),
  userController.createUser
);

// PUT /api/users/:id - Обновить пользователя
router.put(
  '/:id',
  requirePermission('users.manage'),
  validate(userController.updateUserValidation),
  userController.updateUser
);

// DELETE /api/users/:id - Удалить пользователя
router.delete('/:id', requirePermission('users.manage'), userController.deleteUser);

// POST /api/users/:id/reset-password - Сбросить пароль
router.post('/:id/reset-password', requirePermission('users.manage'), userController.resetUserPassword);

export default router;
