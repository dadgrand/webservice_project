import prisma from '../config/database.js';

type MessageNode = {
  id: string;
  subject: string;
  threadId: string | null;
  replyToId: string | null;
};

async function getMessageNode(messageId: string): Promise<MessageNode | null> {
  return prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      subject: true,
      threadId: true,
      replyToId: true,
    },
  });
}

export async function ensureMessageThread(messageId: string): Promise<string | null> {
  const start = await getMessageNode(messageId);
  if (!start) {
    return null;
  }

  if (start.threadId) {
    return start.threadId;
  }

  const connectedIds = new Set<string>([start.id]);
  const ancestorIds: string[] = [start.id];
  let rootSubject = start.subject;
  let cursor = start;
  let existingThreadId: string | null = null;

  while (cursor.replyToId) {
    const parent = await getMessageNode(cursor.replyToId);
    if (!parent) {
      break;
    }

    connectedIds.add(parent.id);
    ancestorIds.push(parent.id);
    rootSubject = parent.subject || rootSubject;

    if (parent.threadId) {
      existingThreadId = parent.threadId;
      break;
    }

    cursor = parent;
  }

  let frontier = [...ancestorIds];

  while (frontier.length > 0) {
    const children = await prisma.message.findMany({
      where: { replyToId: { in: frontier } },
      select: {
        id: true,
        threadId: true,
      },
    });

    frontier = [];

    for (const child of children) {
      if (!connectedIds.has(child.id)) {
        connectedIds.add(child.id);
        frontier.push(child.id);
      }

      if (!existingThreadId && child.threadId) {
        existingThreadId = child.threadId;
      }
    }
  }

  const threadId =
    existingThreadId ??
    (
      await prisma.messageThread.create({
        data: {
          subject: rootSubject || start.subject,
        },
      })
    ).id;

  await prisma.message.updateMany({
    where: {
      id: { in: Array.from(connectedIds) },
      OR: [{ threadId: null }, { threadId: { not: threadId } }],
    },
    data: { threadId },
  });

  await prisma.messageThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  return threadId;
}

export async function getRecipientMessageScope(
  userId: string,
  messageId: string,
  applyToThread = false
): Promise<{ messageIds: string[]; recipientIds: string[]; threadId: string | null } | null> {
  const recipient = await prisma.messageRecipient.findUnique({
    where: { messageId_userId: { messageId, userId } },
    include: {
      message: {
        select: {
          id: true,
          threadId: true,
        },
      },
    },
  });

  if (!recipient) {
    if (!applyToThread) {
      return null;
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        threadId: true,
      },
    });

    if (!message || message.senderId !== userId) {
      return null;
    }

    const threadId = message.threadId ?? (await ensureMessageThread(message.id));
    if (!threadId) {
      return null;
    }

    const recipients = await prisma.messageRecipient.findMany({
      where: {
        userId,
        message: {
          threadId,
        },
      },
      select: {
        id: true,
        messageId: true,
      },
    });

    return {
      messageIds: recipients.map((item) => item.messageId),
      recipientIds: recipients.map((item) => item.id),
      threadId,
    };
  }

  if (!applyToThread) {
    return {
      messageIds: [recipient.messageId],
      recipientIds: [recipient.id],
      threadId: recipient.message.threadId,
    };
  }

  const threadId = recipient.message.threadId ?? (await ensureMessageThread(recipient.messageId));

  if (!threadId) {
    return {
      messageIds: [recipient.messageId],
      recipientIds: [recipient.id],
      threadId: null,
    };
  }

  const recipients = await prisma.messageRecipient.findMany({
    where: {
      userId,
      message: {
        threadId,
      },
    },
    select: {
      id: true,
      messageId: true,
    },
  });

  if (recipients.length === 0) {
    return {
      messageIds: [recipient.messageId],
      recipientIds: [recipient.id],
      threadId,
    };
  }

  return {
    messageIds: recipients.map((item) => item.messageId),
    recipientIds: recipients.map((item) => item.id),
    threadId,
  };
}
