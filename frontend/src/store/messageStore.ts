import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '../services/api';
import { messageService } from '../services';
import type { InboxMessage, Message, MessageDraft, MessageFolder, MessageLabel } from '../types';
import { buildMessagePreview } from '../utils/messagePreview';

type FolderType = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash' | 'custom' | 'label';

interface DraftPayload {
  subject?: string;
  content?: string;
  recipientIds?: string[];
  ccIds?: string[];
  bccIds?: string[];
  isImportant?: boolean;
  replyToId?: string;
  forwardFromId?: string;
  attachments?: MessageDraft['attachments'];
}

interface MessageOrganizationOptions {
  applyToThread?: boolean;
}

interface MessageState {
  folders: MessageFolder[];
  labels: MessageLabel[];
  messages: InboxMessage[];
  drafts: MessageDraft[];
  currentFolderId: string | null;
  currentFolderType: FolderType;
  currentLabelId: string | null;
  selectedMessageId: string | null;
  unreadCount: number;
  isLoading: boolean;
  isSidebarOpen: boolean;
  composeOpen: boolean;
  searchQuery: string;
  replyToMessage: Message | null;
  forwardMessage: Message | null;
  presetRecipientIds: string[];
  editingDraft: MessageDraft | null;

  initSocket: () => void;
  disconnectSocket: () => void;
  fetchFolders: () => Promise<void>;
  fetchLabels: () => Promise<void>;
  fetchMessages: (folderId?: string | null, page?: number) => Promise<void>;
  setFolder: (folderId: string | null, folderType?: Exclude<FolderType, 'label'>) => void;
  setLabel: (labelId: string) => void;
  selectMessage: (messageId: string | null) => void;
  toggleSidebar: () => void;
  setComposeOpen: (open: boolean) => void;
  resetComposeContext: () => void;
  setSearchQuery: (query: string) => void;
  startReply: (message: Message) => void;
  startReplyAll: (message: Message) => void;
  startForward: (message: Message) => void;
  startCompose: (recipientIds?: string[]) => void;
  editDraft: (draftId: string) => void;
  handleNewMessage: () => Promise<void>;
  handleUnreadUpdate: (count: number) => Promise<void>;
  toggleStar: (messageId: string) => Promise<void>;
  moveToTrash: (messageId: string) => Promise<void>;
  restoreFromTrash: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string, permanent?: boolean) => Promise<void>;
  moveMessageToFolder: (messageId: string, folderId: string | null, options?: MessageOrganizationOptions) => Promise<void>;
  addLabelToMessage: (messageId: string, labelId: string, options?: MessageOrganizationOptions) => Promise<void>;
  removeLabelFromMessage: (messageId: string, labelId: string, options?: MessageOrganizationOptions) => Promise<void>;
  createFolder: (name: string, color?: string) => Promise<MessageFolder>;
  createLabel: (name: string, color?: string) => Promise<MessageLabel>;
  saveDraft: (data: DraftPayload) => Promise<void>;
}

let socket: Socket | null = null;

function mapDraftToInboxMessage(draft: MessageDraft): InboxMessage {
  return {
    id: draft.id,
    subject: draft.subject || '(Без темы)',
    isImportant: draft.isImportant,
    createdAt: draft.updatedAt,
    isRead: true,
    readAt: null,
    threadId: null,
    threadMessageCount: 1,
    sender: {
      id: '',
      firstName: 'Черновик',
      lastName: '',
      email: '',
      avatarUrl: null,
    },
    preview: buildMessagePreview(draft.content || ''),
    isStarred: false,
    canOrganize: false,
  };
}

async function reloadCurrentList(get: () => MessageState): Promise<void> {
  await get().fetchMessages();
  await get().fetchFolders();
}

function syncSelectedMessage(set: (partial: Partial<MessageState>) => void, get: () => MessageState): void {
  const { selectedMessageId, messages, currentFolderType } = get();
  if (currentFolderType === 'drafts') {
    return;
  }

  if (selectedMessageId && !messages.some((message) => message.id === selectedMessageId)) {
    set({ selectedMessageId: null });
  }
}

