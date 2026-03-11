import api from './api';
import type { 
  User, 
  LoginRequest, 
  LoginResponse, 
  ApiResponse,
  CreateUserRequest,
  UpdateUserRequest,
  PaginatedResponse,
  Permission,
  Contact,
  Department,
  Message,
  InboxMessage,
  MessageAttachment,
  MessageDraft,
  MessageFolder,
  MessageLabel,
  MessageThread,
  DocumentThreadSummary,
  DocumentThreadDetail,
  DocumentAudienceOptions,
  DocumentUploadedFile,
  DocumentSupportedFormat,
  DocumentGroup,
  DocumentDecision,
  LearningSummary,
  LearningAudienceOptions,
  LearningMaterialListItem,
  LearningMaterialDetail,
  LearningFile,
  CreateLearningMaterialRequest,
  TestSummary,
  TestAudienceOptions,
  TestListItem,
  TestDetail,
  TestMediaFile,
  TestAttempt,
  CreateTestRequest,
  SubmitTestAttemptRequest,
  OrgTreeNode,
  NewsItem,
  NewsMediaFile,
  UpsertNewsRequest,
} from '../types';

// Auth
export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
    return response.data.data!;
  },

  async me(): Promise<User> {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data.data!;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};

// Users
export const userService = {
  async getAll(page = 1, limit = 20, search?: string): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    const response = await api.get<PaginatedResponse<User>>(`/users?${params}`);
    return response.data;
  },

  async getById(id: string): Promise<User> {
    const response = await api.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data!;
  },

  async create(data: CreateUserRequest): Promise<{ user: User; generatedPassword?: string }> {
    const response = await api.post<ApiResponse<{ user: User; generatedPassword?: string }>>('/users', data);
    return response.data.data!;
  },

  async update(id: string, data: UpdateUserRequest): Promise<User> {
    const response = await api.put<ApiResponse<User>>(`/users/${id}`, data);
    return response.data.data!;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  async resetPassword(id: string, password?: string): Promise<{ generatedPassword?: string }> {
    const response = await api.post<ApiResponse<{ generatedPassword?: string }>>(
      `/users/${id}/reset-password`,
      password ? { password } : {}
    );
    return response.data.data!;
  },

  async getPermissions(): Promise<Permission[]> {
    const response = await api.get<ApiResponse<Permission[]>>('/users/permissions');
    return response.data.data!;
  },
};

// Contacts
export const contactService = {
  async search(page = 1, limit = 20, search?: string, departmentId?: string): Promise<PaginatedResponse<Contact>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.append('search', search);
    if (departmentId) params.append('departmentId', departmentId);
    const response = await api.get<PaginatedResponse<Contact>>(`/contacts?${params}`);
    return response.data;
  },

  async getFavorites(): Promise<Contact[]> {
    const response = await api.get<ApiResponse<Contact[]>>('/contacts/favorites');
    return response.data.data!;
  },

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    await api.post(`/contacts/${id}/favorite`, { isFavorite });
  },

  async getById(id: string): Promise<Contact> {
    const response = await api.get<ApiResponse<Contact>>(`/contacts/${id}`);
    return response.data.data!;
  },
  
  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    position?: string | null;
    phone?: string | null;
    phoneInternal?: string | null;
    email?: string;
    bio?: string | null;
  }): Promise<User> {
    const response = await api.put<ApiResponse<User>>('/contacts/me', data);
    return response.data.data!;
  },

  async uploadAvatar(file: File): Promise<{ user: User; avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post<ApiResponse<{ user: User; avatarUrl: string }>>('/contacts/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data!;
  },

  async getDepartments(): Promise<Department[]> {
    const response = await api.get<ApiResponse<Department[]>>('/contacts/departments');
    return response.data.data!;
  },

  async getDepartmentTree(): Promise<Department[]> {
    const response = await api.get<ApiResponse<Department[]>>('/contacts/departments/tree');
    return response.data.data!;
  },

  async createDepartment(data: Partial<Department>): Promise<Department> {
    const response = await api.post<ApiResponse<Department>>('/contacts/departments', data);
    return response.data.data!;
  },

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    const response = await api.put<ApiResponse<Department>>(`/contacts/departments/${id}`, data);
    return response.data.data!;
  },

  async deleteDepartment(id: string): Promise<void> {
    await api.delete(`/contacts/departments/${id}`);
  },
};


