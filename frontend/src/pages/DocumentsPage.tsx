import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Apartment,
  Add,
  CheckCircle,
  CloudDownload,
  Delete,
  DoneAll,
  FindInPage,
  Groups2,
  InfoOutlined,
  MarkEmailRead,
  PendingActions,
  PersonOutline,
  Refresh,
  Search,
  Send,
  TaskAlt,
  Topic,
  Upload,
  Visibility,
  Warning,
} from '@mui/icons-material';
import { documentService } from '../services';
import { useAuthStore, useHasPermission } from '../store/authStore';
import { shellInnerPanelSx, shellInsetSurfaceSx, shellPanelSx } from '../styles/shell';
import type {
  DocumentAudienceOptions,
  DocumentDistributionType,
  DocumentThreadDetail,
  DocumentThreadFile,
  DocumentThreadMode,
  DocumentThreadRecipientDetails,
  DocumentThreadStatus,
  DocumentThreadSummary,
  DocumentUploadedFile,
} from '../types';

interface CreateThreadFormState {
  title: string;
  description: string;
  mode: DocumentThreadMode;
  distributionType: DocumentDistributionType;
  requiresReadReceipt: boolean;
  recipientIds: string[];
  departmentIds: string[];
  groupIds: string[];
  files: DocumentUploadedFile[];
}

interface CreateGroupFormState {
  name: string;
  description: string;
  memberIds: string[];
}

interface DocumentVersionGroup {
  version: number;
  files: DocumentThreadFile[];
  isActive: boolean;
  createdAt: string;
}

function getStatusLabel(status: DocumentThreadStatus): string {
  if (status === 'completed') return 'Завершен';
  if (status === 'in_progress') return 'На согласовании';
  if (status === 'changes_requested') return 'Есть возражения';
  return 'Новый';
}

function getStatusColor(status: DocumentThreadStatus): 'default' | 'success' | 'warning' | 'info' | 'error' {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'info';
  if (status === 'changes_requested') return 'warning';
  return 'default';
}

function getModeLabel(mode: DocumentThreadMode): string {
  if (mode === 'approval') return 'Согласование';
  if (mode === 'read_receipt') return 'С уведомлением';
  return 'Простая рассылка';
}

function getDistributionLabel(type: DocumentDistributionType): string {
  if (type === 'all') return 'Всем сотрудникам';
  if (type === 'departments') return 'По отделениям';
  if (type === 'groups') return 'Групповая рассылка';
  return 'Индивидуально';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

function isTextPreviewable(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase();
  if (mimeType.startsWith('text/')) return true;
  if (mimeType.includes('json') || mimeType.includes('xml')) return true;
  return (
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    lowerName.endsWith('.log')
  );
}

function isTablePreviewable(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase();
  return mimeType.includes('csv') || lowerName.endsWith('.csv') || lowerName.endsWith('.tsv');
}

function isPdfFile(file: DocumentThreadFile): boolean {
  return file.mimeType.toLowerCase().includes('pdf') || getFileExtension(file.fileName) === 'pdf';
}

function isDocxFile(file: DocumentThreadFile): boolean {
  const ext = getFileExtension(file.fileName);
  const mime = file.mimeType.toLowerCase();
  return ext === 'docx' || mime.includes('wordprocessingml.document');
}

function isDocFile(file: DocumentThreadFile): boolean {
  const ext = getFileExtension(file.fileName);
  return ext === 'doc' || file.mimeType.toLowerCase() === 'application/msword';
}

function ensureBlobType(blob: Blob, file: DocumentThreadFile): Blob {
  if (blob.type) return blob;
  if (file.mimeType) return new Blob([blob], { type: file.mimeType });
  return blob;
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

async function decodeTextBlob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);

  if (!utf8.includes('\uFFFD')) {
    return utf8;
  }

  try {
    return new TextDecoder('windows-1251', { fatal: false }).decode(arrayBuffer);
  } catch {
    return utf8;
  }
}

function parseDelimited(text: string): string[][] {
  const separator = text.includes('\t') ? '\t' : ',';
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(separator));
}

const initialThreadForm: CreateThreadFormState = {
  title: '',
  description: '',
  mode: 'distribution',
  distributionType: 'individual',
  requiresReadReceipt: false,
  recipientIds: [],
  departmentIds: [],
  groupIds: [],
  files: [],
};

const initialGroupForm: CreateGroupFormState = {
  name: '',
  description: '',
  memberIds: [],
};

const emptyAudienceOptions: DocumentAudienceOptions = {
  users: [],
  departments: [],
  groups: [],
};

interface DocumentFilePreviewProps {
  threadId: string;
  file: DocumentThreadFile;
  onDownload: (file: DocumentThreadFile) => Promise<void>;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU');
}

function formatPersonName(person: { firstName: string; lastName: string; middleName?: string | null }): string {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
}

function getActionLabel(action: string): string {
  if (action === 'created') return 'Тред создан';
  if (action === 'approved') return 'Согласовано';
  if (action === 'changes_requested') return 'Запрошены изменения';
  if (action === 'resubmitted') return 'Повторно отправлен';
  if (action === 'files_updated') return 'Обновлены файлы';
  if (action === 'file_removed') return 'Файл удален';
  return action;
}

function getThreadAttention(
  thread: DocumentThreadSummary,
  currentUserId?: string | null
): { label: string; color: 'info' | 'warning' } | null {
  if (thread.mode === 'approval' && thread.myRecipient && !thread.myRecipient.decision) {
    return { label: 'Нужно решение', color: 'warning' };
  }

  if (thread.myRecipient && !thread.myRecipient.isRead) {
    return { label: 'Не прочитан', color: 'info' };
  }

  if (thread.status === 'changes_requested' && thread.createdBy.id === currentUserId) {
    return { label: 'Нужна доработка', color: 'warning' };
  }

  return null;
}

function getRecipientStateMeta(
  recipient: DocumentThreadRecipientDetails,
  mode: DocumentThreadMode
): { label: string; color: 'default' | 'success' | 'warning' | 'info' } {
  if (mode === 'approval') {
    if (recipient.decision === 'approved') return { label: 'Согласовал', color: 'success' };
    if (recipient.decision === 'changes_requested') return { label: 'Возражение', color: 'warning' };
    return { label: 'Ожидает решения', color: 'default' };
  }

  if (recipient.isRead) {
    return { label: 'Прочитал', color: 'success' };
  }

  return { label: 'Не прочитал', color: 'info' };
}

