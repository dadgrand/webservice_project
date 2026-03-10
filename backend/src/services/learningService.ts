import prisma from '../config/database.js';

export type LearningMaterialType = 'single_page' | 'multi_page';

export interface LearningFileDto {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface LearningPageInput {
  title: string;
  content?: string;
  order?: number;
  files?: LearningFileDto[];
}

export interface CreateLearningMaterialInput {
  title: string;
  description?: string;
  materialType: LearningMaterialType;
  assignToAll?: boolean;
  assignedUserIds?: string[];
  assignedDepartmentIds?: string[];
  expiresAt?: string | null;
  isPublished?: boolean;
  pages: LearningPageInput[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toFiles(value: unknown): LearningFileDto[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (
        typeof row.id !== 'string' ||
        typeof row.fileName !== 'string' ||
        typeof row.fileUrl !== 'string' ||
        typeof row.fileSize !== 'number' ||
        typeof row.mimeType !== 'string'
      ) {
        return null;
      }

      return {
        id: row.id,
        fileName: row.fileName,
        fileUrl: row.fileUrl,
        fileSize: row.fileSize,
        mimeType: row.mimeType,
      } satisfies LearningFileDto;
    })
    .filter((item): item is LearningFileDto => item !== null);
}

function hasAssignment(
  material: {
    authorId: string;
    assignToAll: boolean;
    assignedUserIds: unknown;
    assignedDepartmentIds: unknown;
  },
  userId: string,
  departmentId: string | null
): boolean {
  if (material.authorId === userId) return true;
  if (material.assignToAll) return true;

  const userIds = toStringArray(material.assignedUserIds);
  if (userIds.includes(userId)) return true;

  if (!departmentId) return false;
  const departmentIds = toStringArray(material.assignedDepartmentIds);
  return departmentIds.includes(departmentId);
}

function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() < Date.now();
}

export async function getAudienceOptions() {
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
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
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
      },
    }),
  ]);

  return { users, departments };
}

