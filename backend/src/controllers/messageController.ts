import { Request, Response } from 'express';
import { body, param } from 'express-validator';
import * as messageService from '../services/messageService.js';
import * as socketService from '../services/socketService.js';
import { sendSuccess, sendError, sendPaginated, getPaginationParams } from '../utils/response.js';
import { AuthRequest } from '../types/index.js';

// Валидаторы
export const sendMessageValidation = [
  body('subject').notEmpty().withMessage('Тема обязательна'),
  body('content').notEmpty().withMessage('Содержание обязательно'),
  body('recipientIds').isArray({ min: 1 }).withMessage('Укажите хотя бы одного получателя'),
];

// Контроллеры

// Получить входящие
export async function getInbox(req: AuthRequest, res: Response) {
  try {
    const { page, limit } = getPaginationParams(req.query as any);
    const unreadOnly = req.query.unreadOnly === 'true';
    const folderId = req.query.folderId as string | undefined;

    // Если folderId = "inbox" или не передан, то это null в сервисе
    // Если folderId передан, передаем как есть
    // Но подождите, системная папка Inbox не имеет ID в базе в начале (или имеет?)
    // В folderService.getFolders мы возвращаем ID для системных папок тоже.
    // Так что folderId будет UUID.
    // Однако, для начальной загрузки "Inbox" может быть запрошен без ID.
    // Если folderId не передан, getInbox в сервисе использует null (Inbox).
    
    let targetFolderId: string | null | undefined = folderId;
    if (folderId === 'null' || folderId === 'inbox') targetFolderId = null;

    const { messages, total, unreadCount } = await messageService.getInbox(
      req.user!.id,
      page,
      limit,
      unreadOnly,
      targetFolderId
    );

    return res.json({
      success: true,
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error('Get inbox error:', error);
    return sendError(res, 'Ошибка получения входящих', 500);
  }
}

// Получить помеченные сообщения
export async function getStarred(req: AuthRequest, res: Response) {
  try {
    const { page, limit } = getPaginationParams(req.query as any);
    
    const { messages, total } = await messageService.getStarred(req.user!.id, page, limit);

    return sendPaginated(res, messages, page, limit, total);
  } catch (error) {
    console.error('Get starred error:', error);
    return sendError(res, 'Ошибка получения избранных сообщений', 500);
  }
}

// Получить корзину
export async function getTrash(req: AuthRequest, res: Response) {
  try {
    const { page, limit } = getPaginationParams(req.query as any);
    const { messages, total } = await messageService.getTrash(req.user!.id, page, limit);

    return sendPaginated(res, messages, page, limit, total);
  } catch (error) {
    console.error('Get trash error:', error);
    return sendError(res, 'Ошибка получения корзины', 500);
  }
}

// Поиск сообщений
export async function searchMessages(req: AuthRequest, res: Response) {
  try {
    const { page, limit } = getPaginationParams(req.query as any);
    const query = req.query.q as string;

    if (!query) {
      return sendError(res, 'Строка поиска обязательна', 400);
    }

    const { messages, total } = await messageService.searchMessages(req.user!.id, query, page, limit);

    return sendPaginated(res, messages, page, limit, total);
  } catch (error) {
    console.error('Search messages error:', error);
    return sendError(res, 'Ошибка поиска', 500);
  }
}

// Переместить в папку
export async function moveToFolder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { folderId, applyToThread } = req.body; // folderId может быть null (для Inbox)

    const success = await messageService.moveToFolder(req.user!.id, id, folderId, Boolean(applyToThread));

    if (!success) {
      return sendError(res, 'Сообщение не найдено', 404);
    }

    return sendSuccess(res, null, 'Сообщение перемещено');
  } catch (error) {
    console.error('Move to folder error:', error);
    return sendError(res, 'Ошибка перемещения', 500);
  }
}

