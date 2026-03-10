
import prisma from '../config/database.js';
import { buildTextPreview } from '../utils/html.js';
import { getRecipientMessageScope } from './messageThreadService.js';
import { InboxMessageDto } from './messageService.js';

export interface LabelDto {
  id: string;
  name: string;
  color: string;
  messageCount?: number;
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

// Получить все метки пользователя
export async function getLabels(userId: string): Promise<LabelDto[]> {
  const labels = await prisma.messageLabel.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  return labels.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    messageCount: l._count.messages,
  }));
}

// Создать метку
export async function createLabel(
  userId: string,
  name: string,
  color: string = '#1976d2'
): Promise<LabelDto> {
  const existing = await prisma.messageLabel.findFirst({
    where: { userId, name },
  });

  if (existing) {
    throw new Error('Метка с таким именем уже существует');
  }

  const label = await prisma.messageLabel.create({
    data: {
      userId,
      name,
      color,
    },
  });

  return {
    id: label.id,
    name: label.name,
    color: label.color,
    messageCount: 0,
  };
}

// Обновить метку
export async function updateLabel(
  labelId: string,
  userId: string,
  data: { name?: string; color?: string }
): Promise<LabelDto | null> {
  const label = await prisma.messageLabel.findFirst({
    where: { id: labelId, userId },
  });

  if (!label) return null;

  if (data.name && data.name !== label.name) {
    const existing = await prisma.messageLabel.findFirst({
      where: { userId, name: data.name, id: { not: labelId } },
    });

    if (existing) {
      throw new Error('Метка с таким именем уже существует');
    }
  }

  const updated = await prisma.messageLabel.update({
    where: { id: labelId },
    data: {
      name: data.name,
      color: data.color,
    },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    color: updated.color,
    messageCount: updated._count.messages,
  };
}

// Удалить метку
export async function deleteLabel(labelId: string, userId: string): Promise<boolean> {
  const label = await prisma.messageLabel.findFirst({
    where: { id: labelId, userId },
  });

  if (!label) return false;

  await prisma.messageLabel.delete({
    where: { id: labelId },
  });

  return true;
}

// Присвоить метку сообщению
export async function addLabelToMessage(
  userId: string,
  messageId: string,
  labelId: string,
  applyToThread = false
): Promise<boolean> {
  // Проверяем, что метка принадлежит пользователю
  const label = await prisma.messageLabel.findFirst({
    where: { id: labelId, userId },
  });

  if (!label) return false;

  // Находим получателя (связь сообщения и пользователя)
  // Важно: recipientId в MessageLabelAssignment - это ID записи из message_recipients, а не userId или messageId
  const scope = await getRecipientMessageScope(userId, messageId, applyToThread);
  if (!scope) return false;

  const result = await prisma.messageLabelAssignment.createMany({
    data: scope.recipientIds.map((recipientId) => ({
      recipientId,
      labelId: label.id,
    })),
    skipDuplicates: true,
  });

  return result.count > 0 || scope.recipientIds.length > 0;
}

// Удалить метку с сообщения
export async function removeLabelFromMessage(
  userId: string,
  messageId: string,
  labelId: string,
  applyToThread = false
): Promise<boolean> {
  const scope = await getRecipientMessageScope(userId, messageId, applyToThread);
  if (!scope) return false;

  const result = await prisma.messageLabelAssignment.deleteMany({
    where: {
      recipientId: { in: scope.recipientIds },
      labelId,
    },
  });

  return result.count > 0 || scope.recipientIds.length > 0;
}

// Получить сообщения по метке
export async function getMessagesByLabel(
  userId: string,
  labelId: string,
  page = 1,
  limit = 20
): Promise<{ messages: InboxMessageDto[]; total: number }> {
  const skip = (page - 1) * limit;

  // Проверяем права на метку
  const label = await prisma.messageLabel.findFirst({
    where: { id: labelId, userId },
  });

  if (!label) {
    return { messages: [], total: 0 };
  }

  const assignments = await prisma.messageLabelAssignment.findMany({
    where: {
      labelId,
      recipient: {
        userId,
        deletedAt: null, // Не в корзине
      },
    },
    skip,
    take: limit,
    orderBy: { assignedAt: 'desc' }, // Сортируем по времени присвоения метки или можно по дате сообщения
    include: {
      recipient: {
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
            },
          },
        },
      },
    },
  });

  const total = await prisma.messageLabelAssignment.count({
    where: {
      labelId,
      recipient: {
        userId,
        deletedAt: null,
      },
    },
  });

  const threadIds = Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.recipient.message.threadId)
        .filter((threadId): threadId is string => Boolean(threadId))
    )
  );
  const threadCountMap = await buildThreadMessageCountMap(userId, threadIds);

  const messages: InboxMessageDto[] = assignments.map((a) => ({
    id: a.recipient.message.id,
    subject: a.recipient.message.subject,
    isImportant: a.recipient.message.isImportant,
    createdAt: a.recipient.message.createdAt,
    isRead: a.recipient.isRead,
    readAt: a.recipient.readAt,
    threadId: a.recipient.message.threadId,
    threadMessageCount: a.recipient.message.threadId ? threadCountMap.get(a.recipient.message.threadId) ?? 1 : 1,
    sender: a.recipient.message.sender,
    preview: buildTextPreview(a.recipient.message.content),
    labels: a.recipient.labels.map((assignment) => ({
      id: assignment.label.id,
      name: assignment.label.name,
      color: assignment.label.color,
    })),
    isStarred: a.recipient.isStarred,
    canOrganize: true,
  }));

  return { messages, total };
}