export const useMessageStore = create<MessageState>((set, get) => ({
  folders: [],
  labels: [],
  messages: [],
  drafts: [],
  currentFolderId: null,
  currentFolderType: 'inbox',
  currentLabelId: null,
  selectedMessageId: null,
  unreadCount: 0,
  isLoading: false,
  isSidebarOpen: true,
  composeOpen: false,
  searchQuery: '',
  replyToMessage: null,
  forwardMessage: null,
  presetRecipientIds: [],
  editingDraft: null,

  initSocket: () => {
    if (socket) return;

    socket = io(SOCKET_URL, {
      withCredentials: true,
    });
    socket.on('connect', () => {
      void get().fetchFolders();
    });
    socket.on('message:new', () => {
      void get().handleNewMessage();
    });
    socket.on('unread:update', ({ count }: { count: number }) => {
      void get().handleUnreadUpdate(count);
    });
  },

  disconnectSocket: () => {
    socket?.disconnect();
    socket = null;
  },

  fetchFolders: async () => {
    const folders = await messageService.getFolders();
    set({ folders });
  },

  fetchLabels: async () => {
    const labels = await messageService.getLabels();
    set({ labels });
  },

  fetchMessages: async (folderId = undefined, page = 1) => {
    set({ isLoading: true });
    try {
      const { currentFolderType, currentFolderId, currentLabelId } = get();
      const targetFolderId = folderId === undefined ? currentFolderId : folderId;

      if (currentFolderType === 'drafts') {
        const drafts = await messageService.getDrafts();
        set({
          drafts,
          messages: drafts.map(mapDraftToInboxMessage),
          isLoading: false,
        });
        syncSelectedMessage(set, get);
        return;
      }

      if (currentFolderType === 'label' && currentLabelId) {
        const response = await messageService.getMessagesByLabel(currentLabelId, page, 20);
        set({ messages: response.data || [], isLoading: false });
        syncSelectedMessage(set, get);
        return;
      }

      if (currentFolderType === 'sent') {
        const response = await messageService.getSent(page, 20);
        set({ messages: response.data || [], isLoading: false });
        syncSelectedMessage(set, get);
        return;
      }

      if (currentFolderType === 'starred') {
        const response = await messageService.getStarred(page, 20);
        set({ messages: response.data || [], isLoading: false });
        syncSelectedMessage(set, get);
        return;
      }

      if (currentFolderType === 'trash') {
        const response = await messageService.getTrash(page, 20);
        set({ messages: response.data || [], isLoading: false });
        syncSelectedMessage(set, get);
        return;
      }

      const response = await messageService.getInbox(page, 20, false, targetFolderId ?? null);
      set({
        messages: response.data || [],
        unreadCount: response.unreadCount || 0,
        isLoading: false,
      });
      syncSelectedMessage(set, get);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set({ isLoading: false });
    }
  },

  setFolder: (folderId, folderType = 'inbox') => {
    set({
      currentFolderId: folderId,
      currentFolderType: folderType,
      currentLabelId: null,
      selectedMessageId: null,
    });
    void get().fetchMessages(folderId);
  },

  setLabel: (labelId) => {
    set({
      currentFolderId: null,
      currentFolderType: 'label',
      currentLabelId: labelId,
      selectedMessageId: null,
    });
    void get().fetchMessages(undefined);
  },

  selectMessage: (messageId) => set({ selectedMessageId: messageId }),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setComposeOpen: (open) => set({ composeOpen: open }),

  resetComposeContext: () =>
    set({
      replyToMessage: null,
      forwardMessage: null,
      presetRecipientIds: [],
      editingDraft: null,
      composeOpen: false,
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  startReply: (message) => {
    set({
      replyToMessage: message,
      forwardMessage: null,
      presetRecipientIds: [message.sender.id],
      editingDraft: null,
      composeOpen: true,
    });
  },

  startReplyAll: (message) => {
    const recipientIds = Array.from(
      new Set([message.sender.id, ...message.recipients.map((recipient) => recipient.id)].filter(Boolean))
    );

    set({
      replyToMessage: message,
      forwardMessage: null,
      presetRecipientIds: recipientIds,
      editingDraft: null,
      composeOpen: true,
    });
  },

  startForward: (message) => {
    set({
      forwardMessage: message,
      replyToMessage: null,
      presetRecipientIds: [],
      editingDraft: null,
      composeOpen: true,
    });
  },

  startCompose: (recipientIds = []) => {
    set({
      replyToMessage: null,
      forwardMessage: null,
      presetRecipientIds: recipientIds,
      editingDraft: null,
      composeOpen: true,
    });
  },

  editDraft: (draftId) => {
    const draft = get().drafts.find((item) => item.id === draftId) || null;
    if (!draft) return;

    set({
      editingDraft: draft,
      replyToMessage: null,
      forwardMessage: null,
      presetRecipientIds: [],
      composeOpen: true,
    });
  },

  handleNewMessage: async () => {
    await reloadCurrentList(get);
  },

  handleUnreadUpdate: async (count) => {
    set({ unreadCount: count });
    await get().fetchFolders();
  },

  toggleStar: async (messageId) => {
    await messageService.toggleStar(messageId);
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === messageId ? { ...message, isStarred: !message.isStarred } : message
      ),
    }));
    await get().fetchFolders();
  },

  moveToTrash: async (messageId) => {
    await messageService.delete(messageId, false);
    await reloadCurrentList(get);
    if (get().selectedMessageId === messageId) {
      set({ selectedMessageId: null });
    }
  },

  restoreFromTrash: async (messageId) => {
    await messageService.restoreFromTrash(messageId);
    await reloadCurrentList(get);
    if (get().selectedMessageId === messageId) {
      set({ selectedMessageId: null });
    }
  },

  deleteMessage: async (messageId, permanent = false) => {
    await messageService.delete(messageId, permanent);
    await reloadCurrentList(get);
    if (get().selectedMessageId === messageId) {
      set({ selectedMessageId: null });
    }
  },

  moveMessageToFolder: async (messageId, folderId, options = {}) => {
    await messageService.moveToFolder(messageId, folderId, options.applyToThread ?? false);
    await reloadCurrentList(get);
    syncSelectedMessage(set, get);
  },

  addLabelToMessage: async (messageId, labelId, options = {}) => {
    await messageService.addLabel(messageId, labelId, options.applyToThread ?? false);
    await Promise.all([reloadCurrentList(get), get().fetchLabels()]);
  },

  removeLabelFromMessage: async (messageId, labelId, options = {}) => {
    await messageService.removeLabel(messageId, labelId, options.applyToThread ?? false);
    await Promise.all([reloadCurrentList(get), get().fetchLabels()]);
  },

  createFolder: async (name, color) => {
    const folder = await messageService.createFolder(name, color);
    await get().fetchFolders();
    return folder;
  },

  createLabel: async (name, color) => {
    const label = await messageService.createLabel(name, color);
    await get().fetchLabels();
    return label;
  },

  saveDraft: async (data) => {
    const { editingDraft } = get();

    if (editingDraft) {
      await messageService.updateDraft(editingDraft.id, data);
    } else {
      await messageService.createDraft(data);
    }
  },
}));
