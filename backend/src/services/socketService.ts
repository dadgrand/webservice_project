
import { Server } from 'socket.io';
import { MessageDto } from './messageService.js';
import { getUnreadCount } from './messageService.js';

let io: Server | null = null;

export const initSocket = (socketIo: Server) => {
  io = socketIo;
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Уведомить получателей о новом сообщении
export const notifyNewMessage = async (message: MessageDto) => {
  if (!io) return;

  // Отправляем каждому получателю
  for (const recipient of message.recipients) {
    // Отправляем само сообщение
    io.to(`user:${recipient.id}`).emit('message:new', message);
    
    // Обновляем счетчик непрочитанных
    const count = await getUnreadCount(recipient.id);
    io.to(`user:${recipient.id}`).emit('unread:update', { count });
  }
};

// Уведомить об обновлении счетчика непрочитанных
export const notifyUnreadCount = async (userId: string) => {
  if (!io) return;
  const count = await getUnreadCount(userId);
  io.to(`user:${userId}`).emit('unread:update', { count });
};
