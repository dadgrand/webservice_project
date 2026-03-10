import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { uploadLearning } from '../config/multerLearning.js';
import * as learningController from '../controllers/learningController.js';

const router = Router();
const learningUploadRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много загрузок файлов обучения. Повторите позже.',
});

router.use(authenticate);

router.get('/summary', learningController.getSummary);
router.get('/audience', requirePermission('learning.edit'), learningController.getAudienceOptions);

router.post('/uploads', requirePermission('learning.edit'), learningUploadRateLimit, uploadLearning.single('file'), learningController.uploadFile);
router.get('/files/:fileName/view', learningController.viewFile);
router.get('/files/:fileName/download', learningController.downloadFile);

router.get('/', learningController.listMaterials);
router.post('/', requirePermission('learning.edit'), validate(learningController.createMaterialValidation), learningController.createMaterial);

router.get('/:id', validate(learningController.materialIdValidation), learningController.getMaterialById);
router.post('/:id/visit', validate(learningController.materialIdValidation), learningController.markVisited);

export default router;