export async function createMaterial(authorId: string, payload: CreateLearningMaterialInput) {
  const title = payload.title.trim();
  if (!title) {
    throw new Error('Название материала обязательно');
  }

  if (!payload.pages || payload.pages.length === 0) {
    throw new Error('Добавьте хотя бы одну страницу');
  }

  if (payload.materialType !== 'single_page' && payload.materialType !== 'multi_page') {
    throw new Error('Некорректный тип материала');
  }

  const assignedUserIds = Array.from(new Set(payload.assignedUserIds || [])).filter(Boolean);
  const assignedDepartmentIds = Array.from(new Set(payload.assignedDepartmentIds || [])).filter(Boolean);

  const expiresAt =
    payload.expiresAt && payload.expiresAt.trim().length > 0
      ? new Date(payload.expiresAt)
      : null;

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error('Некорректная дата срока действия');
  }

  const rawPages =
    payload.materialType === 'single_page'
      ? [payload.pages[0]]
      : payload.pages;

  const pages = rawPages.map((page, index) => {
    const pageTitle = (page.title || '').trim();
    if (!pageTitle) {
      throw new Error(`У страницы ${index + 1} отсутствует заголовок`);
    }

    const files = toFiles(page.files || []);
    return {
      title: pageTitle,
      content: page.content?.trim() || '',
      order: page.order ?? index,
      files,
    };
  });

  const created = await prisma.course.create({
    data: {
      title,
      description: payload.description?.trim() || null,
      authorId,
      materialType: payload.materialType,
      assignToAll: Boolean(payload.assignToAll),
      assignedUserIds: payload.assignToAll ? [] : assignedUserIds,
      assignedDepartmentIds: payload.assignToAll ? [] : assignedDepartmentIds,
      expiresAt,
      isPublished: payload.isPublished ?? true,
      modules: {
        create: {
          title: 'Основной материал',
          description: null,
          order: 0,
          lessons: {
            create: pages.map((page) => ({
              title: page.title,
              content: page.content,
              order: page.order,
              attachments: {
                create: page.files.map((file) => ({
                  title: file.fileName,
                  fileName: file.fileName,
                  fileUrl: file.fileUrl,
                  fileSize: file.fileSize,
                  mimeType: file.mimeType,
                })),
              },
            })),
          },
        },
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
      modules: {
        include: {
          lessons: {
            include: {
              attachments: true,
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  return {
    id: created.id,
    title: created.title,
    description: created.description,
    materialType: created.materialType as LearningMaterialType,
    assignToAll: created.assignToAll,
    assignedUserIds: toStringArray(created.assignedUserIds),
    assignedDepartmentIds: toStringArray(created.assignedDepartmentIds),
    expiresAt: created.expiresAt,
    isPublished: created.isPublished,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    author: created.author,
    pages: created.modules
      .flatMap((module) => module.lessons)
      .sort((a, b) => a.order - b.order)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        order: lesson.order,
        files: lesson.attachments.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        })),
      })),
  };
}

export async function listMaterialsForUser(userId: string, isAdmin: boolean, canEditMaterials: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const [materials, visits] = await Promise.all([
    prisma.course.findMany({
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        modules: {
          select: {
            lessons: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    }),
    prisma.activityLog.groupBy({
      by: ['entityId'],
      where: {
        userId,
        action: 'learning.visit',
        entity: 'course',
        entityId: { not: null },
      },
      _max: { createdAt: true },
    }),
  ]);

  const visitsMap = new Map<string, Date>();
  for (const visit of visits) {
    if (visit.entityId && visit._max.createdAt) {
      visitsMap.set(visit.entityId, visit._max.createdAt);
    }
  }

  return materials
    .map((material) => {
      const materialExpired = isExpired(material.expiresAt);
      const assigned = hasAssignment(material, userId, user.departmentId);
      const canEdit = isAdmin || canEditMaterials || material.authorId === userId;
      const canOpen = canEdit || (material.isPublished && assigned && !materialExpired);
      const visible = canEdit || (material.isPublished && assigned);

      if (!visible) {
        return null;
      }

      const pageCount = material.modules.reduce((acc, module) => acc + module.lessons.length, 0);

      return {
        id: material.id,
        title: material.title,
        description: material.description,
        materialType: material.materialType as LearningMaterialType,
        isPublished: material.isPublished,
        assignToAll: material.assignToAll,
        assignedUserIds: toStringArray(material.assignedUserIds),
        assignedDepartmentIds: toStringArray(material.assignedDepartmentIds),
        expiresAt: material.expiresAt,
        isExpired: materialExpired,
        canEdit,
        canOpen,
        pageCount,
        lastVisitedAt: visitsMap.get(material.id) || null,
        author: material.author,
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function getLearningSummary(userId: string, isAdmin: boolean, canEditMaterials: boolean) {
  const materials = await listMaterialsForUser(userId, isAdmin, canEditMaterials);

  const assignedCount = materials.filter((item) => item.canOpen && !item.canEdit).length;
  const viewedCount = materials.filter((item) => item.lastVisitedAt !== null).length;
  const expiredCount = materials.filter((item) => item.isExpired).length;
  const totalAvailable = materials.filter((item) => item.canOpen).length;

  return {
    assignedCount,
    viewedCount,
    expiredCount,
    totalAvailable,
  };
}

export async function getMaterialById(materialId: string, userId: string, isAdmin: boolean, canEditMaterials: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const material = await prisma.course.findUnique({
    where: { id: materialId },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      modules: {
        include: {
          lessons: {
            include: {
              attachments: true,
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!material) return null;

  const materialExpired = isExpired(material.expiresAt);
  const assigned = hasAssignment(material, userId, user.departmentId);
  const canEdit = isAdmin || canEditMaterials || material.authorId === userId;
  const canOpen = canEdit || (material.isPublished && assigned && !materialExpired);
  const visible = canEdit || (material.isPublished && assigned);

  if (!visible) {
    return null;
  }

  const pages = material.modules
    .flatMap((module) => module.lessons)
    .sort((a, b) => a.order - b.order)
    .map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      content: lesson.content,
      order: lesson.order,
      files: lesson.attachments.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      })),
    }));

  return {
    id: material.id,
    title: material.title,
    description: material.description,
    materialType: material.materialType as LearningMaterialType,
    assignToAll: material.assignToAll,
    assignedUserIds: toStringArray(material.assignedUserIds),
    assignedDepartmentIds: toStringArray(material.assignedDepartmentIds),
    expiresAt: material.expiresAt,
    isExpired: materialExpired,
    isPublished: material.isPublished,
    canEdit,
    canOpen,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    author: material.author,
    pages,
  };
}

export async function recordVisit(
  materialId: string,
  userId: string,
  isAdmin: boolean,
  canEditMaterials: boolean,
  pageId?: string
) {
  const material = await getMaterialById(materialId, userId, isAdmin, canEditMaterials);
  if (!material || !material.canOpen) {
    return false;
  }

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'learning.visit',
      entity: 'course',
      entityId: materialId,
      details: pageId ? { pageId } : undefined,
    },
  });

  await prisma.courseProgress.upsert({
    where: {
      userId_courseId: {
        userId,
        courseId: materialId,
      },
    },
    create: {
      userId,
      courseId: materialId,
      completedLessons: [],
      progressPercent: 0,
    },
    update: {},
  });

  return true;
}

export async function getAccessibleFile(
  storedFileName: string,
  userId: string,
  isAdmin: boolean,
  canEditMaterials: boolean
) {
  const [user, attachment] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    }),
    prisma.lessonAttachment.findFirst({
      where: { fileUrl: storedFileName },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: {
                  select: {
                    authorId: true,
                    assignToAll: true,
                    assignedUserIds: true,
                    assignedDepartmentIds: true,
                    expiresAt: true,
                    isPublished: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!user || !attachment) {
    return null;
  }

  const material = attachment.lesson.module.course;
  const canEdit = isAdmin || canEditMaterials || material.authorId === userId;
  const canOpen =
    canEdit ||
    (material.isPublished &&
      hasAssignment(material, userId, user.departmentId) &&
      !isExpired(material.expiresAt));

  if (!canOpen) {
    return null;
  }

  return {
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    mimeType: attachment.mimeType,
  };
}
