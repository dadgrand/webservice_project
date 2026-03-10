import prisma from '../config/database.js';
import { sanitizeRichText } from '../utils/html.js';

type DraftAttachmentInput = {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
};

function mapDraftAttachment(attachment: {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}): DraftDto['attachments'][number] {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    fileSize: attachment.fileSize,
    mimeType: attachment.mimeType,
  };
}

export interface DraftDto {
  id: string;
  subject: string;
  content: string;
  recipientIds: string[];
  ccIds: string[];
  bccIds: string[];
  isImportant: boolean;
  updatedAt: Date;
  replyToId?: string | null;
  forwardFromId?: string | null;
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }[];
}

// Получить все черновики пользователя
export async function getDrafts(userId: string): Promise<DraftDto[]> {
  const drafts = await prisma.messageDraft.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      attachments: true,
    },
  });

  return drafts.map((draft) => ({
    id: draft.id,
    subject: draft.subject,
    content: draft.content,
    recipientIds: (draft.recipientIds as string[]) || [],
    ccIds: (draft.ccIds as string[]) || [],
    bccIds: (draft.bccIds as string[]) || [],
    isImportant: draft.isImportant,
    updatedAt: draft.updatedAt,
    replyToId: draft.replyToId,
    forwardFromId: draft.forwardFromId,
    attachments: draft.attachments.map(mapDraftAttachment),
  }));
}

// Получить черновик по ID
export async function getDraftById(
  draftId: string,
  userId: string
): Promise<DraftDto | null> {
  const draft = await prisma.messageDraft.findFirst({
    where: { id: draftId, userId },
    include: {
      attachments: true,
    },
  });

  if (!draft) return null;

  return {
    id: draft.id,
    subject: draft.subject,
    content: draft.content,
    recipientIds: (draft.recipientIds as string[]) || [],
    ccIds: (draft.ccIds as string[]) || [],
    bccIds: (draft.bccIds as string[]) || [],
    isImportant: draft.isImportant,
    updatedAt: draft.updatedAt,
    replyToId: draft.replyToId,
    forwardFromId: draft.forwardFromId,
    attachments: draft.attachments.map(mapDraftAttachment),
  };
}

// Создать черновик
export async function createDraft(
  userId: string,
  data: {
    subject?: string;
    content?: string;
    recipientIds?: string[];
    ccIds?: string[];
    bccIds?: string[];
    isImportant?: boolean;
    replyToId?: string;
    forwardFromId?: string;
    attachments?: DraftAttachmentInput[];
  }
): Promise<DraftDto> {
  const draft = await prisma.messageDraft.create({
    data: {
      userId,
      subject: data.subject || '',
      content: data.content ? sanitizeRichText(data.content) : '',
      recipientIds: data.recipientIds || [],
      ccIds: data.ccIds || [],
      bccIds: data.bccIds || [],
      isImportant: data.isImportant || false,
      replyToId: data.replyToId,
      forwardFromId: data.forwardFromId,
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
      attachments: true,
    },
  });

  return {
    id: draft.id,
    subject: draft.subject,
    content: draft.content,
    recipientIds: (draft.recipientIds as string[]) || [],
    ccIds: (draft.ccIds as string[]) || [],
    bccIds: (draft.bccIds as string[]) || [],
    isImportant: draft.isImportant,
    updatedAt: draft.updatedAt,
    replyToId: draft.replyToId,
    forwardFromId: draft.forwardFromId,
    attachments: draft.attachments.map(mapDraftAttachment),
  };
}

// Обновить черновик
export async function updateDraft(
  draftId: string,
  userId: string,
  data: {
    subject?: string;
    content?: string;
    recipientIds?: string[];
    ccIds?: string[];
    bccIds?: string[];
    isImportant?: boolean;
    attachments?: DraftAttachmentInput[];
  }
): Promise<DraftDto | null> {
  const draft = await prisma.messageDraft.findFirst({
    where: { id: draftId, userId },
  });

  if (!draft) return null;

  const updated = await prisma.messageDraft.update({
    where: { id: draftId },
    data: {
      subject: data.subject,
      content: data.content === undefined ? undefined : sanitizeRichText(data.content),
      recipientIds: data.recipientIds,
      ccIds: data.ccIds,
      bccIds: data.bccIds,
      isImportant: data.isImportant,
      attachments:
        data.attachments === undefined
          ? undefined
          : {
              deleteMany: {},
              create: data.attachments.map((attachment) => ({
                fileName: attachment.fileName,
                fileUrl: attachment.fileUrl,
                fileSize: attachment.fileSize,
                mimeType: attachment.mimeType,
              })),
            },
    },
    include: {
      attachments: true,
    },
  });

  return {
    id: updated.id,
    subject: updated.subject,
    content: updated.content,
    recipientIds: (updated.recipientIds as string[]) || [],
    ccIds: (updated.ccIds as string[]) || [],
    bccIds: (updated.bccIds as string[]) || [],
    isImportant: updated.isImportant,
    updatedAt: updated.updatedAt,
    replyToId: updated.replyToId,
    forwardFromId: updated.forwardFromId,
    attachments: updated.attachments.map(mapDraftAttachment),
  };
}

// Удалить черновик
export async function deleteDraft(draftId: string, userId: string): Promise<boolean> {
  const draft = await prisma.messageDraft.findFirst({
    where: { id: draftId, userId },
  });

  if (!draft) return false;

  await prisma.messageDraft.delete({
    where: { id: draftId },
  });

  return true;
}
