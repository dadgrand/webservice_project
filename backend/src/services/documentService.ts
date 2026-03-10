import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';

export const DOCUMENT_THREAD_MODES = ['distribution', 'read_receipt', 'approval'] as const;
export const DOCUMENT_DISTRIBUTION_TYPES = ['all', 'departments', 'groups', 'individual'] as const;
export const DOCUMENT_THREAD_STATUSES = ['new', 'in_progress', 'changes_requested', 'completed'] as const;

export type DocumentThreadMode = (typeof DOCUMENT_THREAD_MODES)[number];
export type DocumentDistributionType = (typeof DOCUMENT_DISTRIBUTION_TYPES)[number];
export type DocumentThreadStatus = (typeof DOCUMENT_THREAD_STATUSES)[number];
export type DocumentDecision = 'approved' | 'changes_requested';

export class DocumentServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'DocumentServiceError';
  }
}

interface UploadedFilePayload {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface CreateThreadPayload {
  title: string;
  description?: string;
  mode: DocumentThreadMode;
  distributionType: DocumentDistributionType;
  requiresReadReceipt?: boolean;
  recipientIds?: string[];
  departmentIds?: string[];
  groupIds?: string[];
  files?: UploadedFilePayload[];
}

interface CreateGroupPayload {
  name: string;
  description?: string;
  memberIds: string[];
}

interface ListThreadsFilters {
  mode?: string;
  status?: string;
  q?: string;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

const threadSummaryInclude = Prisma.validator<Prisma.DocumentThreadInclude>()({
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      avatarUrl: true,
      position: true,
    },
  },
  recipients: {
    select: {
      userId: true,
      isRead: true,
      readAt: true,
      decision: true,
      decisionComment: true,
      decidedAt: true,
    },
  },
  files: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      isActive: true,
      version: true,
      createdAt: true,
    },
    orderBy: [
      { version: 'desc' },
      { createdAt: 'desc' },
    ],
  },
});

