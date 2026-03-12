import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add,
  Archive,
  AssignmentTurnedIn,
  CheckCircle,
  CloudDownload,
  Delete,
  Edit,
  Image,
  InsertDriveFile,
  Percent,
  PlayArrow,
  Quiz,
  Refresh,
  Save,
  Search,
  Send,
  SmartDisplay,
  Upload,
  Unarchive,
  Visibility,
  Warning,
} from '@mui/icons-material';
import { testService } from '../services';
import type {
  CreateTestRequest,
  TestAttempt,
  TestAudienceOptions,
  TestDetail,
  TestListItem,
  TestMediaFile,
  TestOption,
  TestQuestion,
  TestQuestionType,
  TestSummary,
} from '../types';
import { PermissionCodes } from '../types';
import { useHasPermission } from '../store/authStore';
import { shellInnerPanelSx } from '../styles/shell';
import { normalizeUploadedFileName } from '../utils/fileName';

interface QuestionDraft {
  localId: string;
  stageTitle: string;
  stageDescription: string;
  question: string;
  questionType: TestQuestionType;
  options: TestOption[];
  correctOptionIds: string[];
  acceptedAnswers: string[];
  acceptedInput: string;
  manualCheck: boolean;
  points: number;
  explanation: string;
  media: TestMediaFile[];
}

interface CreateFormState {
  title: string;
  description: string;
  assignToAll: boolean;
  assignedUserIds: string[];
  assignedDepartmentIds: string[];
  timeLimit: string;
  passingScore: number;
  shuffleQuestions: boolean;
  showResults: boolean;
  showCorrectAnswers: boolean;
  maxAttempts: string;
  isPublished: boolean;
  questions: QuestionDraft[];
}

interface RuntimeAnswer {
  questionId: string;
  optionIds: string[];
  textAnswer: string;
}

interface ReviewDraft {
  questionId: string;
  isCorrect: boolean;
  awardedPoints: number;
  comment: string;
}

interface PrefetchedMediaEntry {
  objectUrl: string;
  textContent: string | null;
  docxHtml: string | null;
}

type TestListMode = 'active' | 'archive';

interface TestContextMenuState {
  mouseX: number;
  mouseY: number;
  test: TestListItem;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function fullName(firstName: string, lastName: string, middleName?: string | null): string {
  return `${lastName} ${firstName}${middleName ? ` ${middleName}` : ''}`;
}

function getAttemptStatusLabel(status: TestAttempt['status']): string {
  if (status === 'completed') return 'Завершена';
  if (status === 'pending_review') return 'Ждет проверки';
  return 'Проверена';
}

function isImage(file: TestMediaFile): boolean {
  return file.mimeType.startsWith('image/');
}

function isVideo(file: TestMediaFile): boolean {
  return file.mimeType.startsWith('video/');
}

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

function isPdfFile(file: TestMediaFile): boolean {
  return file.mimeType.toLowerCase().includes('pdf') || getFileExtension(file.fileName) === 'pdf';
}

function isDocxFile(file: TestMediaFile): boolean {
  const ext = getFileExtension(file.fileName);
  const mime = file.mimeType.toLowerCase();
  return ext === 'docx' || mime.includes('wordprocessingml.document');
}

function isTextFile(file: TestMediaFile): boolean {
  const name = file.fileName.toLowerCase();
  const mime = file.mimeType.toLowerCase();
  const textByName =
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.tsv') ||
    name.endsWith('.log') ||
    name.endsWith('.json') ||
    name.endsWith('.xml') ||
    name.endsWith('.yml') ||
    name.endsWith('.yaml') ||
    name.endsWith('.ini') ||
    name.endsWith('.cfg') ||
    name.endsWith('.conf');

  const exactTextMime =
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'text/xml' ||
    mime === 'application/csv' ||
    mime === 'application/x-csv' ||
    mime === 'text/csv' ||
    mime === 'application/yaml' ||
    mime === 'application/x-yaml' ||
    mime === 'text/yaml';

  const textByMime =
    mime.startsWith('text/') ||
    exactTextMime ||
    mime.endsWith('+json') ||
    mime.endsWith('+xml');

  return textByName || textByMime;
}

const testsPanelSx = {
  backgroundColor: 'rgba(255,255,255,0.95)',
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,252,254,0.94) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
  overflow: 'hidden',
};

const testsSidebarCardSx = {
  ...testsPanelSx,
  borderRadius: '24px',
};

const testsMainCardSx = {
  ...testsPanelSx,
  borderRadius: '18px',
};

function getCharsetFromMimeType(mimeType: string): string | null {
  const match = mimeType.match(/charset=([^;]+)/i);
  return match?.[1]?.trim().toLowerCase() || null;
}

async function decodeTextBlob(blob: Blob, mimeType: string): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const mimeCharset = getCharsetFromMimeType(mimeType);
  const encodings = [mimeCharset, 'utf-8', 'windows-1251', 'koi8-r'].filter(
    (value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index
  );

  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      // Try next possible charset.
    }
  }

  return new TextDecoder().decode(bytes);
}

async function renderDocxToHtml(blob: Blob): Promise<string | null> {
  try {
    const { default: mammoth } = await import('mammoth/mammoth.browser');
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value || null;
  } catch {
    return null;
  }
}

function ensureBlobType(blob: Blob, file: TestMediaFile): Blob {
  if (blob.type) {
    return blob;
  }

  if (file.mimeType) {
    return new Blob([blob], { type: file.mimeType });
  }

  return blob;
}

function buildEmptyQuestion(order: number): QuestionDraft {
  return {
    localId: makeId(),
    stageTitle: `Этап ${order + 1}`,
    stageDescription: '',
    question: '',
    questionType: 'single',
    options: [
      { id: makeId(), text: '', image: null },
      { id: makeId(), text: '', image: null },
    ],
    correctOptionIds: [],
    acceptedAnswers: [],
    acceptedInput: '',
    manualCheck: false,
    points: 1,
    explanation: '',
    media: [],
  };
}

function buildInitialForm(): CreateFormState {
  return {
    title: '',
    description: '',
    assignToAll: false,
    assignedUserIds: [],
    assignedDepartmentIds: [],
    timeLimit: '',
    passingScore: 70,
    shuffleQuestions: false,
    showResults: true,
    showCorrectAnswers: true,
    maxAttempts: '',
    isPublished: true,
    questions: [buildEmptyQuestion(0)],
  };
}

