
import { Router } from 'express';
import * as orgTreeController from '../controllers/orgTreeController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

// GET /api/org-tree - Получить дерево
router.get('/', orgTreeController.getTree);

// === Только для админов ===

// POST /api/org-tree/nodes - Создать узел
router.post('/nodes', requireAdmin, orgTreeController.createNode);

// PUT /api/org-tree/nodes/:id - Обновить узел
router.put('/nodes/:id', requireAdmin, orgTreeController.updateNode);

// DELETE /api/org-tree/nodes/:id - Удалить узел
router.delete('/nodes/:id', requireAdmin, orgTreeController.deleteNode);

export default router;
