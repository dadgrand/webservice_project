import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';

export type TestQuestionType = 'single' | 'multiple' | 'text';

export interface TestFileDto {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface TestOptionDto {
  id: string;
  text: string;
  image: TestFileDto | null;
}

export interface TestQuestionInput {
  stageTitle?: string;
  stageDescription?: string;
  question: string;
  questionType: TestQuestionType;
  options?: TestOptionDto[];
  correctOptionIds?: string[];
  acceptedAnswers?: string[];
  manualCheck?: boolean;
  points?: number;
  order?: number;
  explanation?: string;
  media?: TestFileDto[];
}

export interface CreateTestInput {
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
  questions: TestQuestionInput[];
}

export interface SubmitAnswerInput {
  questionId: string;
  optionIds?: string[];
  textAnswer?: string;
}

export interface SubmitAttemptInput {
  answers: SubmitAnswerInput[];
  timeSpent?: number;
}

export interface ManualReviewItem {
  questionId: string;
  isCorrect: boolean;
  awardedPoints?: number;
  comment?: string;
}

export interface ManualReviewInput {
  reviews: ManualReviewItem[];
  feedback?: string;
}

interface StoredCorrectAnswer {
  type: TestQuestionType;
  optionIds?: string[];
  acceptedAnswers?: string[];
  manualOnly?: boolean;
}

interface StoredAttemptAnswer {
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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toFileArray(value: unknown): TestFileDto[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (
        typeof row.id !== 'string' ||
        typeof row.fileName !== 'string' ||
        typeof row.fileUrl !== 'string' ||
        typeof row.fileSize !== 'number' ||
        typeof row.mimeType !== 'string'
      ) {
        return null;
      }

      return {
        id: row.id,
        fileName: row.fileName,
        fileUrl: row.fileUrl,
        fileSize: row.fileSize,
        mimeType: row.mimeType,
      } satisfies TestFileDto;
    })
    .filter((item): item is TestFileDto => item !== null);
}

function toOptionsArray(value: unknown): TestOptionDto[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== 'string' || typeof row.text !== 'string') {
        return null;
      }

      return {
        id: row.id,
        text: row.text,
        image: row.image ? toFileArray([row.image])[0] ?? null : null,
      } satisfies TestOptionDto;
    })
    .filter((item): item is TestOptionDto => item !== null);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractCorrectAnswer(value: unknown): StoredCorrectAnswer {
  if (!value || typeof value !== 'object') {
    return { type: 'text', acceptedAnswers: [], manualOnly: true };
  }

  const row = value as Record<string, unknown>;
  const type = row.type;

  if (type === 'single' || type === 'multiple') {
    return {
      type,
      optionIds: toStringArray(row.optionIds),
      manualOnly: false,
    };
  }

  return {
    type: 'text',
    acceptedAnswers: toStringArray(row.acceptedAnswers),
    manualOnly: Boolean(row.manualOnly),
  };
}

function hasAssignment(test: { assignToAll: boolean; assignedUserIds: unknown; assignedDepartmentIds: unknown; authorId: string }, userId: string, departmentId: string | null): boolean {
  if (test.authorId === userId) return true;
  if (test.assignToAll) return true;

  const userIds = toStringArray(test.assignedUserIds);
  if (userIds.includes(userId)) return true;

  if (!departmentId) return false;
  const departmentIds = toStringArray(test.assignedDepartmentIds);
  return departmentIds.includes(departmentId);
}

