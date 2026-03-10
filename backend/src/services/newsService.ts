import prisma from '../config/database.js';
import { sanitizeRichText } from '../utils/html.js';

export interface NewsMediaInput {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  order?: number;
}

export interface UpsertNewsInput {
  title: string;
  content: string;
  isPinned?: boolean;
  media: NewsMediaInput[];
}

function toMediaArray(value: unknown): NewsMediaInput[] {
  if (!Array.isArray(value)) return [];

  const parsed: NewsMediaInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      typeof row.fileName !== 'string' ||
      typeof row.fileUrl !== 'string' ||
      typeof row.fileSize !== 'number' ||
      typeof row.mimeType !== 'string'
    ) {
      continue;
    }

    parsed.push({
      id: row.id,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      order: typeof row.order === 'number' ? row.order : undefined,
    });
  }

  return parsed;
}

function normalizeMedia(media: NewsMediaInput[]) {
  return media.map((item, index) => {
    const mime = item.mimeType.toLowerCase();
    const isAllowed =
      mime.startsWith('image/') ||
      mime.startsWith('video/') ||
      mime === 'application/pdf' ||
      mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isAllowed) {
      throw new Error('Допустимы изображения, видео, PDF и документы Word');
    }

    const fileName = item.fileName.trim();
    const fileUrl = item.fileUrl.trim();

    if (!fileName || !fileUrl) {
      throw new Error('Некорректные данные медиафайла');
    }

    return {
      fileName,
      fileUrl,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      order: item.order ?? index,
    };
  });
}

function mapNewsItem(item: {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  media: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    order: number;
  }[];
}) {
  return {
    id: item.id,
    title: item.title,
    content: sanitizeRichText(item.content),
    isPinned: item.isPinned,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    author: item.author,
    media: item.media
      .sort((a, b) => a.order - b.order)
      .map((mediaItem) => ({
        id: mediaItem.id,
        fileName: mediaItem.fileName,
        fileUrl: mediaItem.fileUrl,
        fileSize: mediaItem.fileSize,
        mimeType: mediaItem.mimeType,
        order: mediaItem.order,
      })),
  };
}

export async function listNews() {
  const news = await prisma.news.findMany({
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      media: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
  });

  return news.map(mapNewsItem);
}

export async function getNewsById(id: string) {
  const item = await prisma.news.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      media: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!item) {
    return null;
  }

  return mapNewsItem(item);
}

export async function createNews(authorId: string, payload: UpsertNewsInput) {
  const title = payload.title.trim();
  const content = sanitizeRichText(payload.content);

  if (!title) {
    throw new Error('Заголовок новости обязателен');
  }

  if (!content) {
    throw new Error('Текст новости обязателен');
  }

  const media = normalizeMedia(toMediaArray(payload.media));

  const created = await prisma.news.create({
    data: {
      title,
      content,
      isPinned: Boolean(payload.isPinned),
      authorId,
      media: {
        create: media,
      },
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      media: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return mapNewsItem(created);
}

export async function updateNews(id: string, payload: UpsertNewsInput) {
  const existing = await prisma.news.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const title = payload.title.trim();
  const content = sanitizeRichText(payload.content);

  if (!title) {
    throw new Error('Заголовок новости обязателен');
  }

  if (!content) {
    throw new Error('Текст новости обязателен');
  }

  const media = normalizeMedia(toMediaArray(payload.media));

  const updated = await prisma.news.update({
    where: { id },
    data: {
      title,
      content,
      isPinned: Boolean(payload.isPinned),
      media: {
        deleteMany: {},
        create: media,
      },
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      media: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return mapNewsItem(updated);
}

export async function deleteNews(id: string) {
  const existing = await prisma.news.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return false;
  }

  await prisma.news.delete({ where: { id } });
  return true;
}
