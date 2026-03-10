import { Request } from 'express';
import { User } from '@prisma/client';

// Расширение Express Request с данными пользователя
export interface AuthRequest extends Request {
  user?: UserPayload;
}

// Payload JWT токена
export interface UserPayload {
  id: string;
  email: string;
  isAdmin: boolean;
  permissions: string[];
}

// Типы разрешений
export const PermissionCodes = {
  // Тесты
  TESTS_EDIT: 'tests.edit',
  TESTS_STATS: 'tests.stats',
  
  // Обучение
  LEARNING_EDIT: 'learning.edit',
  LEARNING_STATS: 'learning.stats',
  
  // Документы
  DOCUMENTS_EDIT: 'documents.edit',
  
  // Сообщения
  MESSAGES_BROADCAST: 'messages.broadcast',

  // Новости
  NEWS_MANAGE: 'news.manage',
  
  // Пользователи (только для админов, но можно выдать отдельно)
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
} as const;

export type PermissionCode = typeof PermissionCodes[keyof typeof PermissionCodes];

// API Response типы
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User DTO (без пароля)
export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  position: string | null;
  departmentId: string | null;
  department: string | null;
  phone: string | null;
  phoneInternal: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  isAdmin: boolean;
  permissions: string[];
  createdAt: Date;
  lastLoginAt: Date | null;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserDto;
  token: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// User management types
export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  position?: string;
  departmentId?: string | null;
  phone?: string;
  isAdmin?: boolean;
  permissions?: string[];
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  position?: string;
  departmentId?: string | null;
  phone?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  permissions?: string[];
}
