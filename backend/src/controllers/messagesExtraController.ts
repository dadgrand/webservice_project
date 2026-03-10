
import { Request, Response } from 'express';
import * as draftService from '../services/draftService.js';
import * as threadService from '../services/threadService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';

// === DRAFTS ===

export async function getDrafts(req: AuthRequest, res: Response) {
  try {
    const drafts = await draftService.getDrafts(req.user!.id);
    return sendSuccess(res, drafts);
  } catch (error) {
    return sendError(res, 'Ошибка получения черновиков', 500);
  }
}

export async function createDraft(req: AuthRequest, res: Response) {
  try {
    const draft = await draftService.createDraft(req.user!.id, req.body);
    return sendSuccess(res, draft, 'Черновик создан', 201);
  } catch (error) {
    return sendError(res, 'Ошибка создания черновика', 500);
  }
}

export async function updateDraft(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const draft = await draftService.updateDraft(id, req.user!.id, req.body);
    
    if (!draft) {
      return sendError(res, 'Черновик не найден', 404);
    }

    return sendSuccess(res, draft, 'Черновик сохранен');
  } catch (error) {
    return sendError(res, 'Ошибка сохранения черновика', 500);
  }
}

export async function deleteDraft(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const success = await draftService.deleteDraft(id, req.user!.id);
    
    if (!success) {
      return sendError(res, 'Черновик не найден', 404);
    }

    return sendSuccess(res, null, 'Черновик удален');
  } catch (error) {
    return sendError(res, 'Ошибка удаления черновика', 500);
  }
}

// === THREADS ===

export async function getThread(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const thread = await threadService.getThread(id, req.user!.id);
    
    if (!thread) {
      return sendError(res, 'Цепочка сообщений не найдена или доступ запрещен', 404);
    }

    return sendSuccess(res, thread);
  } catch (error) {
    return sendError(res, 'Ошибка получения цепочки сообщений', 500);
  }
}
