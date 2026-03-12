// User types (должны совпадать с backend)
export interface User {
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
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

// Contact types
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  position: string | null;
  phone: string | null;
  phoneInternal: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  isActive: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  headId: string | null;
  order: number;
  color: string | null;
  children?: Department[];
  head?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    avatarUrl: string | null;
  } | null;
  employeeCount?: number;
}

// Message types
export interface MessageFolder {
  id: string;
  name: string;
  type: 'system' | 'custom';
  icon: string | null;
  color: string | null;
  order: number;
  messageCount: number;
  unreadCount: number;
  systemName?: string | null;
}

export interface MessageLabel {
  id: string;
  name: string;
  color: string;
  messageCount?: number;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface MessageDraft {
  id: string;
  subject: string;
  content: string;
  recipientIds: string[];
  ccIds: string[];
  bccIds: string[];
  isImportant: boolean;
  updatedAt: string;
  replyToId?: string | null;
  forwardFromId?: string | null;
  attachments: MessageAttachment[];
}

export interface Message {
  id: string;
  subject: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
  threadId?: string | null;
  replyToId?: string | null;
  forwardedFromId?: string | null;
  threadMessageCount: number;
  folderId?: string | null;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    position: string | null;
  };
  recipients: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  }[];
  labels?: MessageLabel[];
  attachments: MessageAttachment[];
  isRead?: boolean;
  readAt?: string | null;
  isStarred?: boolean;
  canOrganize: boolean;
}

export interface InboxMessage {
  id: string;
  subject: string;
  isImportant: boolean;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  threadId?: string | null;
  threadMessageCount: number;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
  preview: string;
  hasAttachments: boolean;
  labels?: MessageLabel[];
  isStarred?: boolean;
  canOrganize: boolean;
}

export interface MessageThread {
  id: string;
  subject: string;
  updatedAt: string;
  messages: Message[];
}

// Documents module types
export type DocumentThreadMode = 'distribution' | 'read_receipt' | 'approval';
export type DocumentDistributionType = 'all' | 'departments' | 'groups' | 'individual';
export type DocumentThreadStatus = 'new' | 'in_progress' | 'changes_requested' | 'completed';
export type DocumentDecision = 'approved' | 'changes_requested';

export interface DocumentThreadRecipientState {
  userId: string;
  isRead: boolean;
  readAt: string | null;
  decision: DocumentDecision | null;
  decisionComment: string | null;
  decidedAt: string | null;
}

export interface DocumentThreadSummary {
  id: string;
  title: string;
  description: string | null;
  mode: DocumentThreadMode;
  distributionType: DocumentDistributionType;
  status: DocumentThreadStatus;
  requiresReadReceipt: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    avatarUrl: string | null;
    position: string | null;
  };
  recipientStats: {
    total: number;
    read: number;
    approved: number;
    changesRequested: number;
    pendingApproval: number;
  };
  myRecipient: DocumentThreadRecipientState | null;
  activeFileCount: number;
  totalFileCount: number;
  latestActiveFile: {
    id: string;
    fileName: string;
    mimeType: string;
    version: number;
    createdAt: string;
  } | null;
}

export interface DocumentThreadRecipientDetails {
  id: string;
  isRead: boolean;
  readAt: string | null;
  decision: DocumentDecision | null;
  decisionComment: string | null;
  decidedAt: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    email: string;
    avatarUrl: string | null;
    position: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  };
}

export interface DocumentThreadFile {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  version: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
}

export interface DocumentThreadAction {
  id: string;
  action: string;
  comment: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    position: string | null;
  };
}

export interface DocumentThreadDetail extends DocumentThreadSummary {
  recipients: DocumentThreadRecipientDetails[];
  departments: {
    id: string;
    name: string;
    color: string | null;
  }[];
  groups: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
  }[];
  files: DocumentThreadFile[];
  actions: DocumentThreadAction[];
}

export interface DocumentUploadedFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface DocumentGroup {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  memberCount: number;
  members: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    email: string;
  }[];
}

