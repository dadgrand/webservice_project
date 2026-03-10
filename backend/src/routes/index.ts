import { Router } from 'express';
import prisma from '../config/database.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import contactRoutes from './contacts.js';
import messageRoutes from './messages.js';
import orgTreeRoutes from './orgTree.js';
import documentRoutes from './documents.js';
import testRoutes from './tests.js';
import learningRoutes from './learning.js';
import newsRoutes from './news.js';

const router = Router();

// Health check
router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString(), database: 'unavailable' });
  }
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/contacts', contactRoutes);
router.use('/messages', messageRoutes);
router.use('/org-tree', orgTreeRoutes);
router.use('/documents', documentRoutes);
router.use('/tests', testRoutes);
router.use('/learning', learningRoutes);
router.use('/news', newsRoutes);

// Будущие маршруты:
// router.use('/courses', courseRoutes);

export default router;
