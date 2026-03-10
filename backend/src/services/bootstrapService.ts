import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import logger from '../config/logger.js';
import { config } from '../config/index.js';

const SALT_ROUNDS = 12;

export async function bootstrapAdmin(): Promise<void> {
  const adminCount = await prisma.user.count({
    where: {
      isAdmin: true,
      isActive: true,
    },
  });

  const email = config.bootstrapAdmin.email;
  const password = config.bootstrapAdmin.password;

  if (!email || !password) {
    if (adminCount === 0) {
      logger.warn('No active admin user found. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before the first production launch.');
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      isAdmin: true,
      isActive: true,
      position: 'Системный администратор',
    },
    create: {
      email,
      password: passwordHash,
      firstName: 'Системный',
      lastName: 'Администратор',
      middleName: null,
      position: 'Системный администратор',
      isAdmin: true,
      isActive: true,
      bio: 'Первичный администратор, созданный bootstrap-конфигурацией.',
    },
  });

  logger.info(`Bootstrap admin ensured: ${user.email}`);
}
