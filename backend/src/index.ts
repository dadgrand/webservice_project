import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { initSocket } from './services/socketService.js';

import { config } from './config/index.js';
import logger from './config/logger.js';
import prisma from './config/database.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initializePermissions } from './services/permissionService.js';
import { extractTokenFromCookieHeader, verifyToken } from './utils/auth.js';
import { bootstrapAdmin } from './services/bootstrapService.js';

const app = express();
const httpServer = createServer(app);
let isShuttingDown = false;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  return config.frontendUrls.includes(origin);
}

function corsOriginHandler(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void): void {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin is not allowed by CORS'));
}

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// Socket.io для real-time сообщений
const io = new SocketServer(httpServer, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const authToken =
      (typeof socket.handshake.auth.token === 'string' && socket.handshake.auth.token.trim()) ||
      (typeof socket.handshake.headers.authorization === 'string' && socket.handshake.headers.authorization.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice('Bearer '.length).trim()
        : null) ||
      extractTokenFromCookieHeader(socket.handshake.headers.cookie);

    if (!authToken) {
      next(new Error('Authentication required'));
      return;
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      next(new Error('Invalid token'));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!user || !user.isActive) {
      next(new Error('User is inactive'));
      return;
    }

    socket.data.user = {
      id: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      permissions: user.permissions.map((item) => item.permission.code),
    };

    next();
  } catch (error) {
    next(error instanceof Error ? error : new Error('Socket authentication failed'));
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', routes);

// Static files (avatars only, attachments via API)
app.use(
  '/uploads/avatars',
  express.static(`${config.paths.uploads}/avatars`, {
    setHeaders: (res) => {
      // Allow avatars to render when the frontend is served from a different origin.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  const userId = typeof socket.data.user?.id === 'string' ? socket.data.user.id : null;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${userId}`);
  logger.debug(`Socket connected: ${socket.id}`);

  socket.on('join', () => {
    socket.join(`user:${userId}`);
    logger.debug(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// Initialize socket service
initSocket(io);

// Export io for use in other modules
export { io };

// Start server
async function start() {
  try {
    // Проверка подключения к БД
    await prisma.$connect();
    logger.info('Database connected');
    const initializedPermissions = await initializePermissions();
    logger.info(`Permissions synchronized: ${initializedPermissions}`);
    await bootstrapAdmin();

    httpServer.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received, shutting down...`);

  try {
    await new Promise<void>((resolve, reject) => {
      io.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await prisma.$disconnect();
    process.exit(exitCode);
  } catch (error) {
    logger.error('Graceful shutdown failed', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  void shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  void shutdown('uncaughtException', 1);
});

start();
