
import { Request, Response } from 'express';
import * as folderService from '../services/folderService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';

// Получить все папки
export async function getFolders(req: AuthRequest, res: Response) {
  try {
    const folders = await folderService.getFolders(req.user!.id);
    return sendSuccess(res, folders);
  } catch (error) {
    console.error('Get folders error:', error);
    return sendError(res, 'Ошибка получения папок', 500);
  }
}

// Создать папку
export async function createFolder(req: AuthRequest, res: Response) {
  try {
    const { name, color, icon } = req.body;
    
    if (!name) {
      return sendError(res, 'Название папки обязательно', 400);
    }

    const folder = await folderService.createFolder(req.user!.id, { name, color, icon });
    return sendSuccess(res, folder, 'Папка создана', 201);
  } catch (error: any) {
    console.error('Create folder error:', error);
    return sendError(res, error.message || 'Ошибка создания папки', 400);
  }
}

// Обновить папку
export async function updateFolder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    const folder = await folderService.updateFolder(id, req.user!.id, { name, color, icon });
    
    if (!folder) {
      return sendError(res, 'Папка не найдена', 404);
    }

    return sendSuccess(res, folder, 'Папка обновлена');
  } catch (error: any) {
    console.error('Update folder error:', error);
    return sendError(res, error.message || 'Ошибка обновления папки', 400);
  }
}

// Удалить папку
export async function deleteFolder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const success = await folderService.deleteFolder(id, req.user!.id);
    
    if (!success) {
      return sendError(res, 'Папка не найдена или это системная папка', 404);
    }

    return sendSuccess(res, null, 'Папка удалена');
  } catch (error: any) {
    console.error('Delete folder error:', error);
    return sendError(res, error.message || 'Ошибка удаления папки', 400);
  }
}

// Изменить порядок папок
export async function reorderFolders(req: AuthRequest, res: Response) {
  try {
    const { folderIds } = req.body;
    
    if (!Array.isArray(folderIds)) {
      return sendError(res, 'folderIds должен быть массивом', 400);
    }

    await folderService.reorderFolders(req.user!.id, folderIds);
    return sendSuccess(res, null, 'Порядок папок обновлен');
  } catch (error) {
    console.error('Reorder folders error:', error);
    return sendError(res, 'Ошибка обновления порядка папок', 500);
  }
}
