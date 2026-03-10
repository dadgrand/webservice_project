
import prisma from '../config/database.js';
import { MessageDto } from './messageService.js';

export interface ThreadDto {
  id: string;
  subject: string;
  updatedAt: Date;
  messages: MessageDto[];
}

// Получить цепочку сообщений
export async function getThread(
  threadId: string,
  userId: string
): Promise<ThreadDto | null> {
  // Проверяем доступ: пользователь должен быть участником хотя бы одного сообщения в треде
  // Но для простоты сначала получим тред
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
  });

  if (!thread) return null;

  // Получаем все сообщения треда
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
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

  // Проверяем доступ: пользователь должен быть либо отправителем, либо получателем хотя бы одного сообщения
  const hasAccess = messages.some(
    (msg) =>
      msg.senderId === userId || msg.recipients.some((r) => r.userId === userId)
  );

  if (!hasAccess) return null;

  return {
    id: thread.id,
    subject: thread.subject,
    updatedAt: thread.updatedAt,
    messages: messages.map((message) => {
      const recipientRecord = message.recipients.find((r) => r.userId === userId);
      return {
        id: message.id,
        subject: message.subject,
        content: message.content,
        isImportant: message.isImportant,
        createdAt: message.createdAt,
        threadId: message.threadId,
        replyToId: message.replyToId,
        forwardedFromId: message.forwardedFromId,
        threadMessageCount: messages.length,
        folderId: recipientRecord?.folderId ?? null,
        sender: message.sender,
        recipients: message.recipients.map((r) => r.user),
        labels:
          recipientRecord?.labels.map((assignment) => ({
            id: assignment.label.id,
            name: assignment.label.name,
            color: assignment.label.color,
          })) ?? [],
        attachments: message.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileUrl: `/api/messages/attachments/${a.id}/download`,
          fileSize: a.fileSize,
          mimeType: a.mimeType,
        })),
        isRead: recipientRecord?.isRead ?? true, // Если не получатель, то считаем прочитанным
        readAt: recipientRecord?.readAt ?? null,
        canOrganize: Boolean(recipientRecord),
      };
    }),
  };
}