const threadDetailInclude = Prisma.validator<Prisma.DocumentThreadInclude>()({
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
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
          middleName: true,
          email: true,
          avatarUrl: true,
          position: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  departments: {
    include: {
      department: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  },
  groups: {
    include: {
      group: {
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
      },
    },
  },
  files: {
    include: {
      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
    },
    orderBy: [
      { version: 'desc' },
      { createdAt: 'desc' },
    ],
  },
  actions: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          position: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
});

type ThreadSummaryRecord = Prisma.DocumentThreadGetPayload<{ include: typeof threadSummaryInclude }>;
type ThreadDetailRecord = Prisma.DocumentThreadGetPayload<{ include: typeof threadDetailInclude }>;

function dedupeIds(ids: string[] | undefined): string[] {
  if (!ids || ids.length === 0) {
    return [];
  }

  return Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
}

function ensureValidMode(mode: string): asserts mode is DocumentThreadMode {
  if (!(DOCUMENT_THREAD_MODES as readonly string[]).includes(mode)) {
    throw new DocumentServiceError(400, 'Некорректный режим треда');
  }
}

function ensureValidDistributionType(distributionType: string): asserts distributionType is DocumentDistributionType {
  if (!(DOCUMENT_DISTRIBUTION_TYPES as readonly string[]).includes(distributionType)) {
    throw new DocumentServiceError(400, 'Некорректный тип рассылки');
  }
}

function ensureValidDecision(decision: string): asserts decision is DocumentDecision {
  if (decision !== 'approved' && decision !== 'changes_requested') {
    throw new DocumentServiceError(400, 'Некорректное решение согласования');
  }
}

interface ActiveThreadFileSnapshot {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
}

async function getNextThreadVersion(tx: Prisma.TransactionClient, threadId: string): Promise<number> {
  const versionInfo = await tx.document.aggregate({
    where: {
      threadId,
    },
    _max: {
      version: true,
    },
  });

  return (versionInfo._max.version ?? 0) + 1;
}

async function getActiveThreadFiles(tx: Prisma.TransactionClient, threadId: string): Promise<ActiveThreadFileSnapshot[]> {
  return tx.document.findMany({
    where: {
      threadId,
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      description: true,
      fileName: true,
      fileUrl: true,
      fileSize: true,
      mimeType: true,
      uploadedById: true,
    },
    orderBy: [
      { version: 'asc' },
      { createdAt: 'asc' },
    ],
  });
}

async function createThreadSnapshot(
  tx: Prisma.TransactionClient,
  params: {
    threadId: string;
    actorUserId: string;
    activeFiles: ActiveThreadFileSnapshot[];
    removeActiveFileIds?: string[];
    addFiles?: UploadedFilePayload[];
    createdTitle: string;
  }
): Promise<{ version: number; activeCount: number; addedCount: number; removedCount: number }> {
  const removeSet = new Set(params.removeActiveFileIds ?? []);
  const addFiles = params.addFiles ?? [];

  const invalidRemovedIds = [...removeSet].filter((id) => !params.activeFiles.some((file) => file.id === id));
  if (invalidRemovedIds.length > 0) {
    throw new DocumentServiceError(400, 'Можно удалять только файлы из текущей активной версии');
  }

  const retainedFiles = params.activeFiles.filter((file) => !removeSet.has(file.id));
  const version = await getNextThreadVersion(tx, params.threadId);

  if (params.activeFiles.length > 0) {
    await tx.document.updateMany({
      where: {
        threadId: params.threadId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }

  if (removeSet.size > 0) {
    await tx.document.updateMany({
      where: {
        id: {
          in: [...removeSet],
        },
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  for (const file of retainedFiles) {
    await tx.document.create({
      data: {
        title: file.title,
        description: file.description,
        threadId: params.threadId,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        version,
        uploadedById: file.uploadedById,
        isActive: true,
      },
    });
  }

  for (const file of addFiles) {
    await tx.document.create({
      data: {
        title: file.fileName,
        description: `Обновление треда: ${params.createdTitle}`,
        threadId: params.threadId,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        version,
        uploadedById: params.actorUserId,
        isActive: true,
      },
    });
  }

  return {
    version,
    activeCount: retainedFiles.length + addFiles.length,
    addedCount: addFiles.length,
    removedCount: removeSet.size,
  };
}

function mapThreadSummary(thread: ThreadSummaryRecord, userId: string) {
  const myRecipient = thread.recipients.find((recipient) => recipient.userId === userId) ?? null;
  const activeFiles = thread.files.filter((file) => file.isActive);
  const recipientStats = {
    total: thread.recipients.length,
    read: thread.recipients.filter((recipient) => recipient.isRead).length,
    approved: thread.recipients.filter((recipient) => recipient.decision === 'approved').length,
    changesRequested: thread.recipients.filter((recipient) => recipient.decision === 'changes_requested').length,
    pendingApproval: thread.recipients.filter((recipient) => !recipient.decision).length,
  };

  return {
    id: thread.id,
    title: thread.title,
    description: thread.description,
    mode: thread.mode,
    distributionType: thread.distributionType,
    status: thread.status,
    requiresReadReceipt: thread.requiresReadReceipt,
    isCompleted: thread.isCompleted,
    completedAt: thread.completedAt,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    createdBy: thread.createdBy,
    recipientStats,
    myRecipient,
    activeFileCount: activeFiles.length,
    totalFileCount: thread.files.length,
    latestActiveFile: activeFiles[0]
      ? {
          id: activeFiles[0].id,
          fileName: activeFiles[0].fileName,
          mimeType: activeFiles[0].mimeType,
          version: activeFiles[0].version,
          createdAt: activeFiles[0].createdAt,
        }
      : null,
  };
}

function mapThreadDetail(thread: ThreadDetailRecord, userId: string) {
  const myRecipient = thread.recipients.find((recipient) => recipient.userId === userId) ?? null;

  return {
    ...mapThreadSummary(thread, userId),
    recipients: thread.recipients.map((recipient) => ({
      id: recipient.id,
      isRead: recipient.isRead,
      readAt: recipient.readAt,
      decision: recipient.decision,
      decisionComment: recipient.decisionComment,
      decidedAt: recipient.decidedAt,
      user: recipient.user,
    })),
    departments: thread.departments.map((departmentLink) => departmentLink.department),
    groups: thread.groups.map((groupLink) => ({
      id: groupLink.group.id,
      name: groupLink.group.name,
      description: groupLink.group.description,
      memberCount: groupLink.group._count.members,
    })),
    files: thread.files.map((file) => ({
      id: file.id,
      title: file.title,
      description: file.description,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      version: file.version,
      isActive: file.isActive,
      deletedAt: file.deletedAt,
      createdAt: file.createdAt,
      uploadedBy: file.uploadedBy,
    })),
    actions: thread.actions.map((action) => ({
      id: action.id,
      action: action.action,
      comment: action.comment,
      createdAt: action.createdAt,
      user: action.user,
    })),
  };
}

async function resolveRecipientIds(
  tx: Prisma.TransactionClient,
  createdById: string,
  distributionType: DocumentDistributionType,
  recipientIds: string[],
  departmentIds: string[],
  groupIds: string[]
): Promise<string[]> {
  let candidates: string[] = [];

  if (distributionType === 'all') {
    const users = await tx.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    candidates = users.map((user) => user.id);
  }

  if (distributionType === 'individual') {
    if (recipientIds.length === 0) {
      throw new DocumentServiceError(400, 'Для индивидуальной рассылки укажите хотя бы одного получателя');
    }

    candidates = recipientIds;
  }

  if (distributionType === 'departments') {
    if (departmentIds.length === 0) {
      throw new DocumentServiceError(400, 'Для рассылки по отделениям укажите отделения');
    }

    const users = await tx.user.findMany({
      where: {
        isActive: true,
        departmentId: {
          in: departmentIds,
        },
      },
      select: {
        id: true,
      },
    });

    candidates = users.map((user) => user.id);
  }

  if (distributionType === 'groups') {
    if (groupIds.length === 0) {
      throw new DocumentServiceError(400, 'Для групповой рассылки укажите группы получателей');
    }

    const members = await tx.documentRecipientGroupMember.findMany({
      where: {
        groupId: {
          in: groupIds,
        },
      },
      select: {
        userId: true,
      },
    });

    candidates = members.map((member) => member.userId);
  }

  const validUsers = await tx.user.findMany({
    where: {
      id: {
        in: dedupeIds(candidates),
      },
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const resolved = dedupeIds(validUsers.map((user) => user.id)).filter((id) => id !== createdById);

  if (resolved.length === 0) {
    throw new DocumentServiceError(400, 'Не найдено активных получателей для выбранного типа рассылки');
  }

  return resolved;
}

async function getThreadAccess(threadId: string, userId: string, db: DbClient = prisma) {
  const thread = await db.documentThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      mode: true,
      status: true,
      createdById: true,
      recipients: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!thread) {
    throw new DocumentServiceError(404, 'Тред документов не найден');
  }

  const isCreator = thread.createdById === userId;
  const isRecipient = thread.recipients.some((recipient) => recipient.userId === userId);

  if (!isCreator && !isRecipient) {
    throw new DocumentServiceError(403, 'Нет доступа к треду документов');
  }

  return {
    thread,
    isCreator,
    isRecipient,
  };
}

async function recalculateThreadStatus(threadId: string, db: DbClient = prisma): Promise<void> {
  const thread = await db.documentThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      mode: true,
      status: true,
      requiresReadReceipt: true,
      isCompleted: true,
      completedAt: true,
      recipients: {
        select: {
          isRead: true,
          decision: true,
        },
      },
    },
  });

  if (!thread) {
    return;
  }

  const totalRecipients = thread.recipients.length;
  const allRead = totalRecipients > 0 && thread.recipients.every((recipient) => recipient.isRead);

  let nextStatus: DocumentThreadStatus = thread.status as DocumentThreadStatus;
  let isCompleted = false;

  if (thread.mode === 'approval') {
    const hasChangeRequests = thread.recipients.some((recipient) => recipient.decision === 'changes_requested');
    const allApproved = totalRecipients > 0 && thread.recipients.every((recipient) => recipient.decision === 'approved');

    if (hasChangeRequests) {
      nextStatus = 'changes_requested';
    } else if (allApproved) {
      nextStatus = 'completed';
      isCompleted = true;
    } else {
      nextStatus = 'in_progress';
    }
  } else if (allRead || thread.requiresReadReceipt) {
    nextStatus = allRead ? 'completed' : 'new';
    isCompleted = allRead;
  } else {
    nextStatus = allRead ? 'completed' : 'new';
    isCompleted = allRead;
  }

  if (
    nextStatus !== thread.status ||
    isCompleted !== thread.isCompleted ||
    (isCompleted && !thread.completedAt) ||
    (!isCompleted && thread.completedAt)
  ) {
    await db.documentThread.update({
      where: {
        id: threadId,
      },
      data: {
        status: nextStatus,
        isCompleted,
        completedAt: isCompleted ? thread.completedAt ?? new Date() : null,
      },
    });
  }
}

export async function listThreads(userId: string, filters: ListThreadsFilters = {}) {
  const where: Prisma.DocumentThreadWhereInput = {
    OR: [
      {
        createdById: userId,
      },
      {
        recipients: {
          some: {
            userId,
          },
        },
      },
    ],
  };

  if (filters.mode) {
    ensureValidMode(filters.mode);
    where.mode = filters.mode;
  }

  if (filters.status) {
    if (!(DOCUMENT_THREAD_STATUSES as readonly string[]).includes(filters.status)) {
      throw new DocumentServiceError(400, 'Некорректный статус треда');
    }
    where.status = filters.status;
  }

  if (filters.q) {
    where.AND = [
      {
        OR: [
          {
            title: {
              contains: filters.q,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: filters.q,
              mode: 'insensitive',
            },
          },
        ],
      },
    ];
  }

  const threads = await prisma.documentThread.findMany({
    where,
    include: threadSummaryInclude,
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return threads.map((thread) => mapThreadSummary(thread, userId));
}

export async function getThreadById(threadId: string, userId: string) {
  const thread = await prisma.documentThread.findUnique({
    where: { id: threadId },
    include: threadDetailInclude,
  });

  if (!thread) {
    throw new DocumentServiceError(404, 'Тред документов не найден');
  }

  const hasAccess = thread.createdById === userId || thread.recipients.some((recipient) => recipient.userId === userId);
  if (!hasAccess) {
    throw new DocumentServiceError(403, 'Нет доступа к треду документов');
  }

  return mapThreadDetail(thread, userId);
}

export async function createThread(userId: string, payload: CreateThreadPayload) {
  ensureValidMode(payload.mode);
  ensureValidDistributionType(payload.distributionType);

  const recipientIds = dedupeIds(payload.recipientIds);
  const departmentIds = dedupeIds(payload.departmentIds);
  const groupIds = dedupeIds(payload.groupIds);
  const files = payload.files ?? [];

  const threadId = await prisma.$transaction(async (tx) => {
    const resolvedRecipientIds = await resolveRecipientIds(
      tx,
      userId,
      payload.distributionType,
      recipientIds,
      departmentIds,
      groupIds
    );

    const thread = await tx.documentThread.create({
      data: {
        title: payload.title,
        description: payload.description,
        mode: payload.mode,
        distributionType: payload.distributionType,
        status: payload.mode === 'approval' ? 'in_progress' : 'new',
        requiresReadReceipt: payload.mode === 'read_receipt' ? true : Boolean(payload.requiresReadReceipt),
        createdById: userId,
      },
    });

    await tx.documentThreadRecipient.createMany({
      data: resolvedRecipientIds.map((recipientId) => ({
        threadId: thread.id,
        userId: recipientId,
      })),
      skipDuplicates: true,
    });

    if (departmentIds.length > 0) {
      await tx.documentThreadDepartment.createMany({
        data: departmentIds.map((departmentId) => ({
          threadId: thread.id,
          departmentId,
        })),
        skipDuplicates: true,
      });
    }

    if (groupIds.length > 0) {
      await tx.documentThreadGroup.createMany({
        data: groupIds.map((groupId) => ({
          threadId: thread.id,
          groupId,
        })),
        skipDuplicates: true,
      });
    }

    for (const file of files) {
      await tx.document.create({
        data: {
          title: file.fileName,
          description: `Вложение для треда: ${payload.title}`,
          threadId: thread.id,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          version: 1,
          uploadedById: userId,
          isActive: true,
        },
      });
    }

    await tx.documentApprovalAction.create({
      data: {
        threadId: thread.id,
        userId,
        action: 'created',
      },
    });

    return thread.id;
  });

  return getThreadById(threadId, userId);
}

export async function markThreadAsRead(threadId: string, userId: string) {
  const access = await getThreadAccess(threadId, userId);

  if (!access.isRecipient) {
    return getThreadById(threadId, userId);
  }

  await prisma.documentThreadRecipient.updateMany({
    where: {
      threadId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  await recalculateThreadStatus(threadId);

  return getThreadById(threadId, userId);
}

export async function submitDecision(
  threadId: string,
  userId: string,
  decision: string,
  comment?: string
) {
  ensureValidDecision(decision);

  const access = await getThreadAccess(threadId, userId);

  if (!access.isRecipient) {
    throw new DocumentServiceError(403, 'Решение может оставить только участник согласования');
  }

  if (access.thread.mode !== 'approval') {
    throw new DocumentServiceError(400, 'Решение доступно только для тредов согласования');
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentThreadRecipient.update({
      where: {
        threadId_userId: {
          threadId,
          userId,
        },
      },
      data: {
        decision,
        decisionComment: comment,
        decidedAt: new Date(),
        isRead: true,
        readAt: new Date(),
      },
    });

    await tx.documentApprovalAction.create({
      data: {
        threadId,
        userId,
        action: decision,
        comment,
      },
    });

    await recalculateThreadStatus(threadId, tx);
  });

  return getThreadById(threadId, userId);
}

export async function resubmitThread(threadId: string, userId: string, comment?: string) {
  const access = await getThreadAccess(threadId, userId);

  if (access.thread.mode !== 'approval') {
    throw new DocumentServiceError(400, 'Повторная отправка доступна только для тредов согласования');
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentThreadRecipient.updateMany({
      where: {
        threadId,
      },
      data: {
        decision: null,
        decisionComment: null,
        decidedAt: null,
      },
    });

    await tx.documentThread.update({
      where: {
        id: threadId,
      },
      data: {
        status: 'in_progress',
        isCompleted: false,
        completedAt: null,
      },
    });

    await tx.documentApprovalAction.create({
      data: {
        threadId,
        userId,
        action: 'resubmitted',
        comment,
      },
    });
  });

  return getThreadById(threadId, userId);
}

export async function addFilesToThread(threadId: string, userId: string, files: UploadedFilePayload[]) {
  if (files.length === 0) {
    throw new DocumentServiceError(400, 'Добавьте хотя бы один файл');
  }

  await getThreadAccess(threadId, userId);

  await prisma.$transaction(async (tx) => {
    const [thread, activeFiles] = await Promise.all([
      tx.documentThread.findUnique({
        where: { id: threadId },
        select: { title: true },
      }),
      getActiveThreadFiles(tx, threadId),
    ]);

    if (!thread) {
      throw new DocumentServiceError(404, 'Тред документов не найден');
    }

    const snapshot = await createThreadSnapshot(tx, {
      threadId,
      actorUserId: userId,
      activeFiles,
      addFiles: files,
      createdTitle: thread.title,
    });

    await tx.documentApprovalAction.create({
      data: {
        threadId,
        userId,
        action: 'files_updated',
        comment: `Версия v${snapshot.version}: добавлено ${snapshot.addedCount}, всего в версии ${snapshot.activeCount}`,
      },
    });

    await recalculateThreadStatus(threadId, tx);
  });

  return getThreadById(threadId, userId);
}

export async function removeThreadFile(threadId: string, fileId: string, userId: string) {
  await getThreadAccess(threadId, userId);

  await prisma.$transaction(async (tx) => {
    const [thread, activeFiles] = await Promise.all([
      tx.documentThread.findUnique({
        where: { id: threadId },
        select: { title: true },
      }),
      getActiveThreadFiles(tx, threadId),
    ]);

    if (!thread) {
      throw new DocumentServiceError(404, 'Тред документов не найден');
    }

    const target = activeFiles.find((file) => file.id === fileId);
    if (!target) {
      const existing = await tx.document.findFirst({
        where: {
          id: fileId,
          threadId,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        throw new DocumentServiceError(404, 'Файл треда не найден');
      }

      throw new DocumentServiceError(400, 'Удалять можно только файл из текущей активной версии');
    }

    const snapshot = await createThreadSnapshot(tx, {
      threadId,
      actorUserId: userId,
      activeFiles,
      removeActiveFileIds: [fileId],
      createdTitle: thread.title,
    });

    await tx.documentApprovalAction.create({
      data: {
        threadId,
        userId,
        action: 'file_removed',
        comment: `Версия v${snapshot.version}: удален ${target.fileName}, осталось ${snapshot.activeCount}`,
      },
    });

    await recalculateThreadStatus(threadId, tx);
  });

  return getThreadById(threadId, userId);
}

export async function getThreadFileById(threadId: string, fileId: string, userId: string) {
  await getThreadAccess(threadId, userId);

  const file = await prisma.document.findFirst({
    where: {
      id: fileId,
      threadId,
    },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      mimeType: true,
      fileSize: true,
      version: true,
      isActive: true,
      deletedAt: true,
    },
  });

  if (!file) {
    throw new DocumentServiceError(404, 'Файл треда не найден');
  }

  return file;
}

export async function listGroups(userId: string) {
  const groups = await prisma.documentRecipientGroup.findMany({
    where: {
      OR: [
        {
          createdById: userId,
        },
        {
          members: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          members: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    createdBy: group.createdBy,
    memberCount: group._count.members,
    members: group.members.map((member) => member.user),
  }));
}

export async function createGroup(userId: string, payload: CreateGroupPayload) {
  const memberIds = dedupeIds(payload.memberIds);
  if (memberIds.length === 0) {
    throw new DocumentServiceError(400, 'Для группы рассылки нужен хотя бы один участник');
  }

  const activeMembers = await prisma.user.findMany({
    where: {
      id: {
        in: memberIds,
      },
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (activeMembers.length === 0) {
    throw new DocumentServiceError(400, 'Не найдено активных участников для группы');
  }

  const group = await prisma.documentRecipientGroup.create({
    data: {
      name: payload.name,
      description: payload.description,
      createdById: userId,
      members: {
        createMany: {
          data: activeMembers.map((member) => ({
            userId: member.id,
          })),
          skipDuplicates: true,
        },
      },
    },
    include: {
      _count: {
        select: {
          members: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              email: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
    },
  });

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    createdBy: group.createdBy,
    memberCount: group._count.members,
    members: group.members.map((member) => member.user),
  };
}

export async function getAudienceOptions(userId: string) {
  const [users, departments, groups] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        avatarUrl: true,
        position: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          lastName: 'asc',
        },
        {
          firstName: 'asc',
        },
      ],
    }),
    prisma.department.findMany({
      select: {
        id: true,
        name: true,
        color: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    listGroups(userId),
  ]);

  return {
    users,
    departments,
    groups,
  };
}

export function getSupportedFormats() {
  return [
    {
      category: 'text',
      title: 'Текстовые',
      extensions: ['txt', 'md', 'rtf', 'doc', 'docx', 'odt', 'pdf'],
      preview: 'inline_or_text',
    },
    {
      category: 'tables',
      title: 'Табличные',
      extensions: ['csv', 'tsv', 'xls', 'xlsx', 'ods'],
      preview: 'inline_or_table',
    },
    {
      category: 'presentations',
      title: 'Презентации',
      extensions: ['ppt', 'pptx', 'odp', 'pdf'],
      preview: 'inline',
    },
    {
      category: 'images',
      title: 'Фото и изображения',
      extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff'],
      preview: 'image',
    },
    {
      category: 'video',
      title: 'Видео',
      extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'],
      preview: 'video',
    },
  ];
}