const FilePreview: React.FC<{ file: TestMediaFile; compact?: boolean; prefetched?: PrefetchedMediaEntry }> = ({
  file,
  compact = false,
  prefetched,
}) => {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const displayName = normalizeUploadedFileName(file.fileName);

  useEffect(() => {
    if (prefetched) {
      setLoading(false);
      setUrl(prefetched.objectUrl);
      setTextContent(prefetched.textContent);
      setDocxHtml(prefetched.docxHtml);
      return;
    }

    let mounted = true;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setTextContent(null);
      setDocxHtml(null);
      try {
        const sourceBlob = await testService.fetchMediaPreview(file.fileUrl);
        const blob = ensureBlobType(sourceBlob, file);
        if (isTextFile(file)) {
          const text = await decodeTextBlob(blob, file.mimeType);
          if (mounted) {
            setTextContent(text);
          }
        }
        if (isDocxFile(file)) {
          const html = await renderDocxToHtml(blob);
          if (mounted) {
            setDocxHtml(html);
          }
        }
        objectUrl = URL.createObjectURL(blob);
        if (mounted) {
          setUrl(objectUrl);
        }
      } catch {
        if (mounted) {
          setUrl(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file, prefetched]);

  const handleDownload = async () => {
    const blob = await testService.fetchMediaDownload(file.fileUrl);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = displayName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  const isPdf = isPdfFile(file);
  const isDocx = isDocxFile(file);
  const canEmbedDocument = isPdf;
  const isText = isTextFile(file);

  return (
    <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: compact ? 1 : 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            {isImage(file) ? <Image color="action" /> : isVideo(file) ? <SmartDisplay color="action" /> : <InsertDriveFile color="action" />}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(file.fileSize)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Открыть в просмотре">
              <IconButton size="small" onClick={() => setViewerOpen(true)}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Скачать">
              <IconButton size="small" onClick={() => void handleDownload()}>
                <CloudDownload fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {loading ? (
          <LinearProgress />
        ) : url && isImage(file) ? (
          <Box
            component="img"
            src={url}
            alt={file.fileName}
            sx={{
              width: '100%',
              maxHeight: compact ? 140 : 240,
              objectFit: 'contain',
              borderRadius: 1,
              bgcolor: 'grey.100',
              cursor: 'pointer',
            }}
            onClick={() => setViewerOpen(true)}
          />
        ) : url && isVideo(file) ? (
          <Box component="video" src={url} controls sx={{ width: '100%', borderRadius: 1, maxHeight: compact ? 180 : 280 }} />
        ) : isText && textContent !== null ? (
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: 'grey.100',
              maxHeight: compact ? 140 : 220,
              overflow: 'auto',
              cursor: 'pointer',
            }}
            onClick={() => setViewerOpen(true)}
          >
            <Typography
              component="pre"
              variant="body2"
              sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {textContent}
            </Typography>
          </Box>
        ) : isDocx && docxHtml ? (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'grey.100',
              maxHeight: compact ? 140 : 220,
              overflow: 'auto',
              '& p': { mt: 0, mb: 1 },
            }}
            onClick={() => setViewerOpen(true)}
          >
            <Box sx={{ '& *': { maxWidth: '100%' } }} dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </Box>
        ) : url && canEmbedDocument ? (
          <Box component="iframe" src={url} title={displayName} sx={{ width: '100%', border: 0, borderRadius: 1, height: compact ? 180 : 260 }} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            Файл доступен в окне просмотра.
          </Typography>
        )}
      </Stack>

      <Dialog open={viewerOpen} onClose={() => setViewerOpen(false)} fullWidth maxWidth="xl">
        <DialogTitle>{displayName}</DialogTitle>
        <DialogContent dividers>
          {!url ? (
            <CircularProgress />
          ) : isImage(file) ? (
            <Box component="img" src={url} alt={displayName} sx={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', bgcolor: 'grey.100' }} />
          ) : isVideo(file) ? (
            <Box component="video" src={url} controls sx={{ width: '100%', maxHeight: '80vh' }} />
          ) : isText && textContent !== null ? (
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'grey.100', maxHeight: '80vh', overflow: 'auto' }}>
              <Typography
                component="pre"
                sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              >
                {textContent}
              </Typography>
            </Box>
          ) : isDocx && docxHtml ? (
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'grey.100', maxHeight: '80vh', overflow: 'auto', '& p': { mt: 0, mb: 1.5 } }}>
              <Box sx={{ '& *': { maxWidth: '100%' } }} dangerouslySetInnerHTML={{ __html: docxHtml }} />
            </Box>
          ) : canEmbedDocument ? (
            <Box component="iframe" src={url} title={displayName} sx={{ width: '100%', height: '80vh', border: 0 }} />
          ) : (
            <Alert severity="info">
              Для этого формата встроенный просмотр недоступен. Используйте кнопку «Скачать».
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void handleDownload()} startIcon={<CloudDownload />}>Скачать</Button>
          <Button onClick={() => setViewerOpen(false)} variant="contained">Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

const OptionMediaPreview: React.FC<{ file: TestMediaFile; prefetched?: PrefetchedMediaEntry }> = ({ file, prefetched }) => {
  return <FilePreview file={file} compact prefetched={prefetched} />;
};

function toCreatePayload(form: CreateFormState): CreateTestRequest {
  return {
    title: form.title,
    description: form.description || undefined,
    assignToAll: form.assignToAll,
    assignedUserIds: form.assignToAll ? [] : form.assignedUserIds,
    assignedDepartmentIds: form.assignToAll ? [] : form.assignedDepartmentIds,
    timeLimit: form.timeLimit.trim() ? Number(form.timeLimit) : null,
    passingScore: form.passingScore,
    shuffleQuestions: form.shuffleQuestions,
    showResults: form.showResults,
    showCorrectAnswers: form.showCorrectAnswers,
    maxAttempts: form.maxAttempts.trim() ? Number(form.maxAttempts) : null,
    isPublished: form.isPublished,
    questions: form.questions.map((question, index) => ({
      stageTitle: question.stageTitle,
      stageDescription: question.stageDescription,
      question: question.question,
      questionType: question.questionType,
      options: question.questionType === 'text' ? [] : question.options,
      correctOptionIds: question.questionType === 'text' ? [] : question.correctOptionIds,
      acceptedAnswers: question.questionType === 'text' ? question.acceptedAnswers : [],
      manualCheck: question.questionType === 'text' ? question.manualCheck : false,
      points: question.points,
      order: index,
      explanation: question.explanation,
      media: question.media,
    })),
  };
}

