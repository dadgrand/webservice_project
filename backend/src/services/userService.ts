import prisma from '../config/database.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { normalizeRussianPhone } from '../utils/phone.js';
import {
  UserPayload,
  UserDto,
  CreateUserRequest,
  UpdateUserRequest,
} from '../types/index.js';

// Преобразование User в UserDto (без пароля)
export async function toUserDto(userId: string): Promise<UserDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      permissions: {
        include: { permission: true },
      },
      department: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    position: user.position,
    departmentId: user.departmentId,
    department: user.department?.name || null,
    phone: user.phone,
    phoneInternal: user.phoneInternal,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    permissions: user.permissions.map((up) => up.permission.code),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// Авторизация пользователя
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: UserDto; token: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      permissions: {
        include: { permission: true },
      },
      department: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return null;
  }

  // Обновляем время последнего входа
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const permissions = user.permissions.map((up) => up.permission.code);

  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
    permissions,
  };

  const token = generateToken(payload);

  const userDto: UserDto = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    position: user.position,
    departmentId: user.departmentId,
    department: user.department?.name || null,
    phone: user.phone,
    phoneInternal: user.phoneInternal,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    permissions,
    createdAt: user.createdAt,
    lastLoginAt: new Date(),
  };

  return { user: userDto, token };
}

// Создание пользователя (только админ)
export async function createUser(
  data: CreateUserRequest,
  createdByAdminId: string
): Promise<UserDto> {
  const hashedPassword = await hashPassword(data.password);
  const normalizedDepartmentId =
    typeof data.departmentId === 'string' && data.departmentId.trim().length === 0
      ? null
      : data.departmentId ?? null;

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      position: data.position,
      departmentId: normalizedDepartmentId,
      phone: normalizeRussianPhone(data.phone),
      isAdmin: data.isAdmin || false,
    },
  });

  // Если указаны разрешения, добавляем их
  if (data.permissions && data.permissions.length > 0) {
    const permissionsToAdd = await prisma.permission.findMany({
      where: { code: { in: data.permissions } },
    });

    await prisma.userPermission.createMany({
      data: permissionsToAdd.map((p) => ({
        userId: user.id,
        permissionId: p.id,
        grantedBy: createdByAdminId,
      })),
    });
  }

  return (await toUserDto(user.id))!;
}

// Получение всех пользователей
export async function getAllUsers(
  page: number,
  limit: number,
  search?: string
): Promise<{ users: UserDto[]; total: number }> {
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { position: { contains: search, mode: 'insensitive' as const } },
          { department: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        permissions: {
          include: { permission: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const userDtos: UserDto[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    position: user.position,
    departmentId: user.departmentId,
    department: user.department?.name || null,
    phone: user.phone,
    phoneInternal: user.phoneInternal,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
    permissions: user.permissions.map((up) => up.permission.code),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }));

  return { users: userDtos, total };
}

// Получение пользователя по ID
export async function getUserById(id: string): Promise<UserDto | null> {
  return toUserDto(id);
}

// Обновление пользователя
export async function updateUser(
  id: string,
  data: UpdateUserRequest,
  adminId: string
): Promise<UserDto | null> {
  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) return null;
  const normalizedDepartmentId =
    data.departmentId === undefined
      ? undefined
      : typeof data.departmentId === 'string' && data.departmentId.trim().length === 0
        ? null
        : data.departmentId;

  // Обновляем основные данные
  await prisma.user.update({
    where: { id },
    data: {
      email: data.email?.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName,
      position: data.position,
      departmentId: normalizedDepartmentId,
      phone: normalizeRussianPhone(data.phone),
      isActive: data.isActive,
      isAdmin: data.isAdmin,
    },
  });

  // Если указаны разрешения, обновляем их
  if (data.permissions !== undefined) {
    // Удаляем старые разрешения
    await prisma.userPermission.deleteMany({ where: { userId: id } });

    // Добавляем новые
    if (data.permissions.length > 0) {
      const permissionsToAdd = await prisma.permission.findMany({
        where: { code: { in: data.permissions } },
      });

      await prisma.userPermission.createMany({
        data: permissionsToAdd.map((p) => ({
          userId: id,
          permissionId: p.id,
          grantedBy: adminId,
        })),
      });
    }
  }

  return toUserDto(id);
}

// Смена пароля
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) return false;

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return true;
}

// Сброс пароля (админом)
export async function resetPassword(
  userId: string,
  newPassword: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return true;
}

// Удаление пользователя
export async function deleteUser(id: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return false;

  await prisma.user.delete({ where: { id } });
  return true;
}

// Проверка существования email
export async function emailExists(email: string, excludeUserId?: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      id: excludeUserId ? { not: excludeUserId } : undefined,
    },
  });
  return !!user;
}