function serializeQuestionInput(question: TestQuestionInput, order: number) {
  const questionType = question.questionType;
  const optionRows = (question.options || [])
    .filter((item) => item.text.trim().length > 0)
    .map((item) => ({
      id: item.id || randomUUID(),
      text: item.text.trim(),
      image: item.image ?? null,
    }));

  let correctAnswer: StoredCorrectAnswer;
  if (questionType === 'text') {
    const acceptedAnswers = (question.acceptedAnswers || [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    correctAnswer = {
      type: 'text',
      acceptedAnswers,
      manualOnly: question.manualCheck || acceptedAnswers.length === 0,
    };
  } else {
    const allowedIds = new Set(optionRows.map((item) => item.id));
    const optionIds = (question.correctOptionIds || []).filter((item) => allowedIds.has(item));
    correctAnswer = {
      type: questionType,
      optionIds,
      manualOnly: false,
    };
  }

  return {
    stageTitle: question.stageTitle?.trim() || null,
    stageDescription: question.stageDescription?.trim() || null,
    question: question.question.trim(),
    questionType,
    options: optionRows as Prisma.InputJsonValue,
    correctAnswer: correctAnswer as unknown as Prisma.InputJsonValue,
    media: (question.media || []) as unknown as Prisma.InputJsonValue,
    manualCheck: Boolean(question.manualCheck),
    points: Math.max(1, question.points || 1),
    order: question.order ?? order,
    explanation: question.explanation?.trim() || null,
  };
}

function sanitizeQuestionForParticipant(question: {
  id: string;
  stageTitle: string | null;
  stageDescription: string | null;
  question: string;
  questionType: string;
  options: unknown;
  media: unknown;
  points: number;
  order: number;
  explanation: string | null;
  manualCheck: boolean;
}) {
  return {
    id: question.id,
    stageTitle: question.stageTitle,
    stageDescription: question.stageDescription,
    question: question.question,
    questionType: question.questionType,
    options: toOptionsArray(question.options),
    media: toFileArray(question.media),
    points: question.points,
    order: question.order,
    explanation: question.explanation,
    manualCheck: question.manualCheck,
  };
}

function sortQuestions<T extends { order: number }>(questions: T[], shuffle: boolean): T[] {
  const ordered = [...questions].sort((a, b) => a.order - b.order);
  if (!shuffle) return ordered;

  for (let i = ordered.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [ordered[i], ordered[randomIndex]] = [ordered[randomIndex], ordered[i]];
  }

  return ordered;
}

function findTestFileByStoredName(
  questions: Array<{ media: unknown; options: unknown }>,
  storedFileName: string
): TestFileDto | null {
  for (const question of questions) {
    const directMedia = toFileArray(question.media).find((file) => file.fileUrl === storedFileName);
    if (directMedia) {
      return directMedia;
    }

    const optionImage = toOptionsArray(question.options)
      .map((option) => option.image)
      .find((file): file is TestFileDto => Boolean(file && file.fileUrl === storedFileName));

    if (optionImage) {
      return optionImage;
    }
  }

  return null;
}

export async function getAudienceOptions() {
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        avatarUrl: true,
        position: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
      },
    }),
  ]);

  return { users, departments };
}

export async function createTest(authorId: string, payload: CreateTestInput) {
  const title = payload.title.trim();
  if (!title) {
    throw new Error('Название теста обязательно');
  }

  if (!payload.questions || payload.questions.length === 0) {
    throw new Error('Добавьте хотя бы один этап с вопросом');
  }

  const assignedUserIds = Array.from(new Set(payload.assignedUserIds || [])).filter(Boolean);
  const assignedDepartmentIds = Array.from(new Set(payload.assignedDepartmentIds || [])).filter(Boolean);

  const questions = payload.questions.map((question, index) => serializeQuestionInput(question, index));

  const created = await prisma.test.create({
    data: {
      title,
      description: payload.description?.trim() || null,
      authorId,
      assignToAll: Boolean(payload.assignToAll),
      assignedUserIds: payload.assignToAll ? [] : assignedUserIds,
      assignedDepartmentIds: payload.assignToAll ? [] : assignedDepartmentIds,
      timeLimit: payload.timeLimit ?? null,
      passingScore: Math.min(100, Math.max(1, payload.passingScore ?? 70)),
      shuffleQuestions: Boolean(payload.shuffleQuestions),
      showResults: payload.showResults ?? true,
      showCorrectAnswers: payload.showCorrectAnswers ?? true,
      maxAttempts: payload.maxAttempts ?? null,
      isPublished: payload.isPublished ?? false,
      questions: {
        create: questions,
      },
    },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      questions: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return {
    ...created,
    assignedUserIds: toStringArray(created.assignedUserIds),
    assignedDepartmentIds: toStringArray(created.assignedDepartmentIds),
    questions: created.questions.map((question) => ({
      ...question,
      options: toOptionsArray(question.options),
      media: toFileArray(question.media),
      correctAnswer: extractCorrectAnswer(question.correctAnswer),
    })),
  };
}

export async function listTestsForUser(userId: string, isAdmin: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, departmentId: true },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const tests = await prisma.test.findMany({
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      questions: {
        select: {
          id: true,
        },
      },
      attempts: {
        where: { userId },
        orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
        take: 1,
      },
    },
    orderBy: [{ isPublished: 'desc' }, { updatedAt: 'desc' }],
  });

  const visibleTests = tests.filter((test) => {
    if (isAdmin) return true;
    if (test.authorId === userId) return true;
    if (!test.isPublished) return false;
    return hasAssignment(test, userId, user.departmentId);
  });

  return visibleTests.map((test) => {
    const latestAttempt = test.attempts[0] ?? null;
    return {
      id: test.id,
      title: test.title,
      description: test.description,
      author: test.author,
      isPublished: test.isPublished,
      passingScore: test.passingScore,
      showResults: test.showResults,
      showCorrectAnswers: test.showCorrectAnswers,
      timeLimit: test.timeLimit,
      maxAttempts: test.maxAttempts,
      questionCount: test.questions.length,
      assignToAll: test.assignToAll,
      assignedUserIds: toStringArray(test.assignedUserIds),
      assignedDepartmentIds: toStringArray(test.assignedDepartmentIds),
      latestAttempt: latestAttempt
        ? {
            id: latestAttempt.id,
            percentage: latestAttempt.percentage,
            isPassed: latestAttempt.isPassed,
            status: latestAttempt.status,
            completedAt: latestAttempt.completedAt,
          }
        : null,
      canTake: test.isPublished && hasAssignment(test, userId, user.departmentId),
      canEdit: isAdmin || test.authorId === userId,
    };
  });
}