const TestsPage: React.FC = () => {
  const canEditTests = useHasPermission(PermissionCodes.TESTS_EDIT);

  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [testListMode, setTestListMode] = useState<TestListMode>('active');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(buildInitialForm);
  const [creating, setCreating] = useState(false);
  const [audience, setAudience] = useState<TestAudienceOptions | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);

  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [runtimeAnswers, setRuntimeAnswers] = useState<Record<string, RuntimeAnswer>>({});
  const [taking, setTaking] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    attempt: TestAttempt;
    showResults: boolean;
    showCorrectAnswers: boolean;
  } | null>(null);

  const [reviewAttempt, setReviewAttempt] = useState<(TestAttempt & { canEdit: boolean; canShowResults: boolean; canShowCorrectAnswers: boolean }) | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loadingReview, setLoadingReview] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [preparingTest, setPreparingTest] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState(0);
  const [prefetchedMedia, setPrefetchedMedia] = useState<Record<string, PrefetchedMediaEntry>>({});
  const [testContextMenu, setTestContextMenu] = useState<TestContextMenuState | null>(null);

  const takingRef = useRef(false);
  const selectedTestRef = useRef<TestDetail | null>(null);
  const runtimeAnswersRef = useRef<Record<string, RuntimeAnswer>>({});
  const startedAtRef = useRef<number | null>(null);
  const attemptSentRef = useRef(false);

  useEffect(() => {
    takingRef.current = taking;
  }, [taking]);

  useEffect(() => {
    selectedTestRef.current = selectedTest;
  }, [selectedTest]);

  useEffect(() => {
    runtimeAnswersRef.current = runtimeAnswers;
  }, [runtimeAnswers]);

  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  const filteredTests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tests;
    return tests.filter((test) =>
      test.title.toLowerCase().includes(query) ||
      (test.description || '').toLowerCase().includes(query)
    );
  }, [tests, search]);

  const activeQuestion: TestQuestion | null = useMemo(() => {
    if (!selectedTest) return null;
    const sorted = [...selectedTest.questions].sort((a, b) => a.order - b.order);
    return sorted[activeStageIndex] || null;
  }, [selectedTest, activeStageIndex]);
  const showArchivedTests = canEditTests && testListMode === 'archive';

  const buildSubmitPayload = useCallback(() => {
    return {
      answers: Object.values(runtimeAnswersRef.current).map((answer) => ({
        questionId: answer.questionId,
        optionIds: answer.optionIds,
        textAnswer: answer.textAnswer,
      })),
      timeSpent: startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : undefined,
    };
  }, []);

  const clearPrefetchedMedia = useCallback(() => {
    setPrefetchedMedia((prev) => {
      Object.values(prev).forEach((entry) => {
        URL.revokeObjectURL(entry.objectUrl);
      });
      return {};
    });
  }, []);

  const getPrefetchedMedia = useCallback(
    (file: TestMediaFile | null | undefined): PrefetchedMediaEntry | undefined => {
      if (!file) return undefined;
      return prefetchedMedia[file.fileUrl];
    },
    [prefetchedMedia]
  );

  const loadSummaryAndTests = async (preserveSelection = true) => {
    setLoadingList(true);
    setError(null);
    try {
      const [summaryData, testsData] = await Promise.all([
        testService.getSummary(),
        testService.listTests({ archived: showArchivedTests }),
      ]);
      setSummary(summaryData);
      setTests(testsData);

      if (testsData.length === 0) {
        setSelectedTestId(null);
        setSelectedTest(null);
        return;
      }

      if (!preserveSelection || !selectedTestId) {
        setSelectedTestId(testsData[0].id);
      } else if (!testsData.some((item) => item.id === selectedTestId)) {
        setSelectedTestId(testsData[0].id);
      }
    } catch (loadError) {
      setError((loadError as Error).message || 'Ошибка загрузки тестов');
    } finally {
      setLoadingList(false);
    }
  };

  const loadTestDetail = async (testId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      clearPrefetchedMedia();
      const detail = await testService.getTestById(testId);
      setSelectedTest(detail);
      setSubmitResult(null);
      setTaking(false);
      setRuntimeAnswers({});
      setActiveStageIndex(0);
      setStartedAt(null);
      attemptSentRef.current = false;
      setReviewAttempt(null);
      setReviewDrafts({});
    } catch (detailError) {
      setError((detailError as Error).message || 'Ошибка загрузки деталей теста');
      setSelectedTest(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    void loadSummaryAndTests(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedTests]);

  useEffect(() => {
    if (selectedTestId) {
      void loadTestDetail(selectedTestId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestId]);

  useEffect(() => {
    if (!createOpen || !canEditTests) return;
    if (audience) return;

    const loadAudience = async () => {
      setLoadingAudience(true);
      try {
        const data = await testService.getAudienceOptions();
        setAudience(data);
      } catch {
        setError('Не удалось загрузить список пользователей и отделений');
      } finally {
        setLoadingAudience(false);
      }
    };

    void loadAudience();
  }, [createOpen, canEditTests, audience]);

  useEffect(() => {
    return () => {
      clearPrefetchedMedia();
    };
  }, [clearPrefetchedMedia]);

  const autoSubmitAttempt = useCallback(
    (keepalive = false) => {
      if (!takingRef.current || attemptSentRef.current) {
        return;
      }

      const currentTest = selectedTestRef.current;
      if (!currentTest) {
        return;
      }

      attemptSentRef.current = true;
      const payload = buildSubmitPayload();

      if (keepalive) {
        const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
        void fetch(`${apiBase}/tests/${currentTest.id}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          keepalive: true,
          credentials: 'include',
        });
        return;
      }

      setAutoSubmitting(true);
      void testService.submitAttempt(currentTest.id, payload)
        .finally(() => {
          setAutoSubmitting(false);
        });
    },
    [buildSubmitPayload]
  );

  useEffect(() => {
    if (!taking) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      autoSubmitAttempt(true);
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [taking, autoSubmitAttempt]);

  useEffect(() => {
    return () => {
      autoSubmitAttempt(true);
    };
  }, [autoSubmitAttempt]);

  const openCreateDialog = () => {
    setCreateForm(buildInitialForm());
    setCreateOpen(true);
  };

  const addQuestion = () => {
    setCreateForm((prev) => ({
      ...prev,
      questions: [...prev.questions, buildEmptyQuestion(prev.questions.length)],
    }));
  };

  const removeQuestion = (localId: string) => {
    setCreateForm((prev) => {
      const next = prev.questions.filter((question) => question.localId !== localId);
      return {
        ...prev,
        questions: next.length > 0 ? next : [buildEmptyQuestion(0)],
      };
    });
  };

  const updateQuestion = (localId: string, updater: (question: QuestionDraft) => QuestionDraft) => {
    setCreateForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.localId === localId ? updater(question) : question
      ),
    }));
  };

  const uploadCommonMedia = async (files: FileList | null, onUploaded: (file: TestMediaFile) => void) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const uploaded = await testService.uploadFile(file);
      onUploaded(uploaded);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      const payload = toCreatePayload(createForm);
      await testService.createTest(payload);
      setCreateOpen(false);
      if (showArchivedTests) {
        setTestListMode('active');
        return;
      }
      await loadSummaryAndTests(false);
    } catch (createError) {
      setError((createError as Error).message || 'Не удалось создать тест');
    } finally {
      setCreating(false);
    }
  };

  const closeTestContextMenu = () => {
    setTestContextMenu(null);
  };

  const openTestContextMenu = (event: React.MouseEvent<HTMLElement>, test: TestListItem) => {
    if (!canEditTests) {
      return;
    }

    event.preventDefault();
    setSelectedTestId(test.id);
    setTestContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      test,
    });
  };

  const archiveTest = async () => {
    if (!testContextMenu) return;

    try {
      await testService.archiveTest(testContextMenu.test.id);
      closeTestContextMenu();
      await loadSummaryAndTests(false);
    } catch (archiveError) {
      setError((archiveError as Error).message || 'Не удалось перенести тест в архив');
    }
  };

  const restoreTest = async () => {
    if (!testContextMenu) return;

    try {
      await testService.restoreTest(testContextMenu.test.id);
      closeTestContextMenu();
      await loadSummaryAndTests(false);
    } catch (restoreError) {
      setError((restoreError as Error).message || 'Не удалось вернуть тест из архива');
    }
  };

  const deleteTest = async () => {
    if (!testContextMenu) return;

    const confirmed = window.confirm(`Удалить тест "${testContextMenu.test.title}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await testService.deleteTest(testContextMenu.test.id);
      closeTestContextMenu();
      await loadSummaryAndTests(false);
    } catch (deleteError) {
      setError((deleteError as Error).message || 'Не удалось удалить тест');
    }
  };

  const startTest = async () => {
    if (!selectedTest || preparingTest) return;
    const initialAnswers: Record<string, RuntimeAnswer> = {};

    for (const question of selectedTest.questions) {
      initialAnswers[question.id] = {
        questionId: question.id,
        optionIds: [],
        textAnswer: '',
      };
    }

    const filesToPrefetchMap = new Map<string, TestMediaFile>();
    for (const question of selectedTest.questions) {
      for (const file of question.media) {
        filesToPrefetchMap.set(file.fileUrl, file);
      }
      for (const option of question.options) {
        if (option.image) {
          filesToPrefetchMap.set(option.image.fileUrl, option.image);
        }
      }
    }

    const filesToPrefetch = Array.from(filesToPrefetchMap.values());
    const prefetched: Record<string, PrefetchedMediaEntry> = {};
    clearPrefetchedMedia();
    setPreparingTest(true);
    setPrepareProgress(filesToPrefetch.length === 0 ? 100 : 0);

    try {
      if (filesToPrefetch.length > 0) {
        let loadedCount = 0;
        for (const file of filesToPrefetch) {
          const sourceBlob = await testService.fetchMediaPreview(file.fileUrl);
          const blob = ensureBlobType(sourceBlob, file);
          const objectUrl = URL.createObjectURL(blob);
          const textContent = isTextFile(file) ? await decodeTextBlob(blob, file.mimeType) : null;
          const docxHtml = isDocxFile(file) ? await renderDocxToHtml(blob) : null;

          prefetched[file.fileUrl] = { objectUrl, textContent, docxHtml };
          loadedCount += 1;
          setPrepareProgress(Math.round((loadedCount / filesToPrefetch.length) * 100));
        }
      }

      setPrefetchedMedia(prefetched);
      setRuntimeAnswers(initialAnswers);
      setActiveStageIndex(0);
      setSubmitResult(null);
      setTaking(true);
      setStartedAt(Date.now());
      attemptSentRef.current = false;
    } catch (loadError) {
      Object.values(prefetched).forEach((entry) => {
        URL.revokeObjectURL(entry.objectUrl);
      });
      setError((loadError as Error).message || 'Не удалось подготовить файлы теста');
    } finally {
      setPreparingTest(false);
    }
  };

  const finishTest = async () => {
    if (!selectedTest) return;
    const payload = buildSubmitPayload();

    try {
      setSubmittingAttempt(true);
      attemptSentRef.current = true;
      const result = await testService.submitAttempt(selectedTest.id, payload);
      setSubmitResult(result);
      setTaking(false);
      clearPrefetchedMedia();
      setStartedAt(null);
      await loadSummaryAndTests(true);
      await loadTestDetail(selectedTest.id);
    } catch (submitError) {
      attemptSentRef.current = false;
      setError((submitError as Error).message || 'Ошибка отправки результатов теста');
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const updateRuntimeAnswer = (questionId: string, updater: (answer: RuntimeAnswer) => RuntimeAnswer) => {
    setRuntimeAnswers((prev) => ({
      ...prev,
      [questionId]: updater(prev[questionId] || { questionId, optionIds: [], textAnswer: '' }),
    }));
  };

  const openReviewAttempt = async (attemptId: string) => {
    try {
      setLoadingReview(true);
      const attempt = await testService.getAttempt(attemptId);
      setReviewAttempt(attempt);

      const manualAnswers = attempt.answers.filter((answer) => answer.questionType === 'text');
      const drafts: Record<string, ReviewDraft> = {};
      for (const answer of manualAnswers) {
        drafts[answer.questionId] = {
          questionId: answer.questionId,
          isCorrect: Boolean(answer.isCorrect),
          awardedPoints: typeof answer.awardedPoints === 'number' ? answer.awardedPoints : 0,
          comment: answer.reviewComment || '',
        };
      }
      setReviewDrafts(drafts);
      setReviewFeedback(attempt.feedback || '');
    } catch (reviewError) {
      setError((reviewError as Error).message || 'Не удалось открыть попытку для проверки');
    } finally {
      setLoadingReview(false);
    }
  };

  const saveManualReview = async () => {
    if (!reviewAttempt) return;

    const reviews = Object.values(reviewDrafts);
    if (reviews.length === 0) return;

    try {
      setSavingReview(true);
      await testService.reviewAttempt(reviewAttempt.id, {
        reviews,
        feedback: reviewFeedback,
      });

      if (selectedTest) {
        await loadTestDetail(selectedTest.id);
      }
      setReviewAttempt(null);
      setReviewDrafts({});
      setReviewFeedback('');
      await loadSummaryAndTests(true);
    } catch (reviewError) {
      setError((reviewError as Error).message || 'Не удалось сохранить ручную проверку');
    } finally {
      setSavingReview(false);
    }
  };

  const renderSummary = () => {
    const items = [
      {
        label: 'Назначено',
        value: summary?.assignedCount ?? 0,
        icon: <Quiz color="primary" />,
      },
      {
        label: 'Завершено',
        value: summary?.completedCount ?? 0,
        icon: <AssignmentTurnedIn color="success" />,
      },
      {
        label: 'Пройдено',
        value: summary?.passedCount ?? 0,
        icon: <CheckCircle color="success" />,
      },
      {
        label: 'Средний %',
        value: `${summary?.averagePercentage ?? 0}%`,
        icon: <Percent color="info" />,
      },
    ];

    return (
      <Card sx={testsSidebarCardSx}>
        <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
          <Typography variant="h6">Статистика</Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              columnGap: 2,
              rowGap: 1.5,
              mt: 1.75,
            }}
          >
            {items.map((item) => (
              <Stack
                key={item.label}
                sx={{
                  minWidth: 0,
                  pr: 0.5,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                    {item.label}
                  </Typography>
                  <Box sx={{ lineHeight: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }}>{item.icon}</Box>
                </Stack>
                <Typography variant="h4" sx={{ lineHeight: 1, mt: 0.5 }}>
                  {item.value}
                </Typography>
              </Stack>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderQuestionEditor = (question: QuestionDraft, index: number) => (
    <Card key={question.localId} variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Этап {index + 1}</Typography>
            <IconButton color="error" onClick={() => removeQuestion(question.localId)}>
              <Delete />
            </IconButton>
          </Stack>

          <TextField
            label="Название этапа"
            value={question.stageTitle}
            onChange={(event) => updateQuestion(question.localId, (row) => ({ ...row, stageTitle: event.target.value }))}
            fullWidth
          />

          <TextField
            label="Описание этапа"
            value={question.stageDescription}
            onChange={(event) => updateQuestion(question.localId, (row) => ({ ...row, stageDescription: event.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Формулировка вопроса"
              value={question.question}
              onChange={(event) => updateQuestion(question.localId, (row) => ({ ...row, question: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              select
              label="Тип вопроса"
              value={question.questionType}
              onChange={(event) =>
                updateQuestion(question.localId, (row) => ({
                  ...row,
                  questionType: event.target.value as TestQuestionType,
                  correctOptionIds: [],
                  acceptedAnswers: [],
                }))
              }
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="single">Один вариант</MenuItem>
              <MenuItem value="multiple">Несколько вариантов</MenuItem>
              <MenuItem value="text">Текстовый ответ</MenuItem>
            </TextField>

            <TextField
              label="Баллы"
              type="number"
              value={question.points}
              onChange={(event) =>
                updateQuestion(question.localId, (row) => ({ ...row, points: Math.max(1, Number(event.target.value) || 1) }))
              }
              sx={{ width: 120 }}
            />
          </Stack>

          <TextField
            label="Пояснение (опционально)"
            value={question.explanation}
            onChange={(event) => updateQuestion(question.localId, (row) => ({ ...row, explanation: event.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />

            <Stack spacing={1}>
              <Typography variant="subtitle2">Материалы этапа (документы/фото/видео)</Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<Upload />}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.onchange = () => {
                      void uploadCommonMedia(input.files, (file) => {
                        updateQuestion(question.localId, (row) => ({ ...row, media: [...row.media, file] }));
                      });
                    };
                    input.click();
                  }}
                >
                  Загрузить файлы
                </Button>
              </Stack>
            <Grid container spacing={1}>
              {question.media.map((file) => (
                <Grid key={file.id} size={{ xs: 12, sm: 6 }}>
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" noWrap>{file.fileName}</Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => updateQuestion(question.localId, (row) => ({ ...row, media: row.media.filter((item) => item.id !== file.id) }))}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Stack>

          {question.questionType !== 'text' ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Варианты ответов</Typography>
              {question.options.map((option) => {
                const selected = question.correctOptionIds.includes(option.id);
                return (
                  <Paper key={option.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {question.questionType === 'single' ? (
                          <Radio checked={selected} onChange={() => updateQuestion(question.localId, (row) => ({ ...row, correctOptionIds: [option.id] }))} />
                        ) : (
                          <Checkbox
                            checked={selected}
                            onChange={(_event, checked) =>
                              updateQuestion(question.localId, (row) => ({
                                ...row,
                                correctOptionIds: checked
                                  ? [...row.correctOptionIds, option.id]
                                  : row.correctOptionIds.filter((id) => id !== option.id),
                              }))
                            }
                          />
                        )}

                        <TextField
                          label="Текст варианта"
                          value={option.text}
                          onChange={(event) =>
                            updateQuestion(question.localId, (row) => ({
                              ...row,
                              options: row.options.map((item) =>
                                item.id === option.id ? { ...item, text: event.target.value } : item
                              ),
                            }))
                          }
                          fullWidth
                        />

                        <IconButton
                          color="error"
                          onClick={() =>
                            updateQuestion(question.localId, (row) => ({
                              ...row,
                              options: row.options.filter((item) => item.id !== option.id),
                              correctOptionIds: row.correctOptionIds.filter((id) => id !== option.id),
                            }))
                          }
                        >
                          <Delete />
                        </IconButton>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Image />}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.onchange = async () => {
                              const file = input.files?.[0];
                              if (!file) return;
                              const uploaded = await testService.uploadFile(file);
                              updateQuestion(question.localId, (row) => ({
                                ...row,
                                options: row.options.map((item) =>
                                  item.id === option.id ? { ...item, image: uploaded } : item
                                ),
                              }));
                            };
                            input.click();
                          }}
                        >
                          Медиа
                        </Button>

                        {option.image && (
                          <Button
                            size="small"
                            color="error"
                            onClick={() =>
                              updateQuestion(question.localId, (row) => ({
                                ...row,
                                options: row.options.map((item) =>
                                  item.id === option.id ? { ...item, image: null } : item
                                ),
                              }))
                            }
                          >
                            Убрать медиа
                          </Button>
                        )}
                      </Stack>

                      {option.image && (
                        <OptionMediaPreview file={option.image} />
                      )}
                    </Stack>
                  </Paper>
                );
              })}

              <Button
                variant="text"
                startIcon={<Add />}
                onClick={() =>
                  updateQuestion(question.localId, (row) => ({
                    ...row,
                    options: [...row.options, { id: makeId(), text: '', image: null }],
                  }))
                }
              >
                Добавить вариант
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={question.manualCheck}
                    onChange={(_event, checked) =>
                      updateQuestion(question.localId, (row) => ({ ...row, manualCheck: checked }))
                    }
                  />
                }
                label="Только ручная проверка"
              />

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Формулировка правильного ответа"
                  value={question.acceptedInput}
                  onChange={(event) =>
                    updateQuestion(question.localId, (row) => ({ ...row, acceptedInput: event.target.value }))
                  }
                  fullWidth
                />
                <Button
                  onClick={() =>
                    updateQuestion(question.localId, (row) => {
                      const value = row.acceptedInput.trim();
                      if (!value) return row;
                      return {
                        ...row,
                        acceptedAnswers: [...row.acceptedAnswers, value],
                        acceptedInput: '',
                      };
                    })
                  }
                >
                  Добавить
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {question.acceptedAnswers.map((answer, answerIndex) => (
                  <Chip
                    key={`${question.localId}-${answerIndex}`}
                    label={answer}
                    onDelete={() =>
                      updateQuestion(question.localId, (row) => ({
                        ...row,
                        acceptedAnswers: row.acceptedAnswers.filter((_, indexToDelete) => indexToDelete !== answerIndex),
                      }))
                    }
                  />
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '292px minmax(0, 1fr)', lg: '308px minmax(0, 1fr)' },
          gap: 1.25,
          alignItems: 'stretch',
        }}
      >
        <Stack spacing={2} sx={{ minHeight: 0, height: '100%' }}>
          {renderSummary()}

          <Card sx={{ ...testsSidebarCardSx, flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ pb: 1.5 }}>
              <Stack spacing={1.5}>
                <Stack direction="column" spacing={1}>
                  <Button
                    startIcon={<Refresh />}
                    onClick={() => void loadSummaryAndTests(true)}
                    variant="outlined"
                    fullWidth
                  >
                    Обновить
                  </Button>
                  {canEditTests && (
                    <Button startIcon={<Add />} onClick={openCreateDialog} variant="contained" fullWidth>
                      Новый тест
                    </Button>
                  )}
                </Stack>

                {canEditTests && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant={testListMode === 'active' ? 'contained' : 'outlined'}
                      onClick={() => setTestListMode('active')}
                      fullWidth
                    >
                      Активные
                    </Button>
                    <Button
                      size="small"
                      variant={testListMode === 'archive' ? 'contained' : 'outlined'}
                      onClick={() => setTestListMode('archive')}
                      fullWidth
                    >
                      Архив
                    </Button>
                  </Stack>
                )}

                <TextField
                  size="small"
                  fullWidth
                  placeholder="Поиск тестов..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
            </CardContent>
            <Divider />
            {loadingList ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <List sx={{ overflowY: 'auto', flexGrow: 1 }}>
                {filteredTests.map((test) => (
                  <ListItem key={test.id} disablePadding>
                    <ListItemButton
                      selected={selectedTestId === test.id}
                      onClick={() => setSelectedTestId(test.id)}
                      onContextMenu={(event) => openTestContextMenu(event, test)}
                      sx={{ borderRadius: 0 }}
                    >
                      <ListItemText
                        primary={test.title}
                        secondary={
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                            {test.latestAttempt ? (
                              <Chip
                                size="small"
                                label={`${test.latestAttempt.percentage}%`}
                                color={test.latestAttempt.isPassed ? 'success' : 'warning'}
                              />
                            ) : (
                              <Chip size="small" label="Не пройден" />
                            )}
                            {test.canEdit && <Chip size="small" label="Редактирование" color="primary" variant="outlined" />}
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}

                {filteredTests.length === 0 && (
                  <ListItem>
                    <ListItemText primary={showArchivedTests ? 'Архив пуст' : 'Тесты не найдены'} />
                  </ListItem>
                )}
              </List>
            )}
          </Card>
        </Stack>

        <Card sx={{ ...testsMainCardSx, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {loadingDetail ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            ) : !selectedTest ? (
              <Box sx={{ p: 4 }}>
                <Typography color="text.secondary">Выберите тест из списка.</Typography>
              </Box>
            ) : (
              <Box sx={{ p: 3, overflowY: 'auto', flexGrow: 1 }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="h5">{selectedTest.title}</Typography>
                      <Typography color="text.secondary">
                        {selectedTest.description || 'Описание отсутствует'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip label={`Этапов: ${selectedTest.questions.length}`} size="small" />
                        <Chip label={`Проходной: ${selectedTest.passingScore}%`} size="small" color="info" />
                        {selectedTest.timeLimit && <Chip label={`Лимит: ${selectedTest.timeLimit} мин`} size="small" />}
                        {selectedTest.maxAttempts && <Chip label={`Попыток: ${selectedTest.maxAttempts}`} size="small" />}
                      </Stack>
                    </Box>

                    {!taking && selectedTest.canTake && (
                      <Button
                        variant="contained"
                        startIcon={<PlayArrow />}
                        onClick={() => void startTest()}
                        disabled={!selectedTest.isPublished || preparingTest}
                      >
                        {preparingTest ? 'Подготовка...' : 'Начать тест'}
                      </Button>
                    )}
                  </Stack>

                  {taking && (
                    <Alert severity="info">
                      Режим прохождения активен. Тест открыт в полноэкранном окне.
                    </Alert>
                  )}

                  {selectedTest.isArchived && (
                    <Alert severity="info">
                      Тест находится в архиве и недоступен для прохождения сотрудниками.
                    </Alert>
                  )}

                  {submitResult && (
                    <Alert severity={submitResult.attempt.isPassed ? 'success' : submitResult.attempt.manualReviewRequired ? 'info' : 'warning'}>
                      <Stack spacing={1}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Результат: {submitResult.attempt.percentage}% ({submitResult.attempt.score}/{submitResult.attempt.maxScore})
                        </Typography>
                        {submitResult.attempt.manualReviewRequired ? (
                          <Typography>Есть текстовые ответы, ожидающие ручной проверки.</Typography>
                        ) : submitResult.attempt.isPassed ? (
                          <Typography>Тест пройден успешно.</Typography>
                        ) : (
                          <Typography>Тест не пройден. Можно повторить попытку.</Typography>
                        )}
                      </Stack>
                    </Alert>
                  )}

                  {!taking && selectedTest.myLatestAttempt && (
                    <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: 2 }}>
                      <Typography variant="subtitle1">Последняя попытка</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip label={`Статус: ${getAttemptStatusLabel(selectedTest.myLatestAttempt.status)}`} />
                        <Chip label={`Результат: ${selectedTest.myLatestAttempt.percentage}%`} color={selectedTest.myLatestAttempt.isPassed ? 'success' : 'warning'} />
                      </Stack>
                    </Paper>
                  )}

                  {selectedTest.canEdit && (
                    <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: 2 }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                        <Box>
                          <Typography variant="h6">Ручная проверка текстовых ответов</Typography>
                          <Typography color="text.secondary">
                            Выберите попытку со статусом ожидания для оценки текстовых ответов.
                          </Typography>
                        </Box>
                      </Stack>

                      <List dense>
                        {selectedTest.pendingManualAttempts.map((pending) => (
                          <ListItem
                            key={pending.id}
                            secondaryAction={
                              <Button
                                size="small"
                                startIcon={<Edit />}
                                onClick={() => void openReviewAttempt(pending.id)}
                              >
                                Проверить
                              </Button>
                            }
                          >
                            <ListItemAvatar>
                              <Avatar>{pending.user.firstName[0]}</Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={fullName(pending.user.firstName, pending.user.lastName, pending.user.middleName)}
                              secondary={pending.user.department?.name || 'Без отделения'}
                            />
                          </ListItem>
                        ))}

                        {selectedTest.pendingManualAttempts.length === 0 && (
                          <ListItem>
                            <ListItemText primary="Нет попыток, ожидающих ручной проверки." />
                          </ListItem>
                        )}
                      </List>
                    </Paper>
                  )}
                </Stack>
              </Box>
            )}
        </Card>
      </Box>

      <Menu
        open={Boolean(testContextMenu)}
        onClose={closeTestContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          testContextMenu
            ? { top: testContextMenu.mouseY, left: testContextMenu.mouseX }
            : undefined
        }
      >
        {showArchivedTests ? (
          <MenuItem onClick={() => void restoreTest()}>
            <Unarchive fontSize="small" sx={{ mr: 1 }} />
            Вернуть из архива
          </MenuItem>
        ) : (
          <MenuItem onClick={() => void archiveTest()}>
            <Archive fontSize="small" sx={{ mr: 1 }} />
            Перенести в архив
          </MenuItem>
        )}
        <MenuItem onClick={() => void deleteTest()} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Удалить
        </MenuItem>
      </Menu>

      <Dialog open={preparingTest} maxWidth="sm" fullWidth>
        <DialogContent sx={{ py: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Подождите, пока тестирование настраивается под Вас</Typography>
            <Typography color="text.secondary">
              Загружаем материалы этапов и вариантов ответа перед началом.
            </Typography>
            <LinearProgress variant="determinate" value={prepareProgress} />
            <Typography variant="caption" color="text.secondary">
              Готово: {prepareProgress}%
            </Typography>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={taking} fullScreen disableEscapeKeyDown>
        <DialogContent sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default' }}>
          {selectedTest && activeQuestion ? (
            <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
              <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: { xs: 2, md: 3 } }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="h5">{selectedTest.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Режим прохождения: окно нельзя закрыть без автосдачи.
                      </Typography>
                    </Box>
                    <Chip color="warning" icon={<Warning />} label="Выход = автосдача текущего прогресса" />
                  </Stack>

                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Этап {activeStageIndex + 1} из {selectedTest.questions.length}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={((activeStageIndex + 1) / Math.max(1, selectedTest.questions.length)) * 100}
                      sx={{ mt: 0.5, borderRadius: 99, height: 8 }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="h6">{activeQuestion.stageTitle || `Этап ${activeStageIndex + 1}`}</Typography>
                    {activeQuestion.stageDescription && (
                      <Typography color="text.secondary">{activeQuestion.stageDescription}</Typography>
                    )}
                  </Box>

                  <Typography variant="subtitle1" fontWeight={600}>
                    {activeQuestion.question}
                  </Typography>

                  {activeQuestion.media.length > 0 && (
                    <Grid container spacing={1}>
                      {activeQuestion.media.map((file) => (
                        <Grid key={file.id} size={{ xs: 12, md: 6 }}>
                          <FilePreview file={file} prefetched={getPrefetchedMedia(file)} />
                        </Grid>
                      ))}
                    </Grid>
                  )}

                  {activeQuestion.questionType === 'single' && (
                    <FormControl>
                      <FormLabel>Выберите один вариант</FormLabel>
                      <RadioGroup
                        value={runtimeAnswers[activeQuestion.id]?.optionIds?.[0] || ''}
                        onChange={(event) =>
                          updateRuntimeAnswer(activeQuestion.id, (answer) => ({
                            ...answer,
                            optionIds: [event.target.value],
                          }))
                        }
                      >
                        {activeQuestion.options.map((option) => (
                          <FormControlLabel
                            key={option.id}
                            value={option.id}
                            control={<Radio />}
                            label={
                              <Stack spacing={1} sx={{ py: 0.5 }}>
                                <Typography>{option.text}</Typography>
                                {option.image && <OptionMediaPreview file={option.image} prefetched={getPrefetchedMedia(option.image)} />}
                              </Stack>
                            }
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  )}

                  {activeQuestion.questionType === 'multiple' && (
                    <FormControl>
                      <FormLabel>Можно выбрать несколько вариантов</FormLabel>
                      <Stack>
                        {activeQuestion.options.map((option) => {
                          const checked = runtimeAnswers[activeQuestion.id]?.optionIds?.includes(option.id) || false;
                          return (
                            <FormControlLabel
                              key={option.id}
                              control={
                                <Checkbox
                                  checked={checked}
                                  onChange={(_event, nextChecked) =>
                                    updateRuntimeAnswer(activeQuestion.id, (answer) => ({
                                      ...answer,
                                      optionIds: nextChecked
                                        ? [...answer.optionIds, option.id]
                                        : answer.optionIds.filter((id) => id !== option.id),
                                    }))
                                  }
                                />
                              }
                              label={
                                <Stack spacing={1} sx={{ py: 0.5 }}>
                                  <Typography>{option.text}</Typography>
                                  {option.image && <OptionMediaPreview file={option.image} prefetched={getPrefetchedMedia(option.image)} />}
                                </Stack>
                              }
                            />
                          );
                        })}
                      </Stack>
                    </FormControl>
                  )}

                  {activeQuestion.questionType === 'text' && (
                    <TextField
                      label="Текстовый ответ"
                      value={runtimeAnswers[activeQuestion.id]?.textAnswer || ''}
                      onChange={(event) =>
                        updateRuntimeAnswer(activeQuestion.id, (answer) => ({
                          ...answer,
                          textAnswer: event.target.value,
                        }))
                      }
                      multiline
                      minRows={8}
                      fullWidth
                    />
                  )}

                  <Stack direction="row" justifyContent="space-between">
                    <Button
                      variant="outlined"
                      disabled={activeStageIndex === 0 || submittingAttempt}
                      onClick={() => setActiveStageIndex((prev) => Math.max(0, prev - 1))}
                    >
                      Назад
                    </Button>

                    {activeStageIndex < selectedTest.questions.length - 1 ? (
                      <Button variant="contained" onClick={() => setActiveStageIndex((prev) => prev + 1)} disabled={submittingAttempt}>
                        Далее
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<Send />}
                        onClick={() => void finishTest()}
                        disabled={submittingAttempt}
                      >
                        {submittingAttempt ? 'Отправка...' : 'Завершить тест'}
                      </Button>
                    )}
                  </Stack>

                  {autoSubmitting && (
                    <Alert severity="info">Сохраняем прогресс теста...</Alert>
                  )}
                </Stack>
              </Paper>
            </Box>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Новый тест</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Название"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Проходной балл (%)"
                type="number"
                value={createForm.passingScore}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    passingScore: Math.min(100, Math.max(1, Number(event.target.value) || 1)),
                  }))
                }
                sx={{ width: 220 }}
              />
            </Stack>

            <TextField
              label="Описание"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={createForm.assignToAll}
                  onChange={(_event, checked) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      assignToAll: checked,
                      assignedUserIds: checked ? [] : prev.assignedUserIds,
                      assignedDepartmentIds: checked ? [] : prev.assignedDepartmentIds,
                    }))
                  }
                />
              }
              label="Назначить всем пользователям"
            />

            {!createForm.assignToAll && (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Autocomplete
                  multiple
                  options={audience?.users || []}
                  loading={loadingAudience}
                  getOptionLabel={(option) => fullName(option.firstName, option.lastName, option.middleName)}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={(audience?.users || []).filter((user) => createForm.assignedUserIds.includes(user.id))}
                  onChange={(_event, value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      assignedUserIds: value.map((user) => user.id),
                    }))
                  }
                  renderInput={(params) => <TextField {...params} label="Пользователи" />}
                  sx={{ flex: 1 }}
                />

                <Autocomplete
                  multiple
                  options={audience?.departments || []}
                  loading={loadingAudience}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={(audience?.departments || []).filter((department) => createForm.assignedDepartmentIds.includes(department.id))}
                  onChange={(_event, value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      assignedDepartmentIds: value.map((department) => department.id),
                    }))
                  }
                  renderInput={(params) => <TextField {...params} label="Отделения" />}
                  sx={{ flex: 1 }}
                />
              </Stack>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Лимит времени (мин, пусто = без лимита)"
                value={createForm.timeLimit}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, timeLimit: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Макс. попыток (пусто = без лимита)"
                value={createForm.maxAttempts}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, maxAttempts: event.target.value }))}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControlLabel
                control={<Switch checked={createForm.shuffleQuestions} onChange={(_event, checked) => setCreateForm((prev) => ({ ...prev, shuffleQuestions: checked }))} />}
                label="Перемешивать этапы"
              />
              <FormControlLabel
                control={<Switch checked={createForm.showResults} onChange={(_event, checked) => setCreateForm((prev) => ({ ...prev, showResults: checked }))} />}
                label="Показывать результат после прохождения"
              />
              <FormControlLabel
                control={<Switch checked={createForm.showCorrectAnswers} onChange={(_event, checked) => setCreateForm((prev) => ({ ...prev, showCorrectAnswers: checked }))} />}
                label="Показывать правильные/неправильные ответы"
              />
              <FormControlLabel
                control={<Switch checked={createForm.isPublished} onChange={(_event, checked) => setCreateForm((prev) => ({ ...prev, isPublished: checked }))} />}
                label="Опубликовать сразу"
              />
            </Stack>

            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Этапы теста</Typography>
              <Button startIcon={<Add />} onClick={addQuestion}>
                Добавить этап
              </Button>
            </Stack>

            {createForm.questions.map((question, index) => renderQuestionEditor(question, index))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => void handleCreate()}
            disabled={creating || createForm.title.trim().length === 0}
          >
            {creating ? 'Сохранение...' : 'Создать тест'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(reviewAttempt)} onClose={() => setReviewAttempt(null)} maxWidth="md" fullWidth>
        <DialogTitle>Ручная проверка текстовых ответов</DialogTitle>
        <DialogContent dividers>
          {loadingReview || !reviewAttempt ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2}>
              {reviewAttempt.answers
                .filter((answer) => answer.questionType === 'text')
                .map((answer) => {
                  const draft = reviewDrafts[answer.questionId];
                  if (!draft) return null;

                  return (
                    <Paper key={answer.questionId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle1" fontWeight={600}>{answer.question}</Typography>
                        <Typography variant="body2" color="text.secondary">Ответ сотрудника: {answer.userTextAnswer || '—'}</Typography>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={draft.isCorrect}
                                onChange={(_event, checked) =>
                                  setReviewDrafts((prev) => ({
                                    ...prev,
                                    [answer.questionId]: {
                                      ...prev[answer.questionId],
                                      isCorrect: checked,
                                      awardedPoints: checked ? answer.points : 0,
                                    },
                                  }))
                                }
                              />
                            }
                            label="Ответ верный"
                          />

                          <TextField
                            type="number"
                            label="Баллы"
                            value={draft.awardedPoints}
                            onChange={(event) =>
                              setReviewDrafts((prev) => ({
                                ...prev,
                                [answer.questionId]: {
                                  ...prev[answer.questionId],
                                  awardedPoints: Math.min(answer.points, Math.max(0, Number(event.target.value) || 0)),
                                },
                              }))
                            }
                            sx={{ width: 160 }}
                          />
                        </Stack>

                        <TextField
                          label="Комментарий"
                          value={draft.comment}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [answer.questionId]: {
                                ...prev[answer.questionId],
                                comment: event.target.value,
                              },
                            }))
                          }
                          multiline
                          minRows={2}
                          fullWidth
                        />
                      </Stack>
                    </Paper>
                  );
                })}

              <TextField
                label="Общий комментарий"
                value={reviewFeedback}
                onChange={(event) => setReviewFeedback(event.target.value)}
                multiline
                minRows={3}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewAttempt(null)}>Закрыть</Button>
          <Button variant="contained" onClick={() => void saveManualReview()} disabled={savingReview || loadingReview} startIcon={<CheckCircle />}>
            {savingReview ? 'Сохраняем...' : 'Сохранить проверку'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TestsPage;
