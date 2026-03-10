import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { uploadDocuments } from '../config/multerDocuments.js';
import * as documentController from '../controllers/documentController.js';

const router = Router();
const documentUploadRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много загрузок документов. Повторите позже.',
});

router.use(authenticate);

router.get('/supported-formats', documentController.getSupportedFormats);
router.get('/audience', requirePermission('documents.edit'), documentController.getAudienceOptions);

router.get('/groups', documentController.getGroups);
router.post('/groups', requirePermission('documents.edit'), validate(documentController.createGroupValidation), documentController.createGroup);

router.post('/uploads', requirePermission('documents.edit'), documentUploadRateLimit, uploadDocuments.single('file'), documentController.uploadFile);

router.get('/threads', validate(documentController.listThreadsValidation), documentController.getThreads);
router.post('/threads', requirePermission('documents.edit'), validate(documentController.createThreadValidation), documentController.createThread);
router.get('/threads/:id', validate(documentController.threadIdValidation), documentController.getThread);
router.post('/threads/:id/read', validate(documentController.threadIdValidation), documentController.markThreadAsRead);
router.post('/threads/:id/decision', validate(documentController.decisionValidation), documentController.submitDecision);
router.post('/threads/:id/resubmit', requirePermission('documents.edit'), validate(documentController.threadIdValidation), documentController.resubmitThread);
router.post('/threads/:id/files', requirePermission('documents.edit'), validate(documentController.addFilesValidation), documentController.addFilesToThread);

router.delete(
  '/threads/:threadId/files/:fileId',
  requirePermission('documents.edit'),
  validate(documentController.threadFileValidation),
  documentController.deleteThreadFile
);
router.get(
  '/threads/:threadId/files/:fileId/download',
  validate(documentController.threadFileValidation),
  documentController.downloadThreadFile
);
router.get(
  '/threads/:threadId/files/:fileId/view',
  validate(documentController.threadFileValidation),
  documentController.viewThreadFile
);

export default router;
