import prisma from '../config/database.js';

// Типы системных папок
export const SYSTEM_FOLDERS = {
  INBOX: 'inbox',
  SENT: 'sent',
  DRAFTS: 'drafts',
  TRASH: 'trash',
  ARCHIVE: 'archive',
} as const;

export type SystemFolderType = (typeof SYSTEM_FOLDERS)[keyof typeof SYSTEM_FOLDERS];

export interface FolderDto {
  id: string;
  name: string;
  type: 'system' | 'custom';
  icon: string | null;
  color: string | null;
  order: number;
  messageCount: number;
  unreadCount: number;
}

// Названия системных папок на русском
const SYSTEM_FOLDER_NAMES: Record<SystemFolderType, string> = {
  inbox: 'Входящие',
  sent: 'Отправленные',
  drafts: 'Черновики',
  trash: 'Корзина',
  archive: 'Архив',
};

// Иконки системных папок
const SYSTEM_FOLDER_ICONS: Record<SystemFolderType, string> = {
  inbox: 'inbox',
  sent: 'send',
  drafts: 'edit',
  trash: 'delete',
  archive: 'archive',
};

// Инициализация системных папок для пользователя
export async function initializeSystemFolders(userId: string): Promise<void> {
  const existingFolders = await prisma.messageFolder.findMany({
    where: { userId, type: 'system' },
  });

  const existingTypes = existingFolders.map((f) => f.name);
  const foldersToCreate: { userId: string; name: string; type: string; icon: string; order: number }[] = [];

  Object.entries(SYSTEM_FOLDERS).forEach(([, value], index) => {
    if (!existingTypes.includes(value)) {
      foldersToCreate.push({
        userId,
        name: value,
        type: 'system',
        icon: SYSTEM_FOLDER_ICONS[value],
        order: index,
      });
    }
  });

  if (foldersToCreate.length > 0) {
    await prisma.messageFolder.createMany({
      data: foldersToCreate,
    });
  }
}

