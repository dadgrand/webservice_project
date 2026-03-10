import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { uploadNews } from '../config/multerNews.js';
import * as newsController from '../controllers/newsController.js';

const router = Router();
const newsUploadRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много загрузок медиафайлов. Повторите позже.',
});

router.use(authenticate);

router.post('/uploads', requirePermission('news.manage'), newsUploadRateLimit, uploadNews.single('file'), newsController.uploadMedia);
router.get('/files/:fileName/view', newsController.viewMedia);
router.get('/files/:fileName/download', newsController.downloadMedia);

router.get('/', newsController.listNews);
router.post('/', requirePermission('news.manage'), validate(newsController.createNewsValidation), newsController.createNews);

router.get('/:id', validate(newsController.newsIdValidation), newsController.getNewsById);
router.put('/:id', requirePermission('news.manage'), validate(newsController.updateNewsValidation), newsController.updateNews);
router.delete('/:id', requirePermission('news.manage'), validate(newsController.newsIdValidation), newsController.deleteNews);

export default router;