export interface DocumentAudienceOptions {
  users: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    email: string;
    avatarUrl: string | null;
    position: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  }[];
  departments: {
    id: string;
    name: string;
    color: string | null;
  }[];
  groups: DocumentGroup[];
}

export interface DocumentSupportedFormat {
  category: string;
  title: string;
  extensions: string[];
  preview: string;
}

// Learning module types
export type LearningMaterialType = 'single_page' | 'multi_page';

export interface LearningFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface LearningPageItem {
  id: string;
  title: string;
  content: string | null;
  order: number;
  files: LearningFile[];
}

export interface LearningAuthor {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
}

export interface LearningMaterialListItem {
  id: string;
  title: string;
  description: string | null;
  materialType: LearningMaterialType;
  isPublished: boolean;
  assignToAll: boolean;
  assignedUserIds: string[];
  assignedDepartmentIds: string[];
  expiresAt: string | null;
  archivedAt: string | null;
  isArchived: boolean;
  isExpired: boolean;
  canEdit: boolean;
  canOpen: boolean;
  pageCount: number;
  lastVisitedAt: string | null;
  author: LearningAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface LearningMaterialDetail {
  id: string;
  title: string;
  description: string | null;
  materialType: LearningMaterialType;
  assignToAll: boolean;
  assignedUserIds: string[];
  assignedDepartmentIds: string[];
  expiresAt: string | null;
  archivedAt: string | null;
  isArchived: boolean;
  isExpired: boolean;
  isPublished: boolean;
  canEdit: boolean;
  canOpen: boolean;
  createdAt: string;
  updatedAt: string;
  author: LearningAuthor;
  pages: LearningPageItem[];
}

export interface LearningAudienceOptions {
  users: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    email: string;
    avatarUrl: string | null;
    position: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  }[];
  departments: {
    id: string;
    name: string;
    color: string | null;
  }[];
}

export interface LearningSummary {
  assignedCount: number;
  viewedCount: number;
  expiredCount: number;
  totalAvailable: number;
}

export interface CreateLearningMaterialRequest {
  title: string;
  description?: string;
  materialType: LearningMaterialType;
  assignToAll?: boolean;
  assignedUserIds?: string[];
  assignedDepartmentIds?: string[];
  expiresAt?: string | null;
  isPublished?: boolean;
  pages: Array<{
    title: string;
    content?: string;
    order?: number;
    files?: LearningFile[];
  }>;
}

// Tests module types
export type TestQuestionType = 'single' | 'multiple' | 'text';

export interface TestMediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface TestOption {
  id: string;
  text: string;
  image: TestMediaFile | null;
}

export interface TestQuestion {
  id: string;
  stageTitle: string | null;
  stageDescription: string | null;
  question: string;
  questionType: TestQuestionType;
  options: TestOption[];
  media: TestMediaFile[];
  points: number;
  order: number;
  explanation: string | null;
  manualCheck: boolean;
  correctAnswer?: {
    type: TestQuestionType;
    optionIds?: string[];
    acceptedAnswers?: string[];
    manualOnly?: boolean;
  };
}

export interface TestAttemptAnswer {
  questionId: string;
  question: string;
  questionType: TestQuestionType;
  points: number;
  userOptionIds: string[];
  userTextAnswer: string;
  correctOptionIds: string[];
  acceptedAnswers: string[];
  isCorrect: boolean | null;
  awardedPoints: number;
  requiresManualReview: boolean;
  explanation: string;
  reviewComment: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  userId: string;
  status: 'completed' | 'pending_review' | 'reviewed';
  manualReviewRequired: boolean;
  reviewedById: string | null;
  reviewedAt: string | null;
  scoreAuto: number;
  scoreManual: number;
  feedback: string | null;
  answers: TestAttemptAnswer[];
  score: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  startedAt: string;
  completedAt: string | null;
  timeSpent: number | null;
}

