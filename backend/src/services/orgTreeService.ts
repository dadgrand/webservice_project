
import prisma from '../config/database.js';

export interface OrgTreeNodeDto {
  id: string;
  parentId: string | null;
  type: string; // 'department', 'position', 'custom'
  departmentId: string | null;
  linkedUserId: string | null;
  customTitle: string | null;
  customSubtitle: string | null;
  customImageUrl: string | null;
  linkUrl: string | null;
  order: number;
  style: any; // x, y positions, colors, etc.
  isVisible: boolean;
  // Expanded data
  department?: { id: string; name: string };
  linkedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    avatarUrl: string | null;
  };
}

// Получить все узлы дерева
export async function getTree(): Promise<OrgTreeNodeDto[]> {
  const nodes = await prisma.orgTreeNode.findMany({
    orderBy: { order: 'asc' },
    include: {
      department: {
        select: { id: true, name: true },
      },
      linkedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          avatarUrl: true,
        },
      },
    },
  });

  return nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    departmentId: node.departmentId,
    linkedUserId: node.linkedUserId,
    customTitle: node.customTitle,
    customSubtitle: node.customSubtitle,
    customImageUrl: node.customImageUrl,
    linkUrl: node.linkUrl,
    order: node.order,
    style: node.style,
    isVisible: node.isVisible,
    department: node.department || undefined,
    linkedUser: node.linkedUser || undefined,
  }));
}

// Создать узел
export async function createNode(data: {
  parentId?: string;
  type: string;
  departmentId?: string;
  linkedUserId?: string;
  customTitle?: string;
  customSubtitle?: string;
  style?: any;
}): Promise<OrgTreeNodeDto> {
  const node = await prisma.orgTreeNode.create({
    data: {
      parentId: data.parentId,
      type: data.type,
      departmentId: data.departmentId,
      linkedUserId: data.linkedUserId,
      customTitle: data.customTitle,
      customSubtitle: data.customSubtitle,
      style: data.style || {},
    },
    include: {
      department: { select: { id: true, name: true } },
      linkedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          avatarUrl: true,
        },
      },
    },
  });

  return {
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    departmentId: node.departmentId,
    linkedUserId: node.linkedUserId,
    customTitle: node.customTitle,
    customSubtitle: node.customSubtitle,
    customImageUrl: node.customImageUrl,
    linkUrl: node.linkUrl,
    order: node.order,
    style: node.style,
    isVisible: node.isVisible,
    department: node.department || undefined,
    linkedUser: node.linkedUser || undefined,
  };
}

// Обновить узел (перемещение, стили, данные)
export async function updateNode(
  id: string,
  data: {
    parentId?: string | null;
    style?: any; // Для сохранения позиции x, y
    linkedUserId?: string | null;
    departmentId?: string | null;
    customTitle?: string;
    customSubtitle?: string;
    customImageUrl?: string;
    isVisible?: boolean;
  }
): Promise<OrgTreeNodeDto | null> {
  const existing = await prisma.orgTreeNode.findUnique({ where: { id } });
  if (!existing) return null;

  const node = await prisma.orgTreeNode.update({
    where: { id },
    data: {
      parentId: data.parentId, // Может быть null для корневых узлов
      style: data.style ? { ...((existing.style as object) || {}), ...data.style } : undefined,
      linkedUserId: data.linkedUserId,
      departmentId: data.departmentId,
      customTitle: data.customTitle,
      customSubtitle: data.customSubtitle,
      customImageUrl: data.customImageUrl,
      isVisible: data.isVisible,
    },
    include: {
      department: { select: { id: true, name: true } },
      linkedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          avatarUrl: true,
        },
      },
    },
  });

  return {
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    departmentId: node.departmentId,
    linkedUserId: node.linkedUserId,
    customTitle: node.customTitle,
    customSubtitle: node.customSubtitle,
    customImageUrl: node.customImageUrl,
    linkUrl: node.linkUrl,
    order: node.order,
    style: node.style,
    isVisible: node.isVisible,
    department: node.department || undefined,
    linkedUser: node.linkedUser || undefined,
  };
}

// Удалить узел
export async function deleteNode(id: string): Promise<boolean> {
  const existing = await prisma.orgTreeNode.findUnique({ where: { id } });
  if (!existing) return false;

  // При удалении узла, дочерние узлы становятся "сиротами" (parentId = null)
  // или можно удалять каскадно. В данном случае лучше обнулить parentId
  await prisma.orgTreeNode.updateMany({
    where: { parentId: id },
    data: { parentId: null },
  });

  await prisma.orgTreeNode.delete({ where: { id } });
  return true;
}