// Переключить звездочку
export async function toggleStar(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const isStarred = await messageService.toggleStar(req.user!.id, id);

    return sendSuccess(res, { isStarred }, isStarred ? 'Добавлено в избранное' : 'Убрано из избранного');
  } catch (error) {
    console.error('Toggle star error:', error);
    return sendError(res, 'Ошибка обновления', 500);
  }
}

// Удалить сообщение (в корзину)
export async function deleteMessage(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === 'true';

    let success;
    if (permanent) {
      success = await messageService.deleteMessageForUser(id, req.user!.id);
    } else {
      success = await messageService.moveToTrash(req.user!.id, id);
    }

    if (!success) {
      return sendError(res, 'Сообщение не найдено', 404);
    }

    return sendSuccess(res, null, permanent ? 'Сообщение удалено навсегда' : 'Сообщение перемещено в корзину');
  } catch (error) {
    console.error('Delete message error:', error);
    return sendError(res, 'Ошибка удаления', 500);
  }
}

// Восстановить сообщение
export async function restoreMessage(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const success = await messageService.restoreFromTrash(req.user!.id, id);

    if (!success) {
      return sendError(res, 'Сообщение не найдено в корзине', 404);
    }

    return sendSuccess(res, null, 'Сообщение восстановлено');
  } catch (error) {
    console.error('Restore message error:', error);
    return sendError(res, 'Ошибка восстановления сообщения', 500);
  }
}


// Получить отправленные
export async function getSent(req: AuthRequest, res: Response) {
  try {
    const { page, limit } = getPaginationParams(req.query as any);

    const { messages, total } = await messageService.getSent(req.user!.id, page, limit);

    return sendPaginated(res, messages, page, limit, total);
  } catch (error) {
    return sendError(res, 'Ошибка получения отправленных', 500);
  }
}

// Получить сообщение по ID
export async function getMessage(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const message = await messageService.getMessageById(id, req.user!.id);

    if (!message) {
      return sendError(res, 'Сообщение не найдено', 404);
    }

    return sendSuccess(res, message);
  } catch (error) {
    return sendError(res, 'Ошибка получения сообщения', 500);
  }
}

// Отправить сообщение
export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { subject, content, recipientIds, ccIds, bccIds, isImportant, replyToId, forwardedFromId, attachments } = req.body;
    const normalizedRecipientIds = Array.from(
      new Set(
        [
          ...(Array.isArray(recipientIds) ? recipientIds : []),
          ...(Array.isArray(ccIds) ? ccIds : []),
          ...(Array.isArray(bccIds) ? bccIds : []),
        ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      )
    );

    const message = await messageService.sendMessage(req.user!.id, {
      subject,
      content,
      recipientIds: normalizedRecipientIds,
      isImportant,
      replyToId,
      forwardedFromId,
      attachments,
    });

    // Отправить real-time уведомление через Socket.io
    await socketService.notifyNewMessage(message);

    return sendSuccess(res, message, 'Сообщение отправлено', 201);
  } catch (error) {
    console.error('Send message error:', error);
    return sendError(res, 'Ошибка отправки сообщения', 500);
  }
}


// Отметить как прочитанное
export async function markAsRead(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    await messageService.markAsRead(id, req.user!.id);
    await socketService.notifyUnreadCount(req.user!.id);

    return sendSuccess(res, null, 'Сообщение отмечено как прочитанное');
  } catch (error) {
    return sendError(res, 'Ошибка обновления', 500);
  }
}

// Отметить все как прочитанные
export async function markAllAsRead(req: AuthRequest, res: Response) {
  try {
    const count = await messageService.markAllAsRead(req.user!.id);
    await socketService.notifyUnreadCount(req.user!.id);

    return sendSuccess(res, { count }, `Отмечено ${count} сообщений`);
  } catch (error) {
    return sendError(res, 'Ошибка обновления', 500);
  }
}


// Получить количество непрочитанных
export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const count = await messageService.getUnreadCount(req.user!.id);

    return sendSuccess(res, { count });
  } catch (error) {
    return sendError(res, 'Ошибка получения', 500);
  }
}