export async function getUserSummary(userId: string, isAdmin: boolean) {
  const tests = await listTestsForUser(userId, isAdmin);
  const accessible = tests.filter((test) => test.canTake || test.canEdit);

  const latestAttempts = accessible
    .map((test) => test.latestAttempt)
    .filter((attempt): attempt is NonNullable<typeof tests[number]['latestAttempt']> => attempt !== null);

  const completedCount = latestAttempts.length;
  const passedCount = latestAttempts.filter((attempt) => attempt.isPassed).length;
  const pendingReviewCount = latestAttempts.filter((attempt) => attempt.status === 'pending_review').length;
  const averagePercentage =
    latestAttempts.length === 0
      ? 0
      : Math.round(latestAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / latestAttempts.length);

  return {
    assignedCount: accessible.filter((test) => test.canTake).length,
    completedCount,
    passedCount,
    pendingReviewCount,
    averagePercentage,
  };
}

export async function getTestById(testId: string, userId: string, isAdmin: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      questions: {
        orderBy: { order: 'asc' },
      },
      attempts: {
        where: { userId },
        orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
        take: 10,
      },
    },
  });

  if (!test) {
    return null;
  }

  const canEdit = isAdmin || test.authorId === userId;
  const canTake = test.isPublished && hasAssignment(test, userId, user.departmentId);

  if (!canEdit && !canTake) {
    return null;
  }

  const serializedQuestions = sortQuestions(test.questions, false).map((question) => {
    const base = sanitizeQuestionForParticipant(question);

    if (canEdit) {
      return {
        ...base,
        correctAnswer: extractCorrectAnswer(question.correctAnswer),
      };
    }

    return base;
  });

  let pendingManualAttempts: Array<{
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
      department: { id: string; name: string } | null;
    };
    startedAt: Date;
    completedAt: Date | null;
  }> = [];

  if (canEdit) {
    const pending = await prisma.testAttempt.findMany({
      where: {
        testId,
        manualReviewRequired: true,
        status: 'pending_review',
      },
      orderBy: { startedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: 20,
    });

    pendingManualAttempts = pending.map((attempt) => ({
      id: attempt.id,
      user: attempt.user,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    }));
  }

  return {
    id: test.id,
    title: test.title,
    description: test.description,
    author: test.author,
    assignToAll: test.assignToAll,
    assignedUserIds: toStringArray(test.assignedUserIds),
    assignedDepartmentIds: toStringArray(test.assignedDepartmentIds),
    timeLimit: test.timeLimit,
    passingScore: test.passingScore,
    shuffleQuestions: test.shuffleQuestions,
    showResults: test.showResults,
    showCorrectAnswers: test.showCorrectAnswers,
    maxAttempts: test.maxAttempts,
    isPublished: test.isPublished,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    questions: serializedQuestions,
    myAttempts: test.attempts,
    myLatestAttempt: test.attempts[0] ?? null,
    canEdit,
    canTake,
    pendingManualAttempts,
  };
}

function evaluateChoiceAnswer(userOptionIds: string[], correctOptionIds: string[]): boolean {
  if (userOptionIds.length !== correctOptionIds.length) return false;

  const left = [...userOptionIds].sort();
  const right = [...correctOptionIds].sort();

  return left.every((value, index) => value === right[index]);
}