// Получить все папки пользователя с счётчиками
export async function getFolders(userId: string): Promise<FolderDto[]> {
  // Убедимся, что системные папки созданы
  await initializeSystemFolders(userId);

  const folders = await prisma.messageFolder.findMany({
    where: { userId },
    orderBy: [{ type: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  });

  // Получаем счётчики для каждой папки
  const foldersWithCounts = await Promise.all(
    folders.map(async (folder) => {
      let messageCount = 0;
      let unreadCount = 0;

      if (folder.name === SYSTEM_FOLDERS.INBOX) {
        // Входящие: сообщения где пользователь - получатель, не удалённые, не в архиве
        const [total, unread] = await Promise.all([
          prisma.messageRecipient.count({
            where: {
              userId,
              deletedAt: null,
              archivedAt: null,
              OR: [{ folderId: null }, { folderId: folder.id }],
            },
          }),
          prisma.messageRecipient.count({
            where: {
              userId,
              isRead: false,
              deletedAt: null,
              archivedAt: null,
              OR: [{ folderId: null }, { folderId: folder.id }],
            },
          }),
        ]);
        messageCount = total;
        unreadCount = unread;
      } else if (folder.name === SYSTEM_FOLDERS.SENT) {
        // Отправленные: сообщения где пользователь - отправитель
        messageCount = await prisma.message.count({
          where: { senderId: userId },
        });
        unreadCount = 0; // Отправленные не имеют статуса прочтения для отправителя
      } else if (folder.name === SYSTEM_FOLDERS.DRAFTS) {
        // Черновики
        messageCount = await prisma.messageDraft.count({
          where: { userId },
        });
        unreadCount = 0;
      } else if (folder.name === SYSTEM_FOLDERS.TRASH) {
        // Корзина: удалённые сообщения
        const [total, unread] = await Promise.all([
          prisma.messageRecipient.count({
            where: {
              userId,
              deletedAt: { not: null },
            },
          }),
          prisma.messageRecipient.count({
            where: {
              userId,
              deletedAt: { not: null },
              isRead: false,
            },
          }),
        ]);
        messageCount = total;
        unreadCount = unread;
      } else if (folder.name === SYSTEM_FOLDERS.ARCHIVE) {
        // Архив
        const [total, unread] = await Promise.all([
          prisma.messageRecipient.count({
            where: {
              userId,
              archivedAt: { not: null },
              deletedAt: null,
            },
          }),
          prisma.messageRecipient.count({
            where: {
              userId,
              archivedAt: { not: null },
              deletedAt: null,
              isRead: false,
            },
          }),
        ]);
        messageCount = total;
        unreadCount = unread;
      } else {
        // Кастомная папка
        const [total, unread] = await Promise.all([
          prisma.messageRecipient.count({
            where: {
              userId,
              folderId: folder.id,
              deletedAt: null,
            },
          }),
          prisma.messageRecipient.count({
            where: {
              userId,
              folderId: folder.id,
              deletedAt: null,
              isRead: false,
            },
          }),
        ]);
        messageCount = total;
        unreadCount = unread;
      }

      return {
        id: folder.id,
        name: folder.type === 'system' ? SYSTEM_FOLDER_NAMES[folder.name as SystemFolderType] || folder.name : folder.name,
        type: folder.type as 'system' | 'custom',
        icon: folder.icon,
        color: folder.color,
        order: folder.order,
        messageCount,
        unreadCount,
        // Добавляем системное имя для фронтенда
        systemName: folder.type === 'system' ? folder.name : null,
      };
    })
  );

  return foldersWithCounts;
}

// Получить папку по ID
export async function getFolderById(folderId: string, userId: string): Promise<FolderDto | null> {
  const folder = await prisma.messageFolder.findFirst({
    where: { id: folderId, userId },
  });

  if (!folder) return null;

  // Получаем счётчики
  const [messageCount, unreadCount] = await Promise.all([
    prisma.messageRecipient.count({
      where: { userId, folderId, deletedAt: null },
    }),
    prisma.messageRecipient.count({
      where: { userId, folderId, deletedAt: null, isRead: false },
    }),
  ]);

  return {
    id: folder.id,
    name: folder.type === 'system' ? SYSTEM_FOLDER_NAMES[folder.name as SystemFolderType] || folder.name : folder.name,
    type: folder.type as 'system' | 'custom',
    icon: folder.icon,
    color: folder.color,
    order: folder.order,
    messageCount,
    unreadCount,
  };
}

// Получить системную папку по типу
export async function getSystemFolder(userId: string, folderType: SystemFolderType): Promise<{ id: string } | null> {
  const folder = await prisma.messageFolder.findFirst({
    where: { userId, name: folderType, type: 'system' },
    select: { id: true },
  });

  return folder;
}

// Создать кастомную папку
export async function createFolder(
  userId: string,
  data: { name: string; icon?: string; color?: string }
): Promise<FolderDto> {
  // Проверяем уникальность имени
  const existing = await prisma.messageFolder.findFirst({
    where: { userId, name: data.name },
  });

  if (existing) {
    throw new Error('Папка с таким именем уже существует');
  }

  // Получаем максимальный order
  const maxOrder = await prisma.messageFolder.aggregate({
    where: { userId },
    _max: { order: true },
  });

  const folder = await prisma.messageFolder.create({
    data: {
      userId,
      name: data.name,
      type: 'custom',
      icon: data.icon || null,
      color: data.color || null,
      order: (maxOrder._max.order || 0) + 1,
    },
  });

  return {
    id: folder.id,
    name: folder.name,
    type: 'custom',
    icon: folder.icon,
    color: folder.color,
    order: folder.order,
    messageCount: 0,
    unreadCount: 0,
  };
}

// Обновить папку
export async function updateFolder(
  folderId: string,
  userId: string,
  data: { name?: string; icon?: string; color?: string }
): Promise<FolderDto | null> {
  const folder = await prisma.messageFolder.findFirst({
    where: { id: folderId, userId },
  });

  if (!folder) return null;

  // Системные папки можно только менять цвет
  if (folder.type === 'system' && data.name) {
    throw new Error('Нельзя переименовать системную папку');
  }

  // Проверяем уникальность нового имени
  if (data.name && data.name !== folder.name) {
    const existing = await prisma.messageFolder.findFirst({
      where: { userId, name: data.name, id: { not: folderId } },
    });

    if (existing) {
      throw new Error('Папка с таким именем уже существует');
    }
  }

  const updated = await prisma.messageFolder.update({
    where: { id: folderId },
    data: {
      name: folder.type === 'custom' ? data.name : undefined,
      icon: data.icon,
      color: data.color,
    },
  });

  // Получаем счётчики
  const [messageCount, unreadCount] = await Promise.all([
    prisma.messageRecipient.count({
      where: { userId, folderId, deletedAt: null },
    }),
    prisma.messageRecipient.count({
      where: { userId, folderId, deletedAt: null, isRead: false },
    }),
  ]);

  return {
    id: updated.id,
    name: updated.type === 'system' ? SYSTEM_FOLDER_NAMES[updated.name as SystemFolderType] || updated.name : updated.name,
    type: updated.type as 'system' | 'custom',
    icon: updated.icon,
    color: updated.color,
    order: updated.order,
    messageCount,
    unreadCount,
  };
}

// Удалить папку (только кастомные)
export async function deleteFolder(folderId: string, userId: string): Promise<boolean> {
  const folder = await prisma.messageFolder.findFirst({
    where: { id: folderId, userId },
  });

  if (!folder) return false;

  if (folder.type === 'system') {
    throw new Error('Нельзя удалить системную папку');
  }

  // Перемещаем все сообщения из папки во входящие (убираем folderId)
  await prisma.messageRecipient.updateMany({
    where: { folderId, userId },
    data: { folderId: null },
  });

  await prisma.messageFolder.delete({
    where: { id: folderId },
  });

  return true;
}

// Изменить порядок папок
export async function reorderFolders(
  userId: string,
  folderIds: string[]
): Promise<void> {
  // Обновляем order для каждой папки
  await Promise.all(
    folderIds.map((id, index) =>
      prisma.messageFolder.updateMany({
        where: { id, userId, type: 'custom' }, // Только кастомные папки можно переупорядочивать
        data: { order: index + 100 }, // Системные папки имеют order 0-10
      })
    )
  );
}