export interface TestListItem {
  id: string;
  title: string;
  description: string | null;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  isPublished: boolean;
  passingScore: number;
  showResults: boolean;
  showCorrectAnswers: boolean;
  timeLimit: number | null;
  maxAttempts: number | null;
  archivedAt: string | null;
  isArchived: boolean;
  questionCount: number;
  assignToAll: boolean;
  assignedUserIds: string[];
  assignedDepartmentIds: string[];
  latestAttempt: {
    id: string;
    percentage: number;
    isPassed: boolean;
    status: 'completed' | 'pending_review' | 'reviewed';
    completedAt: string | null;
  } | null;
  canTake: boolean;
  canEdit: boolean;
}

export interface TestSummary {
  assignedCount: number;
  completedCount: number;
  passedCount: number;
  pendingReviewCount: number;
  averagePercentage: number;
}

export interface TestAudienceOptions {
  users: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    email: string;
    avatarUrl: string | null;
    position: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  }[];
  departments: {
    id: string;
    name: string;
    color: string | null;
  }[];
}

export interface TestDetail {
  id: string;
  title: string;
  description: string | null;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  assignToAll: boolean;
  assignedUserIds: string[];
  assignedDepartmentIds: string[];
  timeLimit: number | null;
  passingScore: number;
  shuffleQuestions: boolean;
  showResults: boolean;
  showCorrectAnswers: boolean;
  maxAttempts: number | null;
  isPublished: boolean;
  archivedAt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  questions: TestQuestion[];
  myAttempts: TestAttempt[];
  myLatestAttempt: TestAttempt | null;
  canEdit: boolean;
  canTake: boolean;
  pendingManualAttempts: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
      department: { id: string; name: string } | null;
    };
    startedAt: string;
    completedAt: string | null;
  }[];
}

export interface CreateTestRequest {
  title: string;
  description?: string;
  assignToAll?: boolean;
  assignedUserIds?: string[];
  assignedDepartmentIds?: string[];
  timeLimit?: number | null;
  passingScore?: number;
  shuffleQuestions?: boolean;
  showResults?: boolean;
  showCorrectAnswers?: boolean;
  maxAttempts?: number | null;
  isPublished?: boolean;
  questions: {
    stageTitle?: string;
    stageDescription?: string;
    question: string;
    questionType: TestQuestionType;
    options?: TestOption[];
    correctOptionIds?: string[];
    acceptedAnswers?: string[];
    manualCheck?: boolean;
    points?: number;
    order?: number;
    explanation?: string;
    media?: TestMediaFile[];
  }[];
}

export interface SubmitTestAttemptRequest {
  answers: {
    questionId: string;
    optionIds?: string[];
    textAnswer?: string;
  }[];
  timeSpent?: number;
}

// News module types
export interface NewsMediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  order: number;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  media: NewsMediaFile[];
}

export interface UpsertNewsRequest {
  title: string;
  content: string;
  isPinned?: boolean;
  media: NewsMediaFile[];
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: { field: string; message: string }[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User management
export interface CreateUserRequest {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  position?: string;
  departmentId?: string;
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
  departmentId?: string;
  phone?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  permissions?: string[];
}

// Permission codes
export const PermissionCodes = {
  TESTS_EDIT: 'tests.edit',
  TESTS_STATS: 'tests.stats',
  LEARNING_EDIT: 'learning.edit',
  LEARNING_STATS: 'learning.stats',
  DOCUMENTS_EDIT: 'documents.edit',
  MESSAGES_BROADCAST: 'messages.broadcast',
  NEWS_MANAGE: 'news.manage',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
} as const;

// Org Tree types
export interface OrgTreeNode {
  id: string;
  parentId: string | null;
  type: string;
  departmentId: string | null;
  linkedUserId: string | null;
  customTitle: string | null;
  customSubtitle: string | null;
  customImageUrl: string | null;
  linkUrl: string | null;
  order: number;
  style: {
    position?: { x: number; y: number };
    [key: string]: unknown;
  };
  isVisible: boolean;
  department?: { id: string; name: string };
  linkedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    position: string | null;
    avatarUrl: string | null;
  };
}