function buildAttemptAnswer(question: {
  id: string;
  question: string;
  questionType: string;
  correctAnswer: unknown;
  points: number;
  explanation: string | null;
}, answer: SubmitAnswerInput | undefined): StoredAttemptAnswer {
  const questionType = (question.questionType as TestQuestionType) || 'text';
  const correctAnswer = extractCorrectAnswer(question.correctAnswer);
  const userOptionIds = Array.from(new Set(answer?.optionIds || []));
  const userTextAnswer = answer?.textAnswer?.trim() || '';

  if (questionType === 'single' || questionType === 'multiple') {
    const correctOptionIds = correctAnswer.optionIds || [];
    const isCorrect = evaluateChoiceAnswer(userOptionIds, correctOptionIds);

    return {
      questionId: question.id,
      question: question.question,
      questionType,
      points: question.points,
      userOptionIds,
      userTextAnswer,
      correctOptionIds,
      acceptedAnswers: [],
      isCorrect,
      awardedPoints: isCorrect ? question.points : 0,
      requiresManualReview: false,
      explanation: question.explanation || '',
      reviewComment: '',
    };
  }

  const acceptedAnswers = (correctAnswer.acceptedAnswers || []).map(normalizeText);
  const normalizedAnswer = normalizeText(userTextAnswer);
  const manualOnly = Boolean(correctAnswer.manualOnly);

  if ((manualOnly || acceptedAnswers.length === 0) && normalizedAnswer.length === 0) {
    return {
      questionId: question.id,
      question: question.question,
      questionType: 'text',
      points: question.points,
      userOptionIds: [],
      userTextAnswer,
      correctOptionIds: [],
      acceptedAnswers,
      isCorrect: false,
      awardedPoints: 0,
      requiresManualReview: false,
      explanation: question.explanation || '',
      reviewComment: '',
    };
  }

  if (manualOnly || acceptedAnswers.length === 0) {
    return {
      questionId: question.id,
      question: question.question,
      questionType: 'text',
      points: question.points,
      userOptionIds: [],
      userTextAnswer,
      correctOptionIds: [],
      acceptedAnswers,
      isCorrect: null,
      awardedPoints: 0,
      requiresManualReview: true,
      explanation: question.explanation || '',
      reviewComment: '',
    };
  }

  const isCorrect = acceptedAnswers.includes(normalizedAnswer);

  return {
    questionId: question.id,
    question: question.question,
    questionType: 'text',
    points: question.points,
    userOptionIds: [],
    userTextAnswer,
    correctOptionIds: [],
    acceptedAnswers,
    isCorrect,
    awardedPoints: isCorrect ? question.points : 0,
    requiresManualReview: false,
    explanation: question.explanation || '',
    reviewComment: '',
  };
}

function sanitizeAttemptAnswers(answers: StoredAttemptAnswer[], canShowCorrectAnswers: boolean) {
  return answers.map((answer) => {
    if (canShowCorrectAnswers) {
      return answer;
    }

    return {
      ...answer,
      correctOptionIds: [],
      acceptedAnswers: [],
    };
  });
}

export async function submitAttempt(testId: string, userId: string, isAdmin: boolean, payload: SubmitAttemptInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!test) {
    throw new Error('Тест не найден');
  }

  const canTake = isAdmin || hasAssignment(test, userId, user.departmentId);
  if (!test.isPublished || !canTake) {
    throw new Error('Тест недоступен для прохождения');
  }

  const attemptsCount = await prisma.testAttempt.count({
    where: { testId, userId },
  });

  if (test.maxAttempts !== null && attemptsCount >= test.maxAttempts) {
    throw new Error('Достигнут лимит попыток по этому тесту');
  }

  const answerMap = new Map<string, SubmitAnswerInput>();
  for (const answer of payload.answers || []) {
    if (answer.questionId) {
      answerMap.set(answer.questionId, answer);
    }
  }

  const evaluatedAnswers = test.questions.map((question) => buildAttemptAnswer(question, answerMap.get(question.id)));
  const maxScore = evaluatedAnswers.reduce((sum, answer) => sum + answer.points, 0);
  const scoreAuto = evaluatedAnswers.reduce((sum, answer) => sum + (answer.requiresManualReview ? 0 : answer.awardedPoints), 0);
  const manualReviewRequired = evaluatedAnswers.some((answer) => answer.requiresManualReview);

  const score = scoreAuto;
  const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const isPassed = !manualReviewRequired && percentage >= test.passingScore;

  const createdAttempt = await prisma.testAttempt.create({
    data: {
      testId,
      userId,
      answers: evaluatedAnswers as unknown as Prisma.InputJsonValue,
      status: manualReviewRequired ? 'pending_review' : 'completed',
      manualReviewRequired,
      scoreAuto,
      scoreManual: 0,
      score,
      maxScore,
      percentage,
      isPassed,
      timeSpent: payload.timeSpent,
      completedAt: new Date(),
    },
  });

  const canShowResults = test.showResults || isAdmin || test.authorId === userId;
  const canShowCorrectAnswers = (test.showCorrectAnswers && canShowResults) || isAdmin || test.authorId === userId;

  return {
    attempt: {
      ...createdAttempt,
      answers: canShowResults ? sanitizeAttemptAnswers(evaluatedAnswers, canShowCorrectAnswers) : [],
    },
    showResults: canShowResults,
    showCorrectAnswers: canShowCorrectAnswers,
  };
}

