import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { uploadTests } from '../config/multerTests.js';
import * as testController from '../controllers/testController.js';

const router = Router();
const testUploadRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много загрузок файлов тестов. Повторите позже.',
});

router.use(authenticate);

router.get('/summary', testController.getSummary);
router.get('/audience', requirePermission('tests.edit'), testController.getAudienceOptions);

router.post('/uploads', requirePermission('tests.edit'), testUploadRateLimit, uploadTests.single('file'), testController.uploadFile);
router.get('/files/:fileName/view', testController.viewFile);
router.get('/files/:fileName/download', testController.downloadFile);

router.get('/', testController.listTests);
router.post('/', requirePermission('tests.edit'), validate(testController.createTestValidation), testController.createTest);

router.get('/attempts/:attemptId', validate(testController.attemptIdValidation), testController.getAttemptById);
router.post(
  '/attempts/:attemptId/review',
  requirePermission('tests.edit'),
  validate(testController.reviewAttemptValidation),
  testController.reviewAttempt
);

router.get('/:id', validate(testController.testIdValidation), testController.getTestById);
router.post('/:id/submit', validate(testController.submitAttemptValidation), testController.submitAttempt);

export default router;
