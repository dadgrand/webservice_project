import prisma from '../config/database.js';
import { PermissionCodes } from '../types/index.js';

// Получить все доступные разрешения
export async function getAllPermissions() {
  return prisma.permission.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

// Получить разрешения пользователя
export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!user) return [];
  if (user.isAdmin) {
    // Админ имеет все разрешения
    const allPermissions = await prisma.permission.findMany();
    return allPermissions.map((p) => p.code);
  }

  return user.permissions.map((up) => up.permission.code);
}

// Проверить наличие разрешения у пользователя
export async function hasPermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!user) return false;
  if (user.isAdmin) return true;

  return user.permissions.some((up) => up.permission.code === permissionCode);
}

// Добавить разрешение пользователю
export async function addPermission(
  userId: string,
  permissionCode: string,
  grantedBy: string
): Promise<boolean> {
  const permission = await prisma.permission.findUnique({
    where: { code: permissionCode },
  });

  if (!permission) return false;

  const existing = await prisma.userPermission.findUnique({
    where: {
      userId_permissionId: {
        userId,
        permissionId: permission.id,
      },
    },
  });

  if (existing) return true;

  await prisma.userPermission.create({
    data: {
      userId,
      permissionId: permission.id,
      grantedBy,
    },
  });

  return true;
}

// Удалить разрешение у пользователя
export async function removePermission(
  userId: string,
  permissionCode: string
): Promise<boolean> {
  const permission = await prisma.permission.findUnique({
    where: { code: permissionCode },
  });

  if (!permission) return false;

  await prisma.userPermission.deleteMany({
    where: {
      userId,
      permissionId: permission.id,
    },
  });

  return true;
}

// Инициализация базовых разрешений (для seed)
export async function initializePermissions() {
  const permissions = [
    {
      code: PermissionCodes.TESTS_EDIT,
      name: 'Редактирование тестов',
      description: 'Создание и редактирование тестов для персонала',
      category: 'tests',
    },
    {
      code: PermissionCodes.TESTS_STATS,
      name: 'Просмотр статистики тестов',
      description: 'Просмотр результатов и статистики прохождения тестов',
      category: 'tests',
    },
    {
      code: PermissionCodes.LEARNING_EDIT,
      name: 'Редактирование обучающих материалов',
      description: 'Создание и редактирование курсов и уроков',
      category: 'learning',
    },
    {
      code: PermissionCodes.LEARNING_STATS,
      name: 'Просмотр статистики обучения',
      description: 'Просмотр прогресса обучения сотрудников',
      category: 'learning',
    },
    {
      code: PermissionCodes.DOCUMENTS_EDIT,
      name: 'Управление документами',
      description: 'Загрузка, редактирование и удаление документов',
      category: 'documents',
    },
    {
      code: PermissionCodes.MESSAGES_BROADCAST,
      name: 'Массовые рассылки',
      description: 'Отправка сообщений всем или группе сотрудников',
      category: 'messages',
    },
    {
      code: PermissionCodes.NEWS_MANAGE,
      name: 'Управление новостями',
      description: 'Создание, редактирование и удаление новостей',
      category: 'news',
    },
    {
      code: PermissionCodes.USERS_VIEW,
      name: 'Просмотр пользователей',
      description: 'Просмотр списка пользователей системы',
      category: 'users',
    },
    {
      code: PermissionCodes.USERS_MANAGE,
      name: 'Управление пользователями',
      description: 'Создание, редактирование и удаление пользователей',
      category: 'users',
    },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: perm,
      create: perm,
    });
  }

  return permissions.length;
}
