import { Router } from 'express';
import * as contactController from '../controllers/contactController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { uploadAvatarConfig } from '../config/multerAvatar.js';

const router = Router();
const avatarUploadRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много загрузок аватара. Повторите позже.',
});

// Все маршруты требуют аутентификации
router.use(authenticate);

// GET /api/contacts/favorites - Избранные (должен быть перед /:id)
router.get('/favorites', contactController.getFavorites);

// PUT /api/contacts/me - Обновить свой профиль
router.put(
  '/me',
  validate(contactController.updateProfileValidation),
  contactController.updateProfile
);

// POST /api/contacts/me/avatar - Загрузить аватар
router.post('/me/avatar', avatarUploadRateLimit, uploadAvatarConfig.single('avatar'), contactController.uploadAvatar);

// GET /api/contacts/departments - Список отделений
router.get('/departments', contactController.getDepartments);

// GET /api/contacts/departments/tree - Дерево отделений
router.get('/departments/tree', contactController.getDepartmentTree);

// GET /api/contacts - Поиск контактов
router.get('/', contactController.searchContacts);

// GET /api/contacts/:id - Получить контакт
router.get('/:id', contactController.getContact);

// POST /api/contacts/:id/favorite - Toggle избранное
router.post('/:id/favorite', contactController.toggleFavorite);

// === Только для админов ===

// POST /api/contacts/departments - Создать отделение
router.post(
  '/departments',
  requireAdmin,
  validate(contactController.createDepartmentValidation),
  contactController.createDepartment
);

// PUT /api/contacts/departments/:id - Обновить отделение
router.put(
  '/departments/:id',
  requireAdmin,
  validate(contactController.updateDepartmentValidation),
  contactController.updateDepartment
);

// DELETE /api/contacts/departments/:id - Удалить отделение
router.delete('/departments/:id', requireAdmin, contactController.deleteDepartment);

export default router;
