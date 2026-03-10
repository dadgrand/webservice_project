import { Router } from 'express';
import * as messageController from '../controllers/messageController.js';
import * as folderController from '../controllers/folderController.js';
import * as labelController from '../controllers/labelController.js';
import * as extraController from '../controllers/messagesExtraController.js';
import * as attachmentController from '../controllers/attachmentController.js'; // New controller
import { upload } from '../config/multer.js'; // Multer config
import { authenticate } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const attachmentUploadRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  windowMs: 10 * 60 * 1000,
  message: 'Слишком много загрузок вложений. Повторите позже.',
});

// Все маршруты требуют аутентификации
router.use(authenticate);

// === ВЛОЖЕНИЯ ===
router.post('/attachments', attachmentUploadRateLimit, upload.single('file'), attachmentController.uploadAttachment);
router.get('/attachments/:id/download', attachmentController.downloadMessageAttachment);
router.get('/drafts/attachments/:id/download', attachmentController.downloadDraftAttachment);

// === ЧЕРНОВИКИ ===

router.get('/drafts', extraController.getDrafts);
router.post('/drafts', extraController.createDraft);
router.put('/drafts/:id', extraController.updateDraft);
router.delete('/drafts/:id', extraController.deleteDraft);

// === ТРЕДЫ ===
router.get('/thread/:id', extraController.getThread);

// === МЕТКИ ===
router.get('/labels', labelController.getLabels);
router.post('/labels', labelController.createLabel);
router.put('/labels/:id', labelController.updateLabel);
router.delete('/labels/:id', labelController.deleteLabel);
router.get('/labels/:id/messages', labelController.getMessagesByLabel);

// === ПАПКИ ===

router.get('/folders', folderController.getFolders);
router.post('/folders', folderController.createFolder);
router.put('/folders/:id', folderController.updateFolder);
router.delete('/folders/:id', folderController.deleteFolder);
router.post('/folders/reorder', folderController.reorderFolders);

// === СООБЩЕНИЯ ===

// GET /api/messages/search - Поиск (должен быть перед :id)
router.get('/search', messageController.searchMessages);

// GET /api/messages/starred - Избранные (должен быть перед :id)
router.get('/starred', messageController.getStarred);

// GET /api/messages/trash - Корзина
router.get('/trash', messageController.getTrash);

// GET /api/messages/inbox - Входящие
router.get('/inbox', messageController.getInbox);

// GET /api/messages/sent - Отправленные
router.get('/sent', messageController.getSent);

// GET /api/messages/unread-count - Количество непрочитанных
router.get('/unread-count', messageController.getUnreadCount);

// POST /api/messages/mark-all-read - Отметить все прочитанными
router.post('/mark-all-read', messageController.markAllAsRead);

// GET /api/messages/:id - Получить сообщение
router.get('/:id', messageController.getMessage);

// POST /api/messages - Отправить сообщение
router.post(
  '/',
  validate(messageController.sendMessageValidation),
  messageController.sendMessage
);

// POST /api/messages/:id/read - Отметить прочитанным
router.post('/:id/read', messageController.markAsRead);

// POST /api/messages/:id/star - Toggle избранное
router.post('/:id/star', messageController.toggleStar);

// POST /api/messages/:id/move - Переместить в папку
router.post('/:id/move', messageController.moveToFolder);

// POST /api/messages/:id/restore - Восстановить из корзины
router.post('/:id/restore', messageController.restoreMessage);

// POST /api/messages/:id/labels - Добавить метку
router.post('/:id/labels', labelController.addLabelToMessage);

// DELETE /api/messages/:id/labels/:labelId - Удалить метку
router.delete('/:id/labels/:labelId', labelController.removeLabelFromMessage);

// DELETE /api/messages/:id - Удалить (в корзину или навсегда ?permanent=true)
router.delete('/:id', messageController.deleteMessage);

export default router;