// Messages
export const messageService = {
  // === Messages ===
  async getInbox(page = 1, limit = 20, unreadOnly = false, folderId?: string | null): Promise<PaginatedResponse<InboxMessage> & { unreadCount: number }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (unreadOnly) params.append('unreadOnly', 'true');
    if (folderId !== undefined) params.append('folderId', folderId === null ? 'inbox' : folderId);
    
    const response = await api.get<PaginatedResponse<InboxMessage> & { unreadCount: number }>(`/messages/inbox?${params}`);
    return response.data;
  },

  async getSent(page = 1, limit = 20): Promise<PaginatedResponse<InboxMessage>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const response = await api.get<PaginatedResponse<InboxMessage>>(`/messages/sent?${params}`);
    return response.data;
  },

  async getStarred(page = 1, limit = 20): Promise<PaginatedResponse<InboxMessage>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const response = await api.get<PaginatedResponse<InboxMessage>>(`/messages/starred?${params}`);
    return response.data;
  },

  async getTrash(page = 1, limit = 20): Promise<PaginatedResponse<InboxMessage>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const response = await api.get<PaginatedResponse<InboxMessage>>(`/messages/trash?${params}`);
    return response.data;
  },

  async restoreFromTrash(id: string): Promise<void> {
    await api.post(`/messages/${id}/restore`);
  },

  async search(query: string, page = 1, limit = 20): Promise<PaginatedResponse<InboxMessage>> {
    const params = new URLSearchParams({ q: query, page: String(page), limit: String(limit) });
    const response = await api.get<PaginatedResponse<InboxMessage>>(`/messages/search?${params}`);
    return response.data;
  },

  async getById(id: string): Promise<Message> {
    const response = await api.get<ApiResponse<Message>>(`/messages/${id}`);
    return response.data.data!;
  },

  async send(data: { 
    subject: string; 
    content: string; 
    recipientIds: string[];
    ccIds?: string[];
    bccIds?: string[];
    isImportant?: boolean;
    replyToId?: string;
    forwardedFromId?: string;
    attachments?: { fileName: string; fileUrl: string; fileSize: number; mimeType: string }[];
  }): Promise<Message> {
    const response = await api.post<ApiResponse<Message>>('/messages', data);
    return response.data.data!;
  },

  async markAsRead(id: string): Promise<void> {
    await api.post(`/messages/${id}/read`);
  },

  async markAllAsRead(): Promise<{ count: number }> {
    const response = await api.post<ApiResponse<{ count: number }>>('/messages/mark-all-read');
    return response.data.data!;
  },

  async toggleStar(id: string): Promise<{ isStarred: boolean }> {
    const response = await api.post<ApiResponse<{ isStarred: boolean }>>(`/messages/${id}/star`);
    return response.data.data!;
  },

  async delete(id: string, permanent = false): Promise<void> {
    const params = permanent ? '?permanent=true' : '';
    await api.delete(`/messages/${id}${params}`);
  },

  async moveToFolder(id: string, folderId: string | null, applyToThread = false): Promise<void> {
    await api.post(`/messages/${id}/move`, { folderId, applyToThread });
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<ApiResponse<{ count: number }>>('/messages/unread-count');
    return response.data.data!.count;
  },

  // === Folders ===
  async getFolders(): Promise<MessageFolder[]> {
    const response = await api.get<ApiResponse<MessageFolder[]>>('/messages/folders');
    return response.data.data!;
  },

  async createFolder(name: string, color?: string, icon?: string): Promise<MessageFolder> {
    const response = await api.post<ApiResponse<MessageFolder>>('/messages/folders', { name, color, icon });
    return response.data.data!;
  },

  async updateFolder(id: string, data: { name?: string; color?: string; icon?: string }): Promise<MessageFolder> {
    const response = await api.put<ApiResponse<MessageFolder>>(`/messages/folders/${id}`, data);
    return response.data.data!;
  },

  async deleteFolder(id: string): Promise<void> {
    await api.delete(`/messages/folders/${id}`);
  },

  // === Labels ===
  async getLabels(): Promise<MessageLabel[]> {
    const response = await api.get<ApiResponse<MessageLabel[]>>('/messages/labels');
    return response.data.data!;
  },

  async createLabel(name: string, color?: string): Promise<MessageLabel> {
    const response = await api.post<ApiResponse<MessageLabel>>('/messages/labels', { name, color });
    return response.data.data!;
  },

  async updateLabel(id: string, data: { name?: string; color?: string }): Promise<MessageLabel> {
    const response = await api.put<ApiResponse<MessageLabel>>(`/messages/labels/${id}`, data);
    return response.data.data!;
  },

  async deleteLabel(id: string): Promise<void> {
    await api.delete(`/messages/labels/${id}`);
  },

  async addLabel(messageId: string, labelId: string, applyToThread = false): Promise<void> {
    await api.post(`/messages/${messageId}/labels`, { labelId, applyToThread });
  },

  async removeLabel(messageId: string, labelId: string, applyToThread = false): Promise<void> {
    await api.delete(`/messages/${messageId}/labels/${labelId}`, {
      data: { applyToThread },
    });
  },

  async getMessagesByLabel(labelId: string, page = 1, limit = 20): Promise<PaginatedResponse<InboxMessage>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const response = await api.get<PaginatedResponse<InboxMessage>>(`/messages/labels/${labelId}/messages?${params}`);
    return response.data;
  },

  async getThread(threadId: string): Promise<MessageThread> {
    const response = await api.get<ApiResponse<MessageThread>>(`/messages/thread/${threadId}`);
    return response.data.data!;
  },

  // === Drafts ===
  async getDrafts(): Promise<MessageDraft[]> {
    const response = await api.get<ApiResponse<MessageDraft[]>>('/messages/drafts');
    return response.data.data!;
  },

  async createDraft(data: {
    subject?: string;
    content?: string;
    recipientIds?: string[];
    ccIds?: string[];
    bccIds?: string[];
    isImportant?: boolean;
    replyToId?: string;
    forwardFromId?: string;
    attachments?: MessageAttachment[];
  }): Promise<MessageDraft> {
    const response = await api.post<ApiResponse<MessageDraft>>('/messages/drafts', data);
    return response.data.data!;
  },

  async updateDraft(id: string, data: {
    subject?: string;
    content?: string;
    recipientIds?: string[];
    ccIds?: string[];
    bccIds?: string[];
    isImportant?: boolean;
    attachments?: MessageAttachment[];
  }): Promise<MessageDraft> {
    const response = await api.put<ApiResponse<MessageDraft>>(`/messages/drafts/${id}`, data);
    return response.data.data!;
  },

  async deleteDraft(id: string): Promise<void> {
    await api.delete(`/messages/drafts/${id}`);
  },

  // === Attachments ===
  async uploadAttachment(file: File): Promise<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiResponse<MessageAttachment>>('/messages/attachments', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data!;
  },
};