export async function getAttemptById(attemptId: string, userId: string, isAdmin: boolean) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      test: {
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
            },
          },
        },
      },
    },
  });

  if (!attempt) return null;

  const canEdit = isAdmin || attempt.test.authorId === userId;
  const canView = canEdit || attempt.userId === userId;
  if (!canView) {
    return null;
  }

  const answers = Array.isArray(attempt.answers)
    ? (attempt.answers as unknown[]).filter((item): item is StoredAttemptAnswer => Boolean(item && typeof item === 'object'))
    : [];

  const canShowResults = attempt.test.showResults || canEdit;
  const canShowCorrectAnswers = (attempt.test.showCorrectAnswers && canShowResults) || canEdit;

  return {
    ...attempt,
    canEdit,
    canShowResults,
    canShowCorrectAnswers,
    answers: canShowResults ? sanitizeAttemptAnswers(answers, canShowCorrectAnswers) : [],
  };
}

export async function reviewAttempt(attemptId: string, reviewerId: string, isAdmin: boolean, payload: ManualReviewInput) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          questions: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new Error('Попытка не найдена');
  }

  const canEdit = isAdmin || attempt.test.authorId === reviewerId;
  if (!canEdit) {
    throw new Error('Недостаточно прав для ручной проверки');
  }

  const answers = Array.isArray(attempt.answers)
    ? (attempt.answers as unknown[]).filter((item): item is StoredAttemptAnswer => Boolean(item && typeof item === 'object'))
    : [];

  const questionPoints = new Map<string, number>();
  for (const question of attempt.test.questions) {
    questionPoints.set(question.id, question.points);
  }

  const reviews = new Map(payload.reviews.map((review) => [review.questionId, review]));

  const updatedAnswers = answers.map((answer) => {
    if (!answer.requiresManualReview) {
      return answer;
    }

    const review = reviews.get(answer.questionId);
    if (!review) {
      return answer;
    }

    const maxPoints = questionPoints.get(answer.questionId) ?? answer.points;
    const awardedPoints =
      typeof review.awardedPoints === 'number'
        ? Math.min(maxPoints, Math.max(0, review.awardedPoints))
        : review.isCorrect
          ? maxPoints
          : 0;

    return {
      ...answer,
      isCorrect: review.isCorrect,
      awardedPoints,
      reviewComment: review.comment?.trim() || '',
      requiresManualReview: false,
    };
  });

  const hasPendingManual = updatedAnswers.some((answer) => answer.requiresManualReview || answer.isCorrect === null);
  const scoreAuto = attempt.scoreAuto;
  const totalAwarded = updatedAnswers.reduce((sum, answer) => sum + answer.awardedPoints, 0);
  const scoreManual = Math.max(0, totalAwarded - scoreAuto);
  const score = scoreAuto + scoreManual;
  const maxScore = attempt.maxScore;
  const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);
  const isPassed = !hasPendingManual && percentage >= attempt.test.passingScore;

  const updatedAttempt = await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      answers: updatedAnswers as unknown as Prisma.InputJsonValue,
      status: hasPendingManual ? 'pending_review' : 'reviewed',
      manualReviewRequired: hasPendingManual,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      scoreManual,
      score,
      percentage,
      isPassed,
      feedback: payload.feedback?.trim() || null,
    },
  });

  return {
    ...updatedAttempt,
    answers: updatedAnswers,
  };
}

export async function getAccessibleFile(storedFileName: string, userId: string, isAdmin: boolean) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user) {
    throw new Error('Пользователь не найден');
  }

  const tests = await prisma.test.findMany({
    select: {
      id: true,
      authorId: true,
      assignToAll: true,
      assignedUserIds: true,
      assignedDepartmentIds: true,
      isPublished: true,
      questions: {
        select: {
          media: true,
          options: true,
        },
      },
    },
  });

  for (const test of tests) {
    const file = findTestFileByStoredName(test.questions, storedFileName);
    if (!file) {
      continue;
    }

    const canEdit = isAdmin || test.authorId === userId;
    const canTake = test.isPublished && hasAssignment(test, userId, user.departmentId);

    if (!canEdit && !canTake) {
      return null;
    }

    return file;
  }

  return null;
}
