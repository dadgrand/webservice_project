
import { Request, Response } from 'express';
import * as orgTreeService from '../services/orgTreeService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';

// Получить дерево
export async function getTree(req: Request, res: Response) {
  try {
    const tree = await orgTreeService.getTree();
    return sendSuccess(res, tree);
  } catch (error) {
    console.error('Get tree error:', error);
    return sendError(res, 'Ошибка получения дерева', 500);
  }
}

// Создать узел (Admin)
export async function createNode(req: AuthRequest, res: Response) {
  try {
    const node = await orgTreeService.createNode(req.body);
    return sendSuccess(res, node, 'Узел создан', 201);
  } catch (error) {
    console.error('Create node error:', error);
    if (error instanceof orgTreeService.OrgTreeServiceError) {
      return sendError(res, error.message, error.statusCode);
    }
    return sendError(res, 'Ошибка создания узла', 500);
  }
}

// Обновить узел (Admin)
export async function updateNode(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const node = await orgTreeService.updateNode(id, req.body);
    
    if (!node) {
      return sendError(res, 'Узел не найден', 404);
    }

    return sendSuccess(res, node);
  } catch (error) {
    console.error('Update node error:', error);
    if (error instanceof orgTreeService.OrgTreeServiceError) {
      return sendError(res, error.message, error.statusCode);
    }
    return sendError(res, 'Ошибка обновления узла', 500);
  }
}

// Удалить узел (Admin)
export async function deleteNode(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const success = await orgTreeService.deleteNode(id);
    
    if (!success) {
      return sendError(res, 'Узел не найден', 404);
    }

    return sendSuccess(res, null, 'Узел удален');
  } catch (error) {
    console.error('Delete node error:', error);
    return sendError(res, 'Ошибка удаления узла', 500);
  }
}