// Documents
export const documentService = {
  async getThreads(params?: { mode?: string; status?: string; q?: string }): Promise<DocumentThreadSummary[]> {
    const query = new URLSearchParams();
    if (params?.mode) query.append('mode', params.mode);
    if (params?.status) query.append('status', params.status);
    if (params?.q) query.append('q', params.q);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<ApiResponse<DocumentThreadSummary[]>>(`/documents/threads${suffix}`);
    return response.data.data || [];
  },

  async getThreadById(id: string): Promise<DocumentThreadDetail> {
    const response = await api.get<ApiResponse<DocumentThreadDetail>>(`/documents/threads/${id}`);
    return response.data.data!;
  },

  async createThread(data: {
    title: string;
    description?: string;
    mode: 'distribution' | 'read_receipt' | 'approval';
    distributionType: 'all' | 'departments' | 'groups' | 'individual';
    requiresReadReceipt?: boolean;
    recipientIds?: string[];
    departmentIds?: string[];
    groupIds?: string[];
    files?: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }>;
  }): Promise<DocumentThreadDetail> {
    const response = await api.post<ApiResponse<DocumentThreadDetail>>('/documents/threads', data);
    return response.data.data!;
  },

  async markAsRead(threadId: string): Promise<DocumentThreadDetail> {
    const response = await api.post<ApiResponse<DocumentThreadDetail>>(`/documents/threads/${threadId}/read`);
    return response.data.data!;
  },

  async submitDecision(threadId: string, decision: DocumentDecision, comment?: string): Promise<DocumentThreadDetail> {
    const response = await api.post<ApiResponse<DocumentThreadDetail>>(`/documents/threads/${threadId}/decision`, {
      decision,
      comment,
    });
    return response.data.data!;
  },

  async resubmit(threadId: string, comment?: string): Promise<DocumentThreadDetail> {
    const response = await api.post<ApiResponse<DocumentThreadDetail>>(`/documents/threads/${threadId}/resubmit`, {
      comment,
    });
    return response.data.data!;
  },

  async addFiles(
    threadId: string,
    files: Array<{ fileName: string; fileUrl: string; fileSize: number; mimeType: string }>
  ): Promise<DocumentThreadDetail> {
    const response = await api.post<ApiResponse<DocumentThreadDetail>>(`/documents/threads/${threadId}/files`, {
      files,
    });
    return response.data.data!;
  },

  async deleteFile(threadId: string, fileId: string): Promise<DocumentThreadDetail> {
    const response = await api.delete<ApiResponse<DocumentThreadDetail>>(`/documents/threads/${threadId}/files/${fileId}`);
    return response.data.data!;
  },

  async uploadFile(file: File): Promise<DocumentUploadedFile> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<DocumentUploadedFile>>('/documents/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data!;
  },

  async fetchPreviewBlob(threadId: string, fileId: string): Promise<Blob> {
    const response = await api.get(`/documents/threads/${threadId}/files/${fileId}/view`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async fetchDownloadBlob(threadId: string, fileId: string): Promise<Blob> {
    const response = await api.get(`/documents/threads/${threadId}/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async getSupportedFormats(): Promise<DocumentSupportedFormat[]> {
    const response = await api.get<ApiResponse<DocumentSupportedFormat[]>>('/documents/supported-formats');
    return response.data.data || [];
  },

  async getAudienceOptions(): Promise<DocumentAudienceOptions> {
    const response = await api.get<ApiResponse<DocumentAudienceOptions>>('/documents/audience');
    return response.data.data!;
  },

  async getGroups(): Promise<DocumentGroup[]> {
    const response = await api.get<ApiResponse<DocumentGroup[]>>('/documents/groups');
    return response.data.data || [];
  },

  async createGroup(data: { name: string; description?: string; memberIds: string[] }): Promise<DocumentGroup> {
    const response = await api.post<ApiResponse<DocumentGroup>>('/documents/groups', data);
    return response.data.data!;
  },
};

// Learning
export const learningService = {
  async getSummary(): Promise<LearningSummary> {
    const response = await api.get<ApiResponse<LearningSummary>>('/learning/summary');
    return response.data.data!;
  },

  async getAudienceOptions(): Promise<LearningAudienceOptions> {
    const response = await api.get<ApiResponse<LearningAudienceOptions>>('/learning/audience');
    return response.data.data!;
  },

  async listMaterials(params?: { archived?: boolean }): Promise<LearningMaterialListItem[]> {
    const query = new URLSearchParams();
    if (params?.archived) {
      query.append('archived', 'true');
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<ApiResponse<LearningMaterialListItem[]>>(`/learning${suffix}`);
    return response.data.data || [];
  },

  async getMaterialById(id: string): Promise<LearningMaterialDetail> {
    const response = await api.get<ApiResponse<LearningMaterialDetail>>(`/learning/${id}`);
    return response.data.data!;
  },

  async createMaterial(data: CreateLearningMaterialRequest): Promise<LearningMaterialDetail> {
    const response = await api.post<ApiResponse<LearningMaterialDetail>>('/learning', data);
    return response.data.data!;
  },

  async archiveMaterial(id: string): Promise<void> {
    await api.post(`/learning/${id}/archive`);
  },

  async restoreMaterial(id: string): Promise<void> {
    await api.post(`/learning/${id}/restore`);
  },

  async deleteMaterial(id: string): Promise<void> {
    await api.delete(`/learning/${id}`);
  },

  async markVisited(id: string, pageId?: string): Promise<void> {
    await api.post(`/learning/${id}/visit`, pageId ? { pageId } : {});
  },

  async uploadFile(file: File): Promise<LearningFile> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<LearningFile>>('/learning/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data!;
  },

  async fetchFilePreview(fileName: string): Promise<Blob> {
    const response = await api.get(`/learning/files/${encodeURIComponent(fileName)}/view`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async fetchFileDownload(fileName: string): Promise<Blob> {
    const response = await api.get(`/learning/files/${encodeURIComponent(fileName)}/download`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};

// Tests
export const testService = {
  async getSummary(): Promise<TestSummary> {
    const response = await api.get<ApiResponse<TestSummary>>('/tests/summary');
    return response.data.data!;
  },

  async getAudienceOptions(): Promise<TestAudienceOptions> {
    const response = await api.get<ApiResponse<TestAudienceOptions>>('/tests/audience');
    return response.data.data!;
  },

  async listTests(params?: { archived?: boolean }): Promise<TestListItem[]> {
    const query = new URLSearchParams();
    if (params?.archived) {
      query.append('archived', 'true');
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<ApiResponse<TestListItem[]>>(`/tests${suffix}`);
    return response.data.data || [];
  },

  async getTestById(id: string): Promise<TestDetail> {
    const response = await api.get<ApiResponse<TestDetail>>(`/tests/${id}`);
    return response.data.data!;
  },

  async createTest(data: CreateTestRequest): Promise<TestDetail> {
    const response = await api.post<ApiResponse<TestDetail>>('/tests', data);
    return response.data.data!;
  },

  async archiveTest(id: string): Promise<void> {
    await api.post(`/tests/${id}/archive`);
  },

  async restoreTest(id: string): Promise<void> {
    await api.post(`/tests/${id}/restore`);
  },

  async deleteTest(id: string): Promise<void> {
    await api.delete(`/tests/${id}`);
  },

  async uploadFile(file: File): Promise<TestMediaFile> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<TestMediaFile>>('/tests/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data!;
  },

  async fetchMediaPreview(fileName: string): Promise<Blob> {
    const response = await api.get(`/tests/files/${encodeURIComponent(fileName)}/view`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async fetchMediaDownload(fileName: string): Promise<Blob> {
    const response = await api.get(`/tests/files/${encodeURIComponent(fileName)}/download`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async submitAttempt(testId: string, payload: SubmitTestAttemptRequest): Promise<{
    attempt: TestAttempt;
    showResults: boolean;
    showCorrectAnswers: boolean;
  }> {
    const response = await api.post<ApiResponse<{
      attempt: TestAttempt;
      showResults: boolean;
      showCorrectAnswers: boolean;
    }>>(`/tests/${testId}/submit`, payload);
    return response.data.data!;
  },

  async getAttempt(attemptId: string): Promise<TestAttempt & {
    canEdit: boolean;
    canShowResults: boolean;
    canShowCorrectAnswers: boolean;
  }> {
    const response = await api.get<ApiResponse<TestAttempt & {
      canEdit: boolean;
      canShowResults: boolean;
      canShowCorrectAnswers: boolean;
    }>>(`/tests/attempts/${attemptId}`);
    return response.data.data!;
  },

  async reviewAttempt(
    attemptId: string,
    payload: { reviews: Array<{ questionId: string; isCorrect: boolean; awardedPoints?: number; comment?: string }>; feedback?: string }
  ): Promise<TestAttempt> {
    const response = await api.post<ApiResponse<TestAttempt>>(`/tests/attempts/${attemptId}/review`, payload);
    return response.data.data!;
  },
};

// News
export const newsService = {
  async list(): Promise<NewsItem[]> {
    const response = await api.get<ApiResponse<NewsItem[]>>('/news');
    return response.data.data || [];
  },

  async getById(id: string): Promise<NewsItem> {
    const response = await api.get<ApiResponse<NewsItem>>(`/news/${id}`);
    return response.data.data!;
  },

  async create(data: UpsertNewsRequest): Promise<NewsItem> {
    const response = await api.post<ApiResponse<NewsItem>>('/news', data);
    return response.data.data!;
  },

  async update(id: string, data: UpsertNewsRequest): Promise<NewsItem> {
    const response = await api.put<ApiResponse<NewsItem>>(`/news/${id}`, data);
    return response.data.data!;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/news/${id}`);
  },

  async uploadMedia(file: File): Promise<NewsMediaFile> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<NewsMediaFile>>('/news/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data!;
  },

  async fetchMediaPreview(fileName: string): Promise<Blob> {
    const response = await api.get(`/news/files/${encodeURIComponent(fileName)}/view`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async fetchMediaDownload(fileName: string): Promise<Blob> {
    const response = await api.get(`/news/files/${encodeURIComponent(fileName)}/download`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};

// Org Tree
export const orgTreeService = {
  async getTree(): Promise<OrgTreeNode[]> {
    const response = await api.get<ApiResponse<OrgTreeNode[]>>('/org-tree');
    return response.data.data!;
  },

  async createNode(data: Partial<OrgTreeNode>): Promise<OrgTreeNode> {
    const response = await api.post<ApiResponse<OrgTreeNode>>('/org-tree/nodes', data);
    return response.data.data!;
  },

  async updateNode(id: string, data: Partial<OrgTreeNode>): Promise<OrgTreeNode> {
    const response = await api.put<ApiResponse<OrgTreeNode>>(`/org-tree/nodes/${id}`, data);
    return response.data.data!;
  },

  async deleteNode(id: string): Promise<void> {
    await api.delete(`/org-tree/nodes/${id}`);
  },
};
