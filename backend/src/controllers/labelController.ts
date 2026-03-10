
import { Request, Response } from 'express';
import * as labelService from '../services/labelService.js';
import { sendSuccess, sendError, sendPaginated, getPaginationParams } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';

// Получить все метки
export async function getLabels(req: AuthRequest, res: Response) {
  try {
    const labels = await labelService.getLabels(req.user!.id);
    return sendSuccess(res, labels);
  } catch (error) {
    return sendError(res, 'Ошибка получения меток', 500);
  }
}

// Создать метку
export async function createLabel(req: AuthRequest, res: Response) {
  try {
    const { name, color } = req.body;
    
    if (!name) {
      return sendError(res, 'Название метки обязательно', 400);
    }

    const label = await labelService.createLabel(req.user!.id, name, color);
    return sendSuccess(res, label, 'Метка создана', 201);
  } catch (error: any) {
    return sendError(res, error.message || 'Ошибка создания метки', 400);
  }
}

// Обновить метку
export async function updateLabel(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const label = await labelService.updateLabel(id, req.user!.id, { name, color });
    
    if (!label) {
      return sendError(res, 'Метка не найдена', 404);
    }

    return sendSuccess(res, label, 'Метка обновлена');
  } catch (error: any) {
    return sendError(res, error.message || 'Ошибка обновления метки', 400);
  }
}

// Удалить метку
export async function deleteLabel(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const success = await labelService.deleteLabel(id, req.user!.id);
    
    if (!success) {
      return sendError(res, 'Метка не найдена', 404);
    }

    return sendSuccess(res, null, 'Метка удалена');
  } catch (error) {
    return sendError(res, 'Ошибка удаления метки', 500);
  }
}

// Присвоить метку сообщению
export async function addLabelToMessage(req: AuthRequest, res: Response) {
  try {
    const { id: messageId } = req.params;
    const { labelId, applyToThread } = req.body;

    const success = await labelService.addLabelToMessage(req.user!.id, messageId, labelId, Boolean(applyToThread));

    if (!success) {
      return sendError(res, 'Не удалось добавить метку (сообщение или метка не найдены)', 400);
    }

    return sendSuccess(res, null, 'Метка добавлена');
  } catch (error) {
    return sendError(res, 'Ошибка добавления метки', 500);
  }
}

// Удалить метку с сообщения
export async function removeLabelFromMessage(req: AuthRequest, res: Response) {
  try {
    const { id: messageId, labelId } = req.params;
    const applyToThread = Boolean(req.body?.applyToThread);

    const success = await labelService.removeLabelFromMessage(req.user!.id, messageId, labelId, applyToThread);

    if (!success) {
      return sendError(res, 'Не удалось удалить метку', 400);
    }

    return sendSuccess(res, null, 'Метка удалена');
  } catch (error) {
    return sendError(res, 'Ошибка удаления метки', 500);
  }
}

// Получить сообщения по метке
export async function getMessagesByLabel(req: AuthRequest, res: Response) {
  try {
    const { id: labelId } = req.params;
    const { page, limit } = getPaginationParams(req.query as any);

    const { messages, total } = await labelService.getMessagesByLabel(req.user!.id, labelId, page, limit);

    return sendPaginated(res, messages, page, limit, total);
  } catch (error) {
    return sendError(res, 'Ошибка получения сообщений', 500);
  }
}
