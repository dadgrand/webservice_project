import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const loginRateLimit = createRateLimitMiddleware({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много попыток входа. Повторите позже.',
});
const passwordChangeRateLimit = createRateLimitMiddleware({
  maxRequests: 10,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много попыток смены пароля. Повторите позже.',
});

// POST /api/auth/login - Авторизация
router.post(
  '/login',
  loginRateLimit,
  validate(authController.loginValidation),
  authController.login
);

// GET /api/auth/me - Текущий пользователь
router.get('/me', authenticate, authController.me);

// POST /api/auth/change-password - Смена пароля
router.post(
  '/change-password',
  authenticate,
  passwordChangeRateLimit,
  validate(authController.changePasswordValidation),
  authController.changePassword
);

// POST /api/auth/logout - Выход
router.post('/logout', authenticate, authController.logout);

export default router;
