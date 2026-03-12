import prisma from '../config/database.js';
import { buildTextPreview, sanitizeRichText } from '../utils/html.js';
import { ensureMessageThread, getRecipientMessageScope } from './messageThreadService.js';

type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  position?: string | null;
};

export interface MessageDto {
  id: string;
  subject: string;
  content: string;
  isImportant: boolean;
  createdAt: Date;
  threadId?: string | null;
  replyToId?: string | null;
  forwardedFromId?: string | null;
  threadMessageCount: number;
  folderId?: string | null;
  sender: UserSummary;
  recipients: UserSummary[];
  labels?: {
    id: string;
    name: string;
    color: string;
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }[];
  isRead?: boolean;
  readAt?: Date | null;
  isStarred?: boolean;
  canOrganize: boolean;
}

export interface InboxMessageDto {
  id: string;
  subject: string;
  isImportant: boolean;
  createdAt: Date;
  isRead: boolean;
  readAt: Date | null;
  threadId?: string | null;
  threadMessageCount: number;
  sender: UserSummary;
  preview: string;
  hasAttachments: boolean;
  labels?: {
    id: string;
    name: string;
    color: string;
  }[];
  isStarred?: boolean;
  canOrganize: boolean;
}

function buildPreview(content: string): string {
  return buildTextPreview(content);
}