function getFileBadge(fileName: string): string {
  const parts = fileName.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  if (!ext) return 'FILE';
  return ext.toUpperCase().slice(0, 4);
}

const DocumentFilePreview: React.FC<DocumentFilePreviewProps> = ({ threadId, file, onDownload }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<string[][]>([]);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  useEffect(() => {
    let urlToRevoke: string | null = null;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      setPreviewUrl(null);
      setTextContent(null);
      setTableRows([]);
      setDocxHtml(null);

      try {
        const sourceBlob = await documentService.fetchPreviewBlob(threadId, file.id);
        const blob = ensureBlobType(sourceBlob, file);

        if (isDocxFile(file)) {
          const html = await renderDocxToHtml(blob);
          setDocxHtml(html);
        }

        if (isTextPreviewable(file.fileName, file.mimeType)) {
          const text = await decodeTextBlob(blob);
          if (isTablePreviewable(file.fileName, file.mimeType)) {
            setTableRows(parseDelimited(text));
          } else {
            setTextContent(text);
          }
        }

        const objectUrl = URL.createObjectURL(blob);
        urlToRevoke = objectUrl;
        setPreviewUrl(objectUrl);
      } catch (previewError) {
        console.error('Document preview error:', previewError);
        setError('Не удалось отобразить файл. Доступно скачивание.');
      } finally {
        setLoading(false);
      }
    };

    void loadPreview();

    return () => {
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [threadId, file]);

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isPdf = isPdfFile(file);

  if (loading) {
    return <LinearProgress />;
  }

  if (error) {
    return (
      <Alert
        severity="info"
        action={
          <Button size="small" variant="outlined" onClick={() => void onDownload(file)}>
            Скачать
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (isDocxFile(file) && docxHtml) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 1.5,
          bgcolor: '#fff',
          maxHeight: '78vh',
          overflow: 'auto',
          '& p': { mt: 0, mb: 1.4 },
          '& *': { maxWidth: '100%' },
        }}
        dangerouslySetInnerHTML={{ __html: docxHtml }}
      />
    );
  }

  if (tableRows.length > 0) {
    const header = tableRows[0];
    const body = tableRows.slice(1, 200);

    return (
      <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Box sx={{ minWidth: 560 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${header.length}, minmax(120px, 1fr))`, bgcolor: 'grey.100' }}>
            {header.map((cell, index) => (
              <Box key={`header-${index}`} sx={{ p: 1, borderBottom: 1, borderColor: 'divider', fontWeight: 600 }}>
                <Typography variant="caption">{cell}</Typography>
              </Box>
            ))}
          </Box>

          {body.map((row, rowIndex) => (
            <Box
              key={`row-${rowIndex}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${header.length}, minmax(120px, 1fr))`,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              {row.map((cell, cellIndex) => (
                <Box key={`cell-${rowIndex}-${cellIndex}`} sx={{ p: 1 }}>
                  <Typography variant="caption">{cell}</Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (textContent !== null) {
    return (
      <Paper variant="outlined" sx={{ p: 2, maxHeight: 420, overflow: 'auto', bgcolor: '#fafafa' }}>
        <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
          {textContent}
        </Typography>
      </Paper>
    );
  }

  if (isImage && previewUrl) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: '#fafafa', borderRadius: 1, p: 1 }}>
        <Box
          component="img"
          src={previewUrl}
          alt={file.fileName}
          sx={{
            maxWidth: '100%',
            maxHeight: 420,
            objectFit: 'contain',
            borderRadius: 1,
          }}
        />
      </Box>
    );
  }

  if (isVideo && previewUrl) {
    return (
      <Box sx={{ bgcolor: '#111', borderRadius: 1, p: 1 }}>
        <Box component="video" src={previewUrl} controls sx={{ width: '100%', maxHeight: '78vh' }} />
      </Box>
    );
  }

  if (isPdf && previewUrl) {
    return (
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, height: '78vh', overflow: 'hidden', bgcolor: '#fff' }}>
        <iframe src={previewUrl} title={file.fileName} width="100%" height="100%" style={{ border: 0 }} />
      </Box>
    );
  }

  if (isDocFile(file)) {
    return <Alert severity="info">Для файлов DOC встроенный предпросмотр ограничен. Используйте скачивание.</Alert>;
  }

  return (
    <Alert
      severity="info"
      action={
        <Button size="small" variant="outlined" onClick={() => void onDownload(file)}>
          Скачать
        </Button>
      }
    >
      Предпросмотр для этого формата недоступен, но файл можно скачать.
    </Alert>
  );
};

const DocumentsPage: React.FC = () => {
  const theme = useTheme();
  const isCompactLayout = useMediaQuery(theme.breakpoints.down('md'));
  const user = useAuthStore((state) => state.user);
  const canManageDocuments = useHasPermission('documents.edit');

  const [threads, setThreads] = useState<DocumentThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<DocumentThreadDetail | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [metadataFile, setMetadataFile] = useState<DocumentThreadFile | null>(null);
  const [previewFile, setPreviewFile] = useState<DocumentThreadFile | null>(null);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [audienceOptions, setAudienceOptions] = useState<DocumentAudienceOptions>(emptyAudienceOptions);

  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchValue, setSearchValue] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateThreadFormState>(initialThreadForm);

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<CreateGroupFormState>(initialGroupForm);

  const [decisionComment, setDecisionComment] = useState('');
  const [filtersTouched, setFiltersTouched] = useState(false);

  const versionGroups = useMemo<DocumentVersionGroup[]>(() => {
    if (!selectedThread) return [];

    const grouped = new Map<number, DocumentThreadFile[]>();
    for (const file of selectedThread.files) {
      const list = grouped.get(file.version) ?? [];
      list.push(file);
      grouped.set(file.version, list);
    }

    return [...grouped.entries()]
      .map(([version, files]) => ({
        version,
        files: [...files].sort((a, b) => a.fileName.localeCompare(b.fileName)),
        isActive: files.some((file) => file.isActive),
        createdAt: files.reduce((latest, current) => (latest > current.createdAt ? latest : current.createdAt), files[0]?.createdAt ?? ''),
      }))
      .sort((a, b) => b.version - a.version);
  }, [selectedThread]);

  const selectedVersionGroup = useMemo(() => {
    if (selectedVersion === null) return null;
    return versionGroups.find((group) => group.version === selectedVersion) ?? null;
  }, [selectedVersion, versionGroups]);

  const canDeleteFile = (file: DocumentThreadFile): boolean => {
    const fileVersionGroup = versionGroups.find((group) => group.version === file.version);
    return Boolean(fileVersionGroup?.isActive && file.isActive);
  };

  const selectedUsers = useMemo(
    () => audienceOptions.users.filter((candidate) => createForm.recipientIds.includes(candidate.id)),
    [audienceOptions.users, createForm.recipientIds]
  );

  const selectedDepartments = useMemo(
    () => audienceOptions.departments.filter((candidate) => createForm.departmentIds.includes(candidate.id)),
    [audienceOptions.departments, createForm.departmentIds]
  );

  const selectedGroups = useMemo(
    () => audienceOptions.groups.filter((candidate) => createForm.groupIds.includes(candidate.id)),
    [audienceOptions.groups, createForm.groupIds]
  );

  const groupMembers = useMemo(
    () => audienceOptions.users.filter((candidate) => groupForm.memberIds.includes(candidate.id)),
    [audienceOptions.users, groupForm.memberIds]
  );

  const myRecipientState = selectedThread?.recipients.find((recipient) => recipient.user.id === user?.id) ?? null;
  const canResubmit =
    canManageDocuments &&
    selectedThread?.mode === 'approval' &&
    selectedThread.status === 'changes_requested' &&
    selectedThread.createdBy.id === user?.id;
  const canApprove = selectedThread?.mode === 'approval' && Boolean(myRecipientState) && !myRecipientState?.decision;
  const hasActiveFilters = Boolean(searchValue.trim() || modeFilter || statusFilter);

  const loadMetadata = async () => {
    if (!canManageDocuments) {
      setAudienceOptions(emptyAudienceOptions);
      return;
    }

    try {
      const audience = await documentService.getAudienceOptions();
      setAudienceOptions(audience);
    } catch (error) {
      console.error('Load document metadata failed:', error);
      setErrorMessage('Не удалось загрузить справочники модуля документов');
    }
  };

  const loadThreads = async () => {
    setIsListLoading(true);

    try {
      const data = await documentService.getThreads({
        q: searchValue.trim() || undefined,
        mode: modeFilter || undefined,
        status: statusFilter || undefined,
      });

      setThreads(data);

      if (data.length === 0) {
        setSelectedThreadId(null);
        setSelectedThread(null);
        setSelectedVersion(null);
        setMetadataFile(null);
        setPreviewFile(null);
        setMetadataOpen(false);
        setPreviewOpen(false);
        return;
      }

      if (!selectedThreadId || !data.some((thread) => thread.id === selectedThreadId)) {
        setSelectedThreadId(data[0].id);
      }
    } catch (error) {
      console.error('Load document threads failed:', error);
      setErrorMessage('Не удалось загрузить список тредов документов');
    } finally {
      setIsListLoading(false);
    }
  };

  const loadThreadDetail = async (threadId: string) => {
    setIsDetailsLoading(true);

    try {
      const detail = await documentService.getThreadById(threadId);
      setSelectedThread(detail);
    } catch (error) {
      console.error('Load document thread details failed:', error);
      setErrorMessage('Не удалось загрузить детали выбранного треда');
    } finally {
      setIsDetailsLoading(false);
    }
  };

  useEffect(() => {
    void loadMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageDocuments]);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => {
        void loadThreads();
      },
      searchValue.trim() ? 260 : 0
    );

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue, modeFilter, statusFilter]);

  useEffect(() => {
    if (selectedThreadId) {
      void loadThreadDetail(selectedThreadId);
    }
  }, [selectedThreadId]);

  useEffect(() => {
    if (versionGroups.length === 0) {
      if (selectedVersion !== null) setSelectedVersion(null);
      return;
    }

    const defaultGroup = versionGroups.find((group) => group.isActive) ?? versionGroups[0];
    const hasSelectedVersion = selectedVersion !== null && versionGroups.some((group) => group.version === selectedVersion);
    const nextVersion = hasSelectedVersion ? selectedVersion : defaultGroup.version;

    if (nextVersion !== selectedVersion) {
      setSelectedVersion(nextVersion);
    }
  }, [selectedVersion, versionGroups]);

  const refreshAll = async () => {
    setErrorMessage(null);
    await Promise.all([loadThreads(), canManageDocuments ? loadMetadata() : Promise.resolve()]);
    if (selectedThreadId) {
      await loadThreadDetail(selectedThreadId);
    }
  };

  const clearFilters = () => {
    setSearchValue('');
    setModeFilter('');
    setStatusFilter('');
    setFiltersTouched(false);
  };

  const handleCreateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsSaving(true);

    try {
      const uploaded: DocumentUploadedFile[] = [];
      for (const file of Array.from(fileList)) {
        // Sequential upload to keep predictable order of versions.
        const result = await documentService.uploadFile(file);
        uploaded.push(result);
      }

      setCreateForm((prev) => ({
        ...prev,
        files: [...prev.files, ...uploaded],
      }));
    } catch (error) {
      console.error('Upload create-thread files failed:', error);
      setErrorMessage('Ошибка загрузки файлов для нового треда');
    } finally {
      setIsSaving(false);
      event.target.value = '';
    }
  };

  const handleCreateThread = async () => {
    if (!createForm.title.trim()) {
      setErrorMessage('Укажите название треда документов');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const created = await documentService.createThread({
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        mode: createForm.mode,
        distributionType: createForm.distributionType,
        requiresReadReceipt: createForm.mode === 'distribution' ? createForm.requiresReadReceipt : undefined,
        recipientIds: createForm.distributionType === 'individual' ? createForm.recipientIds : undefined,
        departmentIds: createForm.distributionType === 'departments' ? createForm.departmentIds : undefined,
        groupIds: createForm.distributionType === 'groups' ? createForm.groupIds : undefined,
        files: createForm.files.map((file) => ({
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
        })),
      });

      setCreateDialogOpen(false);
      setCreateForm(initialThreadForm);
      await loadThreads();
      setSelectedThreadId(created.id);
    } catch (error) {
      console.error('Create document thread failed:', error);
      setErrorMessage('Не удалось создать тред документов');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupForm.name.trim()) {
      setErrorMessage('Название группы обязательно');
      return;
    }

    if (groupForm.memberIds.length === 0) {
      setErrorMessage('Добавьте хотя бы одного участника в группу');
      return;
    }

    setIsSaving(true);

    try {
      const createdGroup = await documentService.createGroup({
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || undefined,
        memberIds: groupForm.memberIds,
      });

      const updatedGroups = [...audienceOptions.groups, createdGroup].sort((a, b) => a.name.localeCompare(b.name));
      setAudienceOptions((prev) => ({
        ...prev,
        groups: updatedGroups,
      }));

      setCreateForm((prev) => ({
        ...prev,
        groupIds: [...new Set([...prev.groupIds, createdGroup.id])],
      }));

      setGroupDialogOpen(false);
      setGroupForm(initialGroupForm);
    } catch (error) {
      console.error('Create recipient group failed:', error);
      setErrorMessage('Не удалось создать группу рассылки');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkRead = async () => {
    if (!selectedThreadId) return;

    setIsSaving(true);

    try {
      const updated = await documentService.markAsRead(selectedThreadId);
      setSelectedThread(updated);
      await loadThreads();
    } catch (error) {
      console.error('Mark thread read failed:', error);
      setErrorMessage('Не удалось отметить тред как прочитанный');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDecision = async (decision: 'approved' | 'changes_requested') => {
    if (!selectedThreadId) return;

    setIsSaving(true);

    try {
      const updated = await documentService.submitDecision(selectedThreadId, decision, decisionComment.trim() || undefined);
      setSelectedThread(updated);
      setDecisionComment('');
      await loadThreads();
    } catch (error) {
      console.error('Submit document decision failed:', error);
      setErrorMessage('Не удалось сохранить решение согласования');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResubmit = async () => {
    if (!selectedThreadId) return;

    setIsSaving(true);

    try {
      const updated = await documentService.resubmit(selectedThreadId, decisionComment.trim() || undefined);
      setSelectedThread(updated);
      setDecisionComment('');
      await loadThreads();
    } catch (error) {
      console.error('Resubmit document thread failed:', error);
      setErrorMessage('Не удалось отправить тред на повторное согласование');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThreadFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedThreadId) return;

    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsSaving(true);

    try {
      const uploaded: DocumentUploadedFile[] = [];
      for (const file of Array.from(fileList)) {
        // Sequential upload to keep versions in same order as selected.
        const result = await documentService.uploadFile(file);
        uploaded.push(result);
      }

      const updated = await documentService.addFiles(
        selectedThreadId,
        uploaded.map((item) => ({
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          fileSize: item.fileSize,
          mimeType: item.mimeType,
        }))
      );

      setSelectedThread(updated);
      await loadThreads();
    } catch (error) {
      console.error('Upload thread files failed:', error);
      setErrorMessage('Не удалось добавить файлы в тред');
    } finally {
      setIsSaving(false);
      event.target.value = '';
    }
  };

  const handleDeleteFile = async (file: DocumentThreadFile) => {
    if (!selectedThreadId) return;

    const confirmed = window.confirm(`Удалить файл ${file.fileName} из активной версии?`);
    if (!confirmed) return;

    setIsSaving(true);

    try {
      const updated = await documentService.deleteFile(selectedThreadId, file.id);
      setSelectedThread(updated);
      await loadThreads();
    } catch (error) {
      console.error('Delete thread file failed:', error);
      setErrorMessage('Не удалось удалить файл из треда');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadFile = async (file: DocumentThreadFile) => {
    if (!selectedThreadId) return;

    try {
      const blob = await documentService.fetchDownloadBlob(selectedThreadId, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download thread file failed:', error);
      setErrorMessage('Не удалось скачать файл');
    }
  };

  const openMetadataDialog = (file: DocumentThreadFile) => {
    setMetadataFile(file);
    setMetadataOpen(true);
  };

  const openPreviewDialog = (file: DocumentThreadFile) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const handleMetadataDelete = async () => {
    if (!metadataFile || !canDeleteFile(metadataFile)) return;
    await handleDeleteFile(metadataFile);
    setMetadataOpen(false);
    setMetadataFile(null);
  };

  const renderThreadList = () => {
    if (isListLoading) {
      return (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
          <CircularProgress size={24} />
        </Stack>
      );
    }

    if (threads.length === 0) {
      return (
        <Box sx={{ p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Ничего не найдено
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {canManageDocuments
              ? 'Измените фильтры или создайте первый тред документов.'
              : 'Измените фильтры или дождитесь новых входящих документов.'}
          </Typography>
        </Box>
      );
    }

    return (
      <List disablePadding>
        {threads.map((thread) => (
          <ListItem key={thread.id} disablePadding sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <ListItemButton
              selected={thread.id === selectedThreadId}
              onClick={() => setSelectedThreadId(thread.id)}
              sx={{
                px: 1.75,
                py: 1.5,
                borderRadius: 0,
                alignItems: 'flex-start',
              }}
            >
              <ListItemAvatar sx={{ minWidth: 42, mt: 0.25 }}>
                <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 12 }}>
                  {thread.createdBy.lastName[0]}
                </Avatar>
              </ListItemAvatar>

              <ListItemText
                disableTypography
                primary={
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={0.8} alignItems="flex-start" justifyContent="space-between">
                      <Typography
                        variant="subtitle2"
                        sx={{
                          minWidth: 0,
                          flexGrow: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.35,
                          pr: 0.5,
                        }}
                      >
                        {thread.title}
                      </Typography>
                      <Chip size="small" color={getStatusColor(thread.status)} label={getStatusLabel(thread.status)} />
                    </Stack>

                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Chip size="small" variant="outlined" label={getModeLabel(thread.mode)} />
                      {getThreadAttention(thread, user?.id) && (
                        <Chip
                          size="small"
                          color={getThreadAttention(thread, user?.id)?.color}
                          label={getThreadAttention(thread, user?.id)?.label}
                        />
                      )}
                      {thread.isCompleted && <Chip size="small" color="success" icon={<DoneAll />} label="Закрыт" />}
                    </Stack>
                  </Stack>
                }
                secondary={
                  <Stack spacing={0.55} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {thread.recipientStats.total} получ. • {thread.activeFileCount} акт. файлов
                    </Typography>
                    {thread.latestActiveFile && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Последний файл: {thread.latestActiveFile.fileName}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Обновлен {formatDateTime(thread.updatedAt)}
                    </Typography>
                  </Stack>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        overflow: { xs: 'auto', lg: 'hidden' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        pb: { xs: 2, lg: 0 },
      }}
    >
      {errorMessage && (
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 380px) minmax(0, 1fr)' },
          flexGrow: 1,
          minHeight: 0,
          gap: 1.5,
          alignItems: 'stretch',
        }}
      >
        <Paper
          sx={{
            ...shellPanelSx,
            width: '100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            maxHeight: { xs: '46vh', lg: 'none' },
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 1.5, display: 'grid', gap: 1.1 }}>
            <TextField
              size="small"
              value={searchValue}
              onChange={(event) => {
                setFiltersTouched(true);
                setSearchValue(event.target.value);
              }}
              placeholder="Поиск по названию и описанию"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                select
                fullWidth
                value={modeFilter}
                onChange={(event) => {
                  setFiltersTouched(true);
                  setModeFilter(event.target.value);
                }}
                label="Режим"
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="distribution">Рассылка</MenuItem>
                <MenuItem value="read_receipt">Уведомление о прочтении</MenuItem>
                <MenuItem value="approval">Согласование</MenuItem>
              </TextField>

              <TextField
                size="small"
                select
                fullWidth
                value={statusFilter}
                onChange={(event) => {
                  setFiltersTouched(true);
                  setStatusFilter(event.target.value);
                }}
                label="Статус"
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="new">Новый</MenuItem>
                <MenuItem value="in_progress">На согласовании</MenuItem>
                <MenuItem value="changes_requested">Есть возражения</MenuItem>
                <MenuItem value="completed">Завершен</MenuItem>
              </TextField>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button size="small" variant="outlined" startIcon={<FindInPage />} onClick={() => void loadThreads()}>
                Применить фильтры
              </Button>
              {hasActiveFilters && (
                <Button size="small" color="inherit" onClick={clearFilters}>
                  Очистить
                </Button>
              )}
              <Chip
                size="small"
                variant="outlined"
                icon={<Topic />}
                label={`${threads.length} тред${threads.length === 1 ? '' : threads.length < 5 ? 'а' : 'ов'}`}
                sx={{ ml: { sm: 'auto' }, alignSelf: { xs: 'flex-start', sm: 'center' } }}
              />
            </Stack>
            {filtersTouched && (
              <Typography variant="caption" color="text.secondary">
                Список обновляется автоматически при изменении поиска и фильтров.
              </Typography>
            )}
          </Box>

          <Divider />

          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>{renderThreadList()}</Box>
        </Paper>

        <Paper
          sx={{
            ...shellPanelSx,
            flexGrow: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.4, borderBottom: 1, borderColor: 'divider' }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Typography component="h1" variant="h6" sx={{ fontWeight: 700 }}>
                  Документы
                </Typography>
                <Chip
                  size="small"
                  color={canManageDocuments ? 'primary' : 'default'}
                  icon={canManageDocuments ? <Topic /> : <TaskAlt />}
                  label={canManageDocuments ? 'Режим редактора' : 'Мои входящие документы'}
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => void refreshAll()}
                  disabled={isSaving || isListLoading || isDetailsLoading}
                >
                  Обновить
                </Button>
                {canManageDocuments && (
                  <Button variant="contained" startIcon={<Add />} onClick={() => setCreateDialogOpen(true)}>
                    Новый тред
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>

          {isDetailsLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }} spacing={1}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Загружается тред документов...
              </Typography>
            </Stack>
          ) : !selectedThread ? (
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', px: 2 }} spacing={2}>
              <Typography variant="h6">Выберите тред документов</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 580 }}>
                Выберите тред слева. Здесь появятся статусы, адресаты, версии файлов и история действий.
              </Typography>
            </Stack>
          ) : (
            <>
              <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}>
                <Stack
                  direction={{ xs: 'column', lg: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'stretch', lg: 'flex-start' }}
                  spacing={1.5}
                >
                  <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                    <Typography variant="h6" sx={{ mb: 0.5, wordBreak: 'break-word' }}>
                      {selectedThread.title}
                    </Typography>
                    {selectedThread.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedThread.description}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} useFlexGap flexWrap="wrap">
                      <Chip size="small" color={getStatusColor(selectedThread.status)} label={getStatusLabel(selectedThread.status)} />
                      <Chip size="small" label={getModeLabel(selectedThread.mode)} />
                      <Chip size="small" label={getDistributionLabel(selectedThread.distributionType)} />
                      {selectedThread.isCompleted && <Chip size="small" color="success" icon={<DoneAll />} label="Тред завершен" />}
                      {myRecipientState && !myRecipientState.isRead && (
                        <Chip size="small" color="info" icon={<MarkEmailRead />} label="Требует прочтения" />
                      )}
                      {selectedThread.mode === 'approval' && myRecipientState && !myRecipientState.decision && (
                        <Chip size="small" color="warning" icon={<PendingActions />} label="Ждет вашего решения" />
                      )}
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.2, display: 'block' }}>
                      Создал: {formatPersonName(selectedThread.createdBy)} • {formatDateTime(selectedThread.createdAt)}
                    </Typography>

                    <Stack direction="row" spacing={0.75} sx={{ mt: 1.4 }} useFlexGap flexWrap="wrap">
                      {selectedThread.distributionType === 'all' && <Chip size="small" icon={<Groups2 />} label="Вся организация" />}
                      {selectedThread.departments.map((department) => (
                        <Chip key={department.id} size="small" variant="outlined" icon={<Apartment />} label={department.name} />
                      ))}
                      {selectedThread.groups.map((group) => (
                        <Chip key={group.id} size="small" variant="outlined" icon={<Groups2 />} label={`${group.name} (${group.memberCount})`} />
                      ))}
                      {selectedThread.distributionType === 'individual' &&
                        selectedThread.recipients.slice(0, 4).map((recipient) => (
                          <Chip
                            key={recipient.id}
                            size="small"
                            variant="outlined"
                            icon={<PersonOutline />}
                            label={formatPersonName(recipient.user)}
                          />
                        ))}
                      {selectedThread.distributionType === 'individual' && selectedThread.recipients.length > 4 && (
                        <Chip size="small" variant="outlined" label={`Еще ${selectedThread.recipients.length - 4}`} />
                      )}
                    </Stack>
                  </Box>

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 0.75,
                      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(120px, 1fr))' },
                      minWidth: { lg: 320 },
                      flex: { lg: '0 1 420px' },
                    }}
                  >
                    <Box sx={{ ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                      <Typography variant="caption" color="text.secondary">
                        Получатели
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {selectedThread.recipientStats.total}
                      </Typography>
                    </Box>
                    <Box sx={{ ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                      <Typography variant="caption" color="text.secondary">
                        Прочитали
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {selectedThread.recipientStats.read}
                      </Typography>
                    </Box>
                    <Box sx={{ ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                      <Typography variant="caption" color="text.secondary">
                        Версий
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {versionGroups.length}
                      </Typography>
                    </Box>
                    <Box sx={{ ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                      <Typography variant="caption" color="text.secondary">
                        Активных файлов
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {selectedThread.activeFileCount}
                      </Typography>
                    </Box>
                    {selectedThread.mode === 'approval' && (
                      <>
                        <Box sx={{ ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                          <Typography variant="caption" color="text.secondary">
                            Согласовали
                          </Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {selectedThread.recipientStats.approved}
                          </Typography>
                        </Box>
                        <Box sx={{ ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                          <Typography variant="caption" color="text.secondary">
                            Возражения
                          </Typography>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {selectedThread.recipientStats.changesRequested}
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} spacing={1} sx={{ width: { xs: '100%', lg: 'auto' } }}>
                    {myRecipientState && !myRecipientState.isRead && (
                      <Button size="small" variant="outlined" startIcon={<CheckCircle />} onClick={() => void handleMarkRead()}>
                        Отметить прочтение
                      </Button>
                    )}

                    {canManageDocuments && (
                      <Button component="label" size="small" variant="outlined" startIcon={<Upload />} disabled={isSaving}>
                        Добавить файлы
                        <input hidden type="file" multiple onChange={(event) => void handleThreadFilesUpload(event)} />
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Box>

              {canApprove && (
                <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Ваше решение по согласованию
                  </Typography>

                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Комментарий (необязательно)"
                      value={decisionComment}
                      onChange={(event) => setDecisionComment(event.target.value)}
                    />
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircle />}
                      onClick={() => void handleDecision('approved')}
                      disabled={isSaving}
                    >
                      Согласовать
                    </Button>
                    <Button
                      variant="contained"
                      color="warning"
                      startIcon={<Warning />}
                      onClick={() => void handleDecision('changes_requested')}
                      disabled={isSaving}
                    >
                      Возражение
                    </Button>
                  </Stack>
                </Box>
              )}

              {canResubmit && (
                <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Комментарий к доработке (опционально)"
                      value={decisionComment}
                      onChange={(event) => setDecisionComment(event.target.value)}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<Send />}
                      onClick={() => void handleResubmit()}
                      disabled={isSaving}
                    >
                      На повторное согласование
                    </Button>
                  </Stack>
                </Box>
              )}

              <Box
                sx={{
                  flexGrow: 1,
                  minHeight: 0,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '280px minmax(0, 1fr)' },
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    borderRight: { lg: 1 },
                    borderBottom: { xs: 1, lg: 0 },
                    borderColor: 'divider',
                    overflow: 'auto',
                  }}
                >
                  <Box sx={{ px: 1.5, pt: 1.5 }}>
                    <Typography variant="subtitle2">Версии документа</Typography>
                  </Box>
                  <List
                    disablePadding
                    sx={{
                      display: { xs: 'flex', lg: 'block' },
                      overflowX: { xs: 'auto', lg: 'visible' },
                      overflowY: 'visible',
                    }}
                  >
                    {versionGroups.map((group) => (
                      <ListItem
                        key={group.version}
                        disablePadding
                        sx={{
                          width: { xs: 'auto', lg: 'auto' },
                          display: { xs: 'inline-flex', lg: 'flex' },
                          verticalAlign: 'top',
                          minWidth: { xs: 220, lg: 0 },
                        }}
                      >
                        <ListItemButton
                          data-testid={`document-version-${group.version}`}
                          selected={selectedVersion === group.version}
                          onClick={() => setSelectedVersion(group.version)}
                          sx={{
                            alignItems: 'flex-start',
                            py: 1.2,
                            px: 1.5,
                            borderBottom: { lg: 1 },
                            borderRight: { xs: 1, lg: 0 },
                            borderColor: 'divider',
                            borderRadius: 0,
                          }}
                        >
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  v{group.version}
                                </Typography>
                                <Chip
                                  size="small"
                                  color={group.isActive ? 'success' : 'default'}
                                  label={group.isActive ? 'Активная версия' : 'История'}
                                />
                              </Stack>
                            }
                            secondary={
                              <Stack spacing={0.3} sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Файлов: {group.files.length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDateTime(group.createdAt)}
                                </Typography>
                              </Stack>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                <Box sx={{ flexGrow: 1, p: { xs: 1.25, md: 1.5 }, overflow: 'auto' }}>
                  {selectedVersionGroup ? (
                    <>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.9 }} useFlexGap flexWrap="wrap">
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Версия v{selectedVersionGroup.version}
                        </Typography>
                        <Chip
                          size="small"
                          color={selectedVersionGroup.isActive ? 'success' : 'default'}
                          label={selectedVersionGroup.isActive ? 'Текущая' : 'Историческая'}
                        />
                      </Stack>

                      <Stack spacing={0.85} sx={{ mb: 1.35 }}>
                        {selectedVersionGroup.files.map((file) => (
                          <Paper
                            key={file.id}
                            variant="outlined"
                            data-testid={`document-file-card-${file.id}`}
                            onClick={() => openMetadataDialog(file)}
                            sx={{
                              ...shellInnerPanelSx,
                              p: 1,
                              borderColor: metadataFile?.id === file.id && metadataOpen ? 'primary.main' : 'divider',
                              backgroundColor: metadataFile?.id === file.id && metadataOpen ? 'action.selected' : 'transparent',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: metadataFile?.id === file.id && metadataOpen ? 'action.selected' : 'action.hover',
                              },
                            }}
                          >
                            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.9} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
                              <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0 }}>
                                <Avatar
                                  variant="rounded"
                                  sx={{
                                    width: 34,
                                    height: 34,
                                    bgcolor: 'rgba(29, 122, 143, 0.12)',
                                    color: 'primary.dark',
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  {getFileBadge(file.fileName)}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.2 }}>
                                    {file.fileName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35, mt: 0.15 }}>
                                    {formatFileSize(file.fileSize)} • {file.mimeType} • {formatDateTime(file.createdAt)} • {formatPersonName(file.uploadedBy)}
                                  </Typography>
                                </Box>
                              </Stack>

                              <Stack direction="row" spacing={0.65} sx={{ flexShrink: 0 }} useFlexGap flexWrap="wrap">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<InfoOutlined />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openMetadataDialog(file);
                                  }}
                                >
                                  Подробнее
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  aria-label={`Предпросмотр ${file.fileName}`}
                                  startIcon={<Visibility />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openPreviewDialog(file);
                                  }}
                                >
                                  Открыть
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  aria-label={`Скачать ${file.fileName}`}
                                  startIcon={<CloudDownload />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDownloadFile(file);
                                  }}
                                >
                                  Скачать
                                </Button>
                                {canManageDocuments && selectedVersionGroup.isActive && file.isActive && (
                                  <Button
                                    size="small"
                                    color="error"
                                    aria-label={`Удалить ${file.fileName}`}
                                    startIcon={<Delete />}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDeleteFile(file);
                                    }}
                                  >
                                    Удалить
                                  </Button>
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>

                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1,
                          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.2fr) minmax(300px, 0.8fr)' },
                        }}
                      >
                        <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: 1.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
                            <Groups2 fontSize="small" color="action" />
                            <Typography variant="subtitle2">Статусы получателей</Typography>
                          </Stack>
                          <List dense disablePadding sx={{ maxHeight: 280, overflow: 'auto' }}>
                            {[...selectedThread.recipients]
                              .sort((a, b) => {
                                const priorityA =
                                  selectedThread.mode === 'approval' && !a.decision ? 0 : !a.isRead ? 1 : 2;
                                const priorityB =
                                  selectedThread.mode === 'approval' && !b.decision ? 0 : !b.isRead ? 1 : 2;
                                if (priorityA !== priorityB) return priorityA - priorityB;
                                return formatPersonName(a.user).localeCompare(formatPersonName(b.user), 'ru');
                              })
                              .map((recipient) => {
                                const statusMeta = getRecipientStateMeta(recipient, selectedThread.mode);
                                return (
                                  <ListItem key={recipient.id} disablePadding sx={{ py: 0.5 }}>
                                    <Box sx={{ width: '100%', ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                                      <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={0.75}
                                        justifyContent="space-between"
                                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                                      >
                                        <Box>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            {formatPersonName(recipient.user)}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {recipient.user.position || 'Сотрудник'}
                                            {recipient.user.department ? ` • ${recipient.user.department.name}` : ''}
                                          </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                          <Chip size="small" color={statusMeta.color} label={statusMeta.label} />
                                          {recipient.isRead && recipient.readAt && (
                                            <Chip size="small" variant="outlined" label={`Прочитал ${formatDateTime(recipient.readAt)}`} />
                                          )}
                                        </Stack>
                                      </Stack>
                                      {recipient.decisionComment && (
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: 'block' }}>
                                          Комментарий: {recipient.decisionComment}
                                        </Typography>
                                      )}
                                    </Box>
                                  </ListItem>
                                );
                              })}
                          </List>
                        </Paper>

                        <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: 1.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
                            <PendingActions fontSize="small" color="action" />
                            <Typography variant="subtitle2">История действий</Typography>
                          </Stack>
                          {selectedThread.actions.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              Действий по треду пока нет.
                            </Typography>
                          ) : (
                            <List dense disablePadding sx={{ maxHeight: 280, overflow: 'auto' }}>
                              {[...selectedThread.actions]
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                .map((action) => (
                                  <ListItem key={action.id} disablePadding sx={{ py: 0.5 }}>
                                    <Box sx={{ width: '100%', ...shellInsetSurfaceSx, px: 1.1, py: 0.9 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {getActionLabel(action.action)}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {formatPersonName(action.user)} • {formatDateTime(action.createdAt)}
                                      </Typography>
                                      {action.comment && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
                                          {action.comment}
                                        </Typography>
                                      )}
                                    </Box>
                                  </ListItem>
                                ))}
                            </List>
                          )}
                        </Paper>
                      </Box>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      В треде пока нет файлов.
                    </Typography>
                  )}
                </Box>
              </Box>
            </>
          )}
        </Paper>
      </Box>
 
      <Dialog open={metadataOpen} onClose={() => setMetadataOpen(false)} fullWidth maxWidth="sm" fullScreen={isCompactLayout}>
        <DialogTitle>Метаданные файла</DialogTitle>
        <DialogContent dividers>
          {metadataFile ? (
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {metadataFile.fileName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Размер: {formatFileSize(metadataFile.fileSize)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Тип: {metadataFile.mimeType}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Версия: v{metadataFile.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Загружен: {formatDateTime(metadataFile.createdAt)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Автор: {formatPersonName(metadataFile.uploadedBy)}
              </Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, py: 1.5 }}>
          <Button onClick={() => setMetadataOpen(false)} color="inherit">
            Закрыть
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            startIcon={<Visibility />}
            onClick={() => {
              if (!metadataFile) return;
              openPreviewDialog(metadataFile);
            }}
            disabled={!metadataFile}
          >
            Открыть
          </Button>
          <Button
            startIcon={<CloudDownload />}
            onClick={() => {
              if (!metadataFile) return;
              void handleDownloadFile(metadataFile);
            }}
            disabled={!metadataFile}
          >
            Скачать
          </Button>
          {canManageDocuments && (
            <Button
              color="error"
              startIcon={<Delete />}
              onClick={() => void handleMetadataDelete()}
              disabled={!metadataFile || !canDeleteFile(metadataFile)}
            >
              Удалить
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth={false}
        fullWidth
        fullScreen={isCompactLayout}
        PaperProps={{
          sx: {
            width: isCompactLayout ? '100%' : '96vw',
            maxWidth: isCompactLayout ? '100%' : '96vw',
            height: isCompactLayout ? '100%' : '92vh',
            maxHeight: isCompactLayout ? '100%' : '92vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap sx={{ maxWidth: '70vw' }}>
            {previewFile?.fileName || 'Предпросмотр файла'}
          </Typography>
          {previewFile && (
            <Button size="small" startIcon={<CloudDownload />} onClick={() => void handleDownloadFile(previewFile)}>
              Скачать
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          {previewFile && selectedThread ? (
            <DocumentFilePreview threadId={selectedThread.id} file={previewFile} onDownload={handleDownloadFile} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Файл не выбран.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="md" fullScreen={isCompactLayout}>
        <DialogTitle>Новый тред документов</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Название треда"
              value={createForm.title}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
              required
            />

            <TextField
              label="Описание"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                select
                label="Режим"
                value={createForm.mode}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    mode: event.target.value as DocumentThreadMode,
                  }))
                }
                fullWidth
              >
                <MenuItem value="distribution">Простая рассылка</MenuItem>
                <MenuItem value="read_receipt">Уведомление о прочтении</MenuItem>
                <MenuItem value="approval">Согласование</MenuItem>
              </TextField>

              <TextField
                select
                label="Адресация"
                value={createForm.distributionType}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    distributionType: event.target.value as DocumentDistributionType,
                  }))
                }
                fullWidth
              >
                <MenuItem value="all">Всем сотрудникам</MenuItem>
                <MenuItem value="departments">По отделениям</MenuItem>
                <MenuItem value="groups">Групповая рассылка</MenuItem>
                <MenuItem value="individual">Индивидуально</MenuItem>
              </TextField>
            </Stack>

            {createForm.mode === 'distribution' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.requiresReadReceipt}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        requiresReadReceipt: event.target.checked,
                      }))
                    }
                  />
                }
                label="Отслеживать уведомления о прочтении"
              />
            )}

            {createForm.distributionType === 'individual' && (
              <Autocomplete
                multiple
                options={audienceOptions.users}
                value={selectedUsers}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionLabel={(option) => `${option.lastName} ${option.firstName} (${option.email})`}
                onChange={(_event, value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    recipientIds: value.map((item) => item.id),
                  }))
                }
                renderInput={(params) => <TextField {...params} label="Получатели" placeholder="Выберите сотрудников" />}
              />
            )}

            {createForm.distributionType === 'departments' && (
              <Autocomplete
                multiple
                options={audienceOptions.departments}
                value={selectedDepartments}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                getOptionLabel={(option) => option.name}
                onChange={(_event, value) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    departmentIds: value.map((item) => item.id),
                  }))
                }
                renderInput={(params) => <TextField {...params} label="Отделения" placeholder="Выберите отделения" />}
              />
            )}

            {createForm.distributionType === 'groups' && (
              <Stack spacing={1}>
                <Autocomplete
                  multiple
                  options={audienceOptions.groups}
                  value={selectedGroups}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) => `${option.name} (${option.memberCount})`}
                  onChange={(_event, value) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      groupIds: value.map((item) => item.id),
                    }))
                  }
                  renderInput={(params) => <TextField {...params} label="Группы" placeholder="Выберите группы" />}
                />
                <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setGroupDialogOpen(true)}>
                  Создать новую группу
                </Button>
              </Stack>
            )}

            <Box>
              <Button component="label" variant="outlined" startIcon={<Upload />} disabled={isSaving}>
                Загрузить стартовые файлы
                <input hidden type="file" multiple onChange={(event) => void handleCreateUpload(event)} />
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>
                После создания треда каждое новое добавление файлов будет формировать отдельную версию.
              </Typography>

              <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
                {createForm.files.map((file, index) => (
                  <Chip
                    key={`${file.fileUrl}-${index}`}
                    label={`${file.fileName} (${formatFileSize(file.fileSize)})`}
                    onDelete={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        files: prev.files.filter((_candidate, candidateIndex) => candidateIndex !== index),
                      }))
                    }
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} color="inherit">
            Отмена
          </Button>
          <Button onClick={() => void handleCreateThread()} variant="contained" startIcon={<Send />} disabled={isSaving}>
            Создать тред
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} fullWidth maxWidth="sm" fullScreen={isCompactLayout}>
        <DialogTitle>Новая группа рассылки</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Название группы"
              value={groupForm.name}
              onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
              fullWidth
              required
            />

            <TextField
              label="Описание"
              value={groupForm.description}
              onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
            />

            <Autocomplete
              multiple
              options={audienceOptions.users}
              value={groupMembers}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionLabel={(option) => `${option.lastName} ${option.firstName} (${option.email})`}
              onChange={(_event, value) =>
                setGroupForm((prev) => ({
                  ...prev,
                  memberIds: value.map((item) => item.id),
                }))
              }
              renderInput={(params) => <TextField {...params} label="Участники группы" />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupDialogOpen(false)} color="inherit">
            Отмена
          </Button>
          <Button onClick={() => void handleCreateGroup()} variant="contained" startIcon={<Add />} disabled={isSaving}>
            Создать группу
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentsPage;
