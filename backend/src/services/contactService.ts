import prisma from '../config/database.js';

export interface DepartmentDto {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  headId: string | null;
  order: number;
  color: string | null;
  children?: DepartmentDto[];
  head?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    avatarUrl: string | null;
  } | null;
  employeeCount?: number;
}

export interface ContactDto {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  position: string | null;
  phone: string | null;
  phoneInternal: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  isActive: boolean;
}

// Получить избранные контакты
export async function getFavorites(userId: string): Promise<ContactDto[]> {
  const favorites = await prisma.favoriteContact.findMany({
    where: { userId },
    include: {
      contact: {
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return favorites.map((f) => ({
    id: f.contact.id,
    firstName: f.contact.firstName,
    lastName: f.contact.lastName,
    middleName: f.contact.middleName,
    position: f.contact.position,
    phone: f.contact.phone,
    phoneInternal: f.contact.phoneInternal,
    email: f.contact.email,
    avatarUrl: f.contact.avatarUrl,
    bio: f.contact.bio,
    department: f.contact.department,
    isActive: f.contact.isActive,
  }));
}

// Добавить в избранное
export async function addToFavorites(userId: string, contactId: string): Promise<boolean> {
  // Нельзя добавить самого себя
  if (userId === contactId) return false;

  // Проверяем существование контакта
  const contact = await prisma.user.findUnique({ where: { id: contactId } });
  if (!contact) return false;

  try {
    await prisma.favoriteContact.create({
      data: { userId, contactId },
    });
    return true;
  } catch (error) {
    // Скорее всего уже существует
    return true;
  }
}

// Убрать из избранного
export async function removeFromFavorites(userId: string, contactId: string): Promise<boolean> {
  const result = await prisma.favoriteContact.deleteMany({
    where: { userId, contactId },
  });
  return result.count > 0;
}

// Обновить свой профиль
export async function updateProfile(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    position?: string | null;
    phone?: string | null;
    phoneInternal?: string | null;
    email?: string;
    bio?: string | null;
    avatarUrl?: string | null;
  }
): Promise<ContactDto | null> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existing) return null;

  const normalizeOptionalString = (
    value: string | null | undefined
  ): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeRequiredString = (value: string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    return value.trim();
  };

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: normalizeRequiredString(data.firstName),
      lastName: normalizeRequiredString(data.lastName),
      middleName: normalizeOptionalString(data.middleName),
      position: normalizeOptionalString(data.position),
      phone: normalizeOptionalString(data.phone),
      phoneInternal: normalizeOptionalString(data.phoneInternal),
      email: data.email?.trim().toLowerCase(),
      bio: normalizeOptionalString(data.bio),
      avatarUrl: normalizeOptionalString(data.avatarUrl),
    },
    include: {
      department: {
        select: { id: true, name: true },
      },
    },
  });

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    position: user.position,
    phone: user.phone,
    phoneInternal: user.phoneInternal,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    department: user.department,
    isActive: user.isActive,
  };
}

// Получить всех сотрудников с поиском
export async function searchContacts(
  search?: string,
  departmentId?: string,
  page = 1,
  limit = 20
): Promise<{ contacts: ContactDto[]; total: number }> {
  const skip = (page - 1) * limit;

  const where: any = {
    isActive: true,
  };

  if (search) {
    const searchLower = search.toLowerCase();
    where.OR = [
      { firstName: { contains: searchLower, mode: 'insensitive' } },
      { lastName: { contains: searchLower, mode: 'insensitive' } },
      { middleName: { contains: searchLower, mode: 'insensitive' } },
      { position: { contains: searchLower, mode: 'insensitive' } },
      { phone: { contains: search } },
      { phoneInternal: { contains: search } },
      { email: { contains: searchLower, mode: 'insensitive' } },
    ];
  }

  if (departmentId) {
    where.departmentId = departmentId;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const contacts: ContactDto[] = users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    middleName: u.middleName,
    position: u.position,
    phone: u.phone,
    phoneInternal: u.phoneInternal,
    email: u.email,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    department: u.department,
    isActive: u.isActive,
  }));

  return { contacts, total };
}

// Получить контакт по ID
export async function getContactById(id: string): Promise<ContactDto | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      department: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    position: user.position,
    phone: user.phone,
    phoneInternal: user.phoneInternal,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    department: user.department,
    isActive: user.isActive,
  };
}

// Получить все отделения (плоский список)
export async function getAllDepartments(): Promise<DepartmentDto[]> {
  const departments = await prisma.department.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: {
      head: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          avatarUrl: true,
        },
      },
      _count: {
        select: { employees: true },
      },
    },
  });

  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    parentId: d.parentId,
    headId: d.headId,
    order: d.order,
    color: d.color,
    head: d.head,
    employeeCount: d._count.employees,
  }));
}

// Получить дерево отделений
export async function getDepartmentTree(): Promise<DepartmentDto[]> {
  const departments = await getAllDepartments();

  // Строим дерево
  const map = new Map<string, DepartmentDto & { children: DepartmentDto[] }>();
  const roots: DepartmentDto[] = [];

  // Сначала создаем map всех элементов
  departments.forEach((d) => {
    map.set(d.id, { ...d, children: [] });
  });

  // Затем строим иерархию
  departments.forEach((d) => {
    const node = map.get(d.id)!;
    if (d.parentId && map.has(d.parentId)) {
      map.get(d.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// Создать отделение
export async function createDepartment(data: {
  name: string;
  description?: string;
  parentId?: string;
  headId?: string;
  order?: number;
  color?: string;
}): Promise<DepartmentDto> {
  const dept = await prisma.department.create({
    data: {
      name: data.name,
      description: data.description,
      parentId: data.parentId,
      headId: data.headId,
      order: data.order || 0,
      color: data.color,
    },
    include: {
      head: {
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
    id: dept.id,
    name: dept.name,
    description: dept.description,
    parentId: dept.parentId,
    headId: dept.headId,
    order: dept.order,
    color: dept.color,
    head: dept.head,
  };
}

// Обновить отделение
export async function updateDepartment(
  id: string,
  data: {
    name?: string;
    description?: string;
    parentId?: string | null;
    headId?: string | null;
    order?: number;
    color?: string;
  }
): Promise<DepartmentDto | null> {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return null;

  const dept = await prisma.department.update({
    where: { id },
    data,
    include: {
      head: {
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
    id: dept.id,
    name: dept.name,
    description: dept.description,
    parentId: dept.parentId,
    headId: dept.headId,
    order: dept.order,
    color: dept.color,
    head: dept.head,
  };
}

// Удалить отделение
export async function deleteDepartment(id: string): Promise<boolean> {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) return false;

  // Сначала открепляем сотрудников
  await prisma.user.updateMany({
    where: { departmentId: id },
    data: { departmentId: null },
  });

  // Перемещаем дочерние отделения к родителю
  await prisma.department.updateMany({
    where: { parentId: id },
    data: { parentId: existing.parentId },
  });

  await prisma.department.delete({ where: { id } });
  return true;
}