async function buildThreadMessageCountMap(userId: string, threadIds: string[]): Promise<Map<string, number>> {
  if (threadIds.length === 0) {
    return new Map();
  }

  const counts = await prisma.message.groupBy({
    by: ['threadId'],
    where: {
      threadId: { in: threadIds },
      OR: [
        { senderId: userId },
        {
          recipients: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    _count: {
      _all: true,
    },
  });

  return new Map(
    counts
      .filter((entry): entry is typeof entry & { threadId: string } => typeof entry.threadId === 'string')
      .map((entry) => [entry.threadId, entry._count._all])
  );
}

function mapAttachment(attachment: {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): MessageDto['attachments'][number] {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileUrl: `/api/messages/attachments/${attachment.id}/download`,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
  };
}

function mapInboxMessage(recipient: {
  isRead: boolean;
  readAt: Date | null;
  isStarred: boolean;
  folderId: string | null;
  labels: Array<{
    label: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  message: {
    id: string;
    subject: string;
    isImportant: boolean;
    createdAt: Date;
    content: string;
    threadId: string | null;
    sender: UserSummary;
    attachments: Array<{ id: string }>;
  };
}, threadMessageCount = 1): InboxMessageDto {
  return {
    id: recipient.message.id,
    subject: recipient.message.subject,
    isImportant: recipient.message.isImportant,
    createdAt: recipient.message.createdAt,
    isRead: recipient.isRead,
    readAt: recipient.readAt,
    threadId: recipient.message.threadId,
    threadMessageCount,
    sender: recipient.message.sender,
    preview: buildPreview(recipient.message.content),
    hasAttachments: recipient.message.attachments.length > 0,
    labels: recipient.labels.map((assignment) => ({
      id: assignment.label.id,
      name: assignment.label.name,
      color: assignment.label.color,
    })),
    isStarred: recipient.isStarred,
    canOrganize: true,
  };
}

async function mapInboxMessages(
  userId: string,
  recipients: Array<Parameters<typeof mapInboxMessage>[0]>
): Promise<InboxMessageDto[]> {
  const threadIds = Array.from(
    new Set(recipients.map((recipient) => recipient.message.threadId).filter((threadId): threadId is string => Boolean(threadId)))
  );
  const threadCountMap = await buildThreadMessageCountMap(userId, threadIds);

  return recipients.map((recipient) =>
    mapInboxMessage(recipient, recipient.message.threadId ? threadCountMap.get(recipient.message.threadId) ?? 1 : 1)
  );
}

// Получить входящие сообщения
export async function getInbox(
  userId: string,
  page = 1,
  limit = 20,
  unreadOnly = false,
  folderId?: string | null
): Promise<{ messages: InboxMessageDto[]; total: number; unreadCount: number }> {
  const skip = (page - 1) * limit;

  const where: {
    userId: string;
    deletedAt: null;
    archivedAt: null;
    folderId?: string | null;
    isRead?: boolean;
  } = {
    userId,
    deletedAt: null,
    archivedAt: null,
  };

  if (folderId !== undefined) {
    where.folderId = folderId;
  } else {
    where.folderId = null;
  }

  if (unreadOnly) {
    where.isRead = false;
  }

  const [recipients, total, unreadCount] = await Promise.all([
    prisma.messageRecipient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { message: { createdAt: 'desc' } },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        message: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
            attachments: {
              select: {
                id: true,
              },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.messageRecipient.count({ where }),
    prisma.messageRecipient.count({
      where: {
        userId,
        deletedAt: null,
        archivedAt: null,
        isRead: false,
      },
    }),
  ]);

  return {
    messages: await mapInboxMessages(userId, recipients),
    total,
    unreadCount,
  };
}

// Получить сообщения со звездочкой
export async function getStarred(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ messages: InboxMessageDto[]; total: number }> {
  const skip = (page - 1) * limit;
  const where = {
    userId,
    isStarred: true,
    deletedAt: null,
    archivedAt: null,
  };

  const [recipients, total] = await Promise.all([
    prisma.messageRecipient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { message: { createdAt: 'desc' } },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        message: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
            attachments: {
              select: {
                id: true,
              },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.messageRecipient.count({ where }),
  ]);

  return { messages: await mapInboxMessages(userId, recipients), total };
}

// Получить корзину
export async function getTrash(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ messages: InboxMessageDto[]; total: number }> {
  const skip = (page - 1) * limit;
  const where = {
    userId,
    deletedAt: { not: null },
  };

  const [recipients, total] = await Promise.all([
    prisma.messageRecipient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { deletedAt: 'desc' },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        message: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
            attachments: {
              select: {
                id: true,
              },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.messageRecipient.count({ where }),
  ]);

  return { messages: await mapInboxMessages(userId, recipients), total };
}

// Переместить в папку
export async function moveToFolder(
  userId: string,
  messageId: string,
  folderId: string | null,
  applyToThread = false
): Promise<boolean> {
  let normalizedFolderId: string | null = folderId;

  if (folderId) {
    const folder = await prisma.messageFolder.findFirst({
      where: { id: folderId, userId },
      select: { id: true, type: true, name: true },
    });

    const canUseFolder = Boolean(
      folder && (folder.type === 'custom' || (folder.type === 'system' && folder.name === 'archive'))
    );

    if (!canUseFolder) {
      return false;
    }

    normalizedFolderId = folder?.id ?? null;
  }

  const scope = await getRecipientMessageScope(userId, messageId, applyToThread);
  if (!scope) {
    return false;
  }

  const result = await prisma.messageRecipient.updateMany({
    where: { id: { in: scope.recipientIds } },
    data: { folderId: normalizedFolderId, deletedAt: null, archivedAt: null },
  });

  return result.count > 0;
}

// Переключить звездочку
export async function toggleStar(
  userId: string,
  messageId: string
): Promise<boolean> {
  const recipient = await prisma.messageRecipient.findUnique({
    where: { messageId_userId: { messageId, userId } },
  });

  if (!recipient) return false;

  await prisma.messageRecipient.update({
    where: { id: recipient.id },
    data: { isStarred: !recipient.isStarred },
  });

  return !recipient.isStarred;
}

// Поиск сообщений
export async function searchMessages(
  userId: string,
  query: string,
  page = 1,
  limit = 20
): Promise<{ messages: InboxMessageDto[]; total: number }> {
  const skip = (page - 1) * limit;

  const where = {
    userId,
    deletedAt: null,
    archivedAt: null,
    OR: [
      { message: { subject: { contains: query, mode: 'insensitive' as const } } },
      { message: { content: { contains: query, mode: 'insensitive' as const } } },
      { message: { sender: { firstName: { contains: query, mode: 'insensitive' as const } } } },
      { message: { sender: { lastName: { contains: query, mode: 'insensitive' as const } } } },
      { message: { sender: { email: { contains: query, mode: 'insensitive' as const } } } },
    ],
  };

  const [recipients, total] = await Promise.all([
    prisma.messageRecipient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { message: { createdAt: 'desc' } },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        message: {
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
            attachments: {
              select: {
                id: true,
              },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.messageRecipient.count({ where }),
  ]);

  return { messages: await mapInboxMessages(userId, recipients), total };
}

// Удалить в корзину (Soft Delete)
export async function moveToTrash(
  userId: string,
  messageId: string
): Promise<boolean> {
  const recipientResult = await prisma.messageRecipient.updateMany({
    where: { messageId, userId },
    data: { deletedAt: new Date() },
  });

  if (recipientResult.count > 0) return true;

  const senderResult = await prisma.message.updateMany({
    where: { id: messageId, senderId: userId },
    data: { senderDeletedAt: new Date() },
  });

  return senderResult.count > 0;
}

// Восстановить сообщение из корзины
export async function restoreFromTrash(
  userId: string,
  messageId: string
): Promise<boolean> {
  const result = await prisma.messageRecipient.updateMany({
    where: {
      userId,
      messageId,
      deletedAt: { not: null },
    },
    data: {
      deletedAt: null,
      folderId: null,
    },
  });

  return result.count > 0;
}

// Удалить сообщение (навсегда)
export async function deleteMessageForUser(
  messageId: string,
  userId: string
): Promise<boolean> {
  const recipientResult = await prisma.messageRecipient.deleteMany({
    where: { messageId, userId },
  });

  if (recipientResult.count > 0) return true;

  const senderResult = await prisma.message.updateMany({
    where: { id: messageId, senderId: userId },
    data: { senderDeletedAt: new Date() },
  });

  return senderResult.count > 0;
}

// Получить отправленные сообщения
export async function getSent(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ messages: InboxMessageDto[]; total: number }> {
  const skip = (page - 1) * limit;
  const where = {
    senderId: userId,
    senderDeletedAt: null,
  };

  const [sentMessages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            position: true,
          },
        },
        attachments: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    }),
    prisma.message.count({ where }),
  ]);

  const threadIds = Array.from(
    new Set(sentMessages.map((message) => message.threadId).filter((threadId): threadId is string => Boolean(threadId)))
  );
  const threadCountMap = await buildThreadMessageCountMap(userId, threadIds);

  const messages: InboxMessageDto[] = sentMessages.map((message) => ({
    id: message.id,
    subject: message.subject,
    isImportant: message.isImportant,
    createdAt: message.createdAt,
    isRead: true,
    readAt: null,
    threadId: message.threadId,
    threadMessageCount: message.threadId ? threadCountMap.get(message.threadId) ?? 1 : 1,
    sender: message.sender,
    preview: buildPreview(message.content),
    hasAttachments: message.attachments.length > 0,
    labels: [],
    isStarred: false,
    canOrganize: false,
  }));

  return { messages, total };
}

// Получить сообщение по ID
export async function getMessageById(
  messageId: string,
  userId: string
): Promise<MessageDto | null> {
  const ensuredThreadId = await ensureMessageThread(messageId);

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          position: true,
        },
      },
      recipients: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          labels: {
            include: {
              label: true,
            },
          },
        },
      },
      attachments: true,
    },
  });

  if (!message) return null;

  const activeRecipients = message.recipients.filter((recipient) => recipient.deletedAt === null);
  const isRecipient = activeRecipients.some((recipient) => recipient.userId === userId);
  const isSender = message.senderId === userId;

  if (!isRecipient && !isSender) return null;

  if (isSender && message.senderDeletedAt && !isRecipient) return null;

  if (isRecipient) {
    await prisma.messageRecipient.updateMany({
      where: { messageId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  const recipientRecord = activeRecipients.find((recipient) => recipient.userId === userId);
  const threadId = message.threadId ?? ensuredThreadId;
  const threadMessageCount = threadId
    ? await prisma.message.count({
        where: {
          threadId,
          OR: [
            { senderId: userId },
            {
              recipients: {
                some: {
                  userId,
                },
              },
            },
          ],
        },
      })
    : 1;

  return {
    id: message.id,
    subject: message.subject,
    content: message.content,
    isImportant: message.isImportant,
    createdAt: message.createdAt,
    threadId,
    replyToId: message.replyToId,
    forwardedFromId: message.forwardedFromId,
    threadMessageCount,
    folderId: recipientRecord?.folderId ?? null,
    sender: message.sender,
    recipients: activeRecipients.map((recipient) => recipient.user),
    labels:
      recipientRecord?.labels.map((assignment) => ({
        id: assignment.label.id,
        name: assignment.label.name,
        color: assignment.label.color,
      })) ?? [],
    attachments: message.attachments.map(mapAttachment),
    isRead: recipientRecord?.isRead ?? true,
    readAt: recipientRecord?.readAt ?? null,
    isStarred: recipientRecord?.isStarred ?? false,
    canOrganize: Boolean(recipientRecord),
  };
}

// Отправить сообщение
export async function sendMessage(
  senderId: string,
  data: {
    subject: string;
    content: string;
    recipientIds: string[];
    isImportant?: boolean;
    replyToId?: string;
    forwardedFromId?: string;
    attachments?: { fileName: string; fileUrl: string; fileSize: number; mimeType: string }[];
  }
): Promise<MessageDto> {
  let threadId: string | null = null;

  if (data.replyToId) {
    threadId = await ensureMessageThread(data.replyToId);
  }

  const uniqueRecipientIds = Array.from(
    new Set(data.recipientIds.filter((id) => typeof id === 'string' && id.trim().length > 0 && id !== senderId))
  );
  const sanitizedContent = sanitizeRichText(data.content);

  const message = await prisma.message.create({
    data: {
      senderId,
      subject: data.subject,
      content: sanitizedContent,
      isImportant: data.isImportant || false,
      threadId,
      replyToId: data.replyToId,
      forwardedFromId: data.forwardedFromId,
      recipients: {
        create: uniqueRecipientIds.map((userId) => ({
          userId,
        })),
      },
      attachments: data.attachments
        ? {
            create: data.attachments.map((attachment) => ({
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
              fileSize: attachment.fileSize,
              mimeType: attachment.mimeType,
            })),
          }
        : undefined,
    },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          position: true,
        },
      },
      recipients: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      attachments: true,
    },
  });

  return {
    id: message.id,
    subject: message.subject,
    content: message.content,
    isImportant: message.isImportant,
    createdAt: message.createdAt,
    threadId: message.threadId,
    replyToId: message.replyToId,
    forwardedFromId: message.forwardedFromId,
    threadMessageCount: threadId ? 2 : 1,
    folderId: null,
    sender: message.sender,
    recipients: message.recipients.map((recipient) => recipient.user),
    labels: [],
    attachments: message.attachments.map(mapAttachment),
    canOrganize: false,
  };
}

// Отметить сообщение как прочитанное
export async function markAsRead(
  messageId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.messageRecipient.updateMany({
    where: { messageId, userId, isRead: false, deletedAt: null },
    data: { isRead: true, readAt: new Date() },
  });

  return result.count > 0;
}

// Отметить все как прочитанные
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.messageRecipient.updateMany({
    where: { userId, isRead: false, deletedAt: null },
    data: { isRead: true, readAt: new Date() },
  });

  return result.count;
}

// Получить количество непрочитанных
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.messageRecipient.count({
    where: { userId, isRead: false, deletedAt: null },
  });
}
