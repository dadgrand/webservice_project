import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add,
  CloudDownload,
  Delete,
  Image,
  InsertDriveFile,
  MenuBook,
  PlayArrow,
  Refresh,
  Save,
  Search,
  SmartDisplay,
  Upload,
  Visibility,
  Warning,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { learningService } from '../services';
import { useHasPermission } from '../store/authStore';
import { PermissionCodes } from '../types';
import { shellInnerPanelSx } from '../styles/shell';
import type {
  CreateLearningMaterialRequest,
  LearningAudienceOptions,
  LearningFile,
  LearningMaterialDetail,
  LearningMaterialListItem,
  LearningMaterialType,
  LearningSummary,
} from '../types';

interface LearningPageDraft {
  localId: string;
  title: string;
  content: string;
  files: LearningFile[];
}

interface CreateFormState {
  title: string;
  description: string;
  materialType: LearningMaterialType;
  assignToAll: boolean;
  assignedUserIds: string[];
  assignedDepartmentIds: string[];
  expiresAt: string;
  isPublished: boolean;
  pages: LearningPageDraft[];
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

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

function isImage(file: LearningFile): boolean {
  return file.mimeType.startsWith('image/');
}

function isVideo(file: LearningFile): boolean {
  return file.mimeType.startsWith('video/');
}

function isPdfFile(file: LearningFile): boolean {
  return file.mimeType.toLowerCase().includes('pdf') || getFileExtension(file.fileName) === 'pdf';
}

function isDocxFile(file: LearningFile): boolean {
  const ext = getFileExtension(file.fileName);
  const mime = file.mimeType.toLowerCase();
  return ext === 'docx' || mime.includes('wordprocessingml.document');
}

function isTextFile(file: LearningFile): boolean {
  const name = file.fileName.toLowerCase();
  const mime = file.mimeType.toLowerCase();
  const byName =
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
  const byMime = mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('yaml');
  return byName || byMime;
}

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
      // Try next encoding
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

function ensureBlobType(blob: Blob, file: LearningFile): Blob {
  if (blob.type) return blob;
  if (file.mimeType) return new Blob([blob], { type: file.mimeType });
  return blob;
}

function buildInitialForm(): CreateFormState {
  return {
    title: '',
    description: '',
    materialType: 'single_page',
    assignToAll: false,
    assignedUserIds: [],
    assignedDepartmentIds: [],
    expiresAt: '',
    isPublished: true,
    pages: [
      {
        localId: makeId(),
        title: 'Материал',
        content: '',
        files: [],
      },
    ],
  };
}

function toPayload(form: CreateFormState): CreateLearningMaterialRequest {
  return {
    title: form.title,
    description: form.description || undefined,
    materialType: form.materialType,
    assignToAll: form.assignToAll,
    assignedUserIds: form.assignToAll ? [] : form.assignedUserIds,
    assignedDepartmentIds: form.assignToAll ? [] : form.assignedDepartmentIds,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    isPublished: form.isPublished,
    pages:
      form.materialType === 'single_page'
        ? [
            {
              title: form.pages[0]?.title || 'Материал',
              content: form.pages[0]?.content || '',
              order: 0,
              files: form.pages[0]?.files || [],
            },
          ]
        : form.pages.map((page, index) => ({
            title: page.title,
            content: page.content,
            order: index,
            files: page.files,
          })),
  };
}

const LearningFilePreview: React.FC<{ file: LearningFile }> = ({ file }) => {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setTextContent(null);
      setDocxHtml(null);
      try {
        const sourceBlob = await learningService.fetchFilePreview(file.fileUrl);
        const blob = ensureBlobType(sourceBlob, file);
        if (isTextFile(file)) {
          const text = await decodeTextBlob(blob, file.mimeType);
          if (mounted) setTextContent(text);
        }
        if (isDocxFile(file)) {
          const html = await renderDocxToHtml(blob);
          if (mounted) setDocxHtml(html);
        }
        objectUrl = URL.createObjectURL(blob);
        if (mounted) setUrl(objectUrl);
      } catch {
        if (mounted) setUrl(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const handleDownload = async () => {
    const blob = await learningService.fetchFileDownload(file.fileUrl);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = file.fileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  const isPdf = isPdfFile(file);
  const isDocx = isDocxFile(file);
  const isText = isTextFile(file);

  return (
    <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            {isImage(file) ? <Image color="action" /> : isVideo(file) ? <SmartDisplay color="action" /> : <InsertDriveFile color="action" />}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {file.fileName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(file.fileSize)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Полноэкранный просмотр">
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
            sx={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 1, bgcolor: 'grey.100', cursor: 'pointer' }}
            onClick={() => setViewerOpen(true)}
          />
        ) : url && isVideo(file) ? (
          <Box component="video" src={url} controls sx={{ width: '100%', borderRadius: 1, maxHeight: 220 }} />
        ) : isText && textContent !== null ? (
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'grey.100', maxHeight: 160, overflow: 'auto', cursor: 'pointer' }} onClick={() => setViewerOpen(true)}>
            <Typography component="pre" variant="body2" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              {textContent}
            </Typography>
          </Box>
        ) : isDocx && docxHtml ? (
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'grey.100', maxHeight: 180, overflow: 'auto', cursor: 'pointer', '& p': { mt: 0, mb: 1 } }} onClick={() => setViewerOpen(true)}>
            <Box sx={{ '& *': { maxWidth: '100%' } }} dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Для этого формата доступно скачивание и полноэкранный просмотр.
          </Typography>
        )}
      </Stack>

      <Dialog open={viewerOpen} onClose={() => setViewerOpen(false)} fullScreen>
        <DialogTitle>{file.fileName}</DialogTitle>
        <DialogContent dividers>
          {!url ? (
            <CircularProgress />
          ) : isImage(file) ? (
            <Box component="img" src={url} alt={file.fileName} sx={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', bgcolor: 'grey.100' }} />
          ) : isVideo(file) ? (
            <Box component="video" src={url} controls sx={{ width: '100%', maxHeight: '80vh' }} />
          ) : isText && textContent !== null ? (
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'grey.100', maxHeight: '80vh', overflow: 'auto' }}>
              <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {textContent}
              </Typography>
            </Box>
          ) : isDocx && docxHtml ? (
            <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'grey.100', maxHeight: '80vh', overflow: 'auto', '& p': { mt: 0, mb: 1.5 } }}>
              <Box sx={{ '& *': { maxWidth: '100%' } }} dangerouslySetInnerHTML={{ __html: docxHtml }} />
            </Box>
          ) : isPdf ? (
            <Box component="iframe" src={url} title={file.fileName} sx={{ width: '100%', height: '80vh', border: 0 }} />
          ) : (
            <Alert severity="info">Встроенный просмотр для этого формата ограничен. Используйте скачивание.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void handleDownload()} startIcon={<CloudDownload />}>
            Скачать
          </Button>
          <Button onClick={() => setViewerOpen(false)} variant="contained">
            Закрыть
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

const LearningPage: React.FC = () => {
  const canEditLearning = useHasPermission(PermissionCodes.LEARNING_EDIT);

  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [materials, setMaterials] = useState<LearningMaterialListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<LearningMaterialDetail | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [audience, setAudience] = useState<LearningAudienceOptions | null>(null);
  const [loadingAudience, setLoadingAudience] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(buildInitialForm);

  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return materials;
    return materials.filter((item) => item.title.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query));
  }, [materials, search]);

  const activePage = useMemo(() => {
    if (!selectedMaterial || selectedMaterial.pages.length === 0) return null;
    if (!selectedPageId) return selectedMaterial.pages[0];
    return selectedMaterial.pages.find((page) => page.id === selectedPageId) || selectedMaterial.pages[0];
  }, [selectedMaterial, selectedPageId]);

  const loadSummaryAndMaterials = async (preserveSelection = true) => {
    setLoadingList(true);
    setError(null);
    try {
      const [summaryData, listData] = await Promise.all([learningService.getSummary(), learningService.listMaterials()]);
      setSummary(summaryData);
      setMaterials(listData);

      if (listData.length === 0) {
        setSelectedId(null);
        setSelectedMaterial(null);
        return;
      }

      if (!preserveSelection || !selectedId) {
        setSelectedId(listData[0].id);
      } else if (!listData.some((item) => item.id === selectedId)) {
        setSelectedId(listData[0].id);
      }
    } catch (loadError) {
      setError((loadError as Error).message || 'Ошибка загрузки обучающих материалов');
    } finally {
      setLoadingList(false);
    }
  };

  const loadMaterialDetail = useCallback(async (materialId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await learningService.getMaterialById(materialId);
      setSelectedMaterial(detail);
      setSelectedPageId(detail.pages[0]?.id || null);

      if (detail.canOpen) {
        await learningService.markVisited(materialId);
      }
    } catch (detailError) {
      setError((detailError as Error).message || 'Ошибка загрузки материала');
      setSelectedMaterial(null);
      setSelectedPageId(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaryAndMaterials(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadMaterialDetail(selectedId);
    }
  }, [selectedId, loadMaterialDetail]);

  useEffect(() => {
    if (!createOpen || !canEditLearning || audience) return;

    const loadAudience = async () => {
      setLoadingAudience(true);
      try {
        const options = await learningService.getAudienceOptions();
        setAudience(options);
      } catch {
        setError('Не удалось загрузить аудиторию');
      } finally {
        setLoadingAudience(false);
      }
    };

    void loadAudience();
  }, [createOpen, canEditLearning, audience]);

  const handleCreateOpen = () => {
    setCreateForm(buildInitialForm());
    setCreateOpen(true);
  };

  const updatePage = (localId: string, updater: (page: LearningPageDraft) => LearningPageDraft) => {
    setCreateForm((prev) => ({
      ...prev,
      pages: prev.pages.map((page) => (page.localId === localId ? updater(page) : page)),
    }));
  };

  const addPage = () => {
    setCreateForm((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          localId: makeId(),
          title: `Страница ${prev.pages.length + 1}`,
          content: '',
          files: [],
        },
      ],
    }));
  };

  const removePage = (localId: string) => {
    setCreateForm((prev) => {
      const next = prev.pages.filter((page) => page.localId !== localId);
      return {
        ...prev,
        pages: next.length > 0 ? next : prev.pages,
      };
    });
  };

  const uploadFilesForPage = async (localId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const uploaded = await learningService.uploadFile(file);
      updatePage(localId, (page) => ({ ...page, files: [...page.files, uploaded] }));
    }
  };

  const handleCreateMaterial = async () => {
    try {
      setCreating(true);
      await learningService.createMaterial(toPayload(createForm));
      setCreateOpen(false);
      await loadSummaryAndMaterials(false);
    } catch (createError) {
      setError((createError as Error).message || 'Не удалось создать материал');
    } finally {
      setCreating(false);
    }
  };

  const renderSummary = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary">Назначено</Typography>
                <Typography variant="h4">{summary?.assignedCount ?? 0}</Typography>
              </Box>
              <MenuBook color="primary" />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary">Просмотрено</Typography>
                <Typography variant="h4">{summary?.viewedCount ?? 0}</Typography>
              </Box>
              <PlayArrow color="success" />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary">Просрочено</Typography>
                <Typography variant="h4">{summary?.expiredCount ?? 0}</Typography>
              </Box>
              <Warning color="warning" />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="body2" color="text.secondary">Доступно</Typography>
                <Typography variant="h4">{summary?.totalAvailable ?? 0}</Typography>
              </Box>
              <Visibility color="info" />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderPageEditor = (page: LearningPageDraft, index: number) => (
    <Card key={page.localId} variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Страница {index + 1}</Typography>
            {createForm.materialType === 'multi_page' && (
              <IconButton color="error" onClick={() => removePage(page.localId)}>
                <Delete />
              </IconButton>
            )}
          </Stack>

          <TextField
            label="Заголовок страницы"
            value={page.title}
            onChange={(event) => updatePage(page.localId, (row) => ({ ...row, title: event.target.value }))}
            fullWidth
          />

          <TextField
            label="Текст / контент страницы"
            value={page.content}
            onChange={(event) => updatePage(page.localId, (row) => ({ ...row, content: event.target.value }))}
            fullWidth
            multiline
            minRows={6}
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Файлы страницы</Typography>
            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = () => {
                  void uploadFilesForPage(page.localId, input.files);
                };
                input.click();
              }}
            >
              Загрузить файлы
            </Button>

            <Grid container spacing={1}>
              {page.files.map((file) => (
                <Grid key={file.id} size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Typography variant="body2" noWrap>{file.fileName}</Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => updatePage(page.localId, (row) => ({ ...row, files: row.files.filter((item) => item.id !== file.id) }))}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(file.fileSize)}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Обучение</Typography>
          <Typography color="text.secondary">
            Материалы с назначением на сотрудников и отделения, сроком действия и просмотром медиа/файлов.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={() => void loadSummaryAndMaterials(true)}>
            Обновить
          </Button>
          {canEditLearning && (
            <Button startIcon={<Add />} variant="contained" onClick={handleCreateOpen}>
              Новый материал
            </Button>
          )}
        </Stack>
      </Stack>

      {renderSummary()}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
        <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ minHeight: 0 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ pb: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Поиск материалов..."
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
            </CardContent>
            <Divider />
            {loadingList ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
                {filteredMaterials.map((item) => (
                  <Button
                    key={item.id}
                    fullWidth
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      py: 1.5,
                      px: 2,
                      borderRadius: 0,
                      borderLeft: selectedId === item.id ? '4px solid' : '4px solid transparent',
                      borderColor: selectedId === item.id ? 'primary.main' : 'transparent',
                    }}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <Box sx={{ textAlign: 'left', width: '100%' }}>
                      <Typography variant="body1" fontWeight={600} noWrap>
                        {item.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} useFlexGap flexWrap="wrap">
                        <Chip size="small" label={item.materialType === 'single_page' ? 'Одна страница' : `${item.pageCount} стр.`} />
                        {item.isExpired && <Chip size="small" color="warning" label="Срок истек" />}
                        {!item.canOpen && !item.isExpired && <Chip size="small" color="default" label="Нет доступа" />}
                      </Stack>
                    </Box>
                  </Button>
                ))}

                {filteredMaterials.length === 0 && (
                  <Box sx={{ p: 2 }}>
                    <Typography color="text.secondary">Материалы не найдены</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8, lg: 9 }} sx={{ minHeight: 0 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {loadingDetail ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            ) : !selectedMaterial ? (
              <Box sx={{ p: 4 }}>
                <Typography color="text.secondary">Выберите материал из списка.</Typography>
              </Box>
            ) : (
              <Box sx={{ p: 3, overflowY: 'auto', flexGrow: 1 }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="h5">{selectedMaterial.title}</Typography>
                      <Typography color="text.secondary">
                        {selectedMaterial.description || 'Описание отсутствует'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
                        <Chip label={selectedMaterial.materialType === 'single_page' ? 'Одна страница' : 'Многостраничный'} size="small" />
                        <Chip label={`Страниц: ${selectedMaterial.pages.length}`} size="small" />
                        {selectedMaterial.expiresAt && (
                          <Chip
                            size="small"
                            color={selectedMaterial.isExpired ? 'warning' : 'default'}
                            label={`Действует до: ${format(new Date(selectedMaterial.expiresAt), 'd MMM yyyy, HH:mm', { locale: ru })}`}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Stack>

                  {!selectedMaterial.canOpen && (
                    <Alert severity="warning">
                      Материал сейчас недоступен для просмотра (возможно, срок действия истек или материал не назначен).
                    </Alert>
                  )}

                  {selectedMaterial.canOpen && selectedMaterial.pages.length > 0 && (
                    <>
                      <Tabs
                        value={activePage?.id || false}
                        onChange={(_event, value) => {
                          setSelectedPageId(value);
                          if (selectedMaterial.canOpen) {
                            void learningService.markVisited(selectedMaterial.id, String(value));
                          }
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                      >
                        {selectedMaterial.pages.map((page) => (
                          <Tab key={page.id} value={page.id} label={page.title} />
                        ))}
                      </Tabs>

                      {activePage && (
                        <Paper variant="outlined" sx={{ ...shellInnerPanelSx, p: 2 }}>
                          <Stack spacing={2}>
                            <Typography variant="h6">{activePage.title}</Typography>
                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                              {activePage.content || 'Без текстового контента'}
                            </Typography>

                            {activePage.files.length > 0 && (
                              <Grid container spacing={1}>
                                {activePage.files.map((file) => (
                                  <Grid key={file.id} size={{ xs: 12, md: 6 }}>
                                    <LearningFilePreview file={file} />
                                  </Grid>
                                ))}
                              </Grid>
                            )}
                          </Stack>
                        </Paper>
                      )}
                    </>
                  )}
                </Stack>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Новый обучающий материал</DialogTitle>
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
                select
                label="Тип материала"
                value={createForm.materialType}
                onChange={(event) =>
                  setCreateForm((prev) => {
                    const nextType = event.target.value as LearningMaterialType;
                    if (nextType === 'single_page') {
                      return {
                        ...prev,
                        materialType: nextType,
                        pages: [prev.pages[0] || { localId: makeId(), title: 'Материал', content: '', files: [] }],
                      };
                    }
                    return {
                      ...prev,
                      materialType: nextType,
                      pages: prev.pages.length > 0 ? prev.pages : [{ localId: makeId(), title: 'Страница 1', content: '', files: [] }],
                    };
                  })
                }
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="single_page">Одна страница</MenuItem>
                <MenuItem value="multi_page">Многостраничный</MenuItem>
              </TextField>
            </Stack>

            <TextField
              label="Описание"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Срок действия до"
                type="datetime-local"
                value={createForm.expiresAt}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={createForm.isPublished}
                    onChange={(_event, checked) => setCreateForm((prev) => ({ ...prev, isPublished: checked }))}
                  />
                }
                label="Опубликовать сразу"
              />
            </Stack>

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
                  onChange={(_event, value) => setCreateForm((prev) => ({ ...prev, assignedUserIds: value.map((item) => item.id) }))}
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
                  onChange={(_event, value) => setCreateForm((prev) => ({ ...prev, assignedDepartmentIds: value.map((item) => item.id) }))}
                  renderInput={(params) => <TextField {...params} label="Отделения" />}
                  sx={{ flex: 1 }}
                />
              </Stack>
            )}

            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Страницы материала</Typography>
              {createForm.materialType === 'multi_page' && (
                <Button startIcon={<Add />} onClick={addPage}>
                  Добавить страницу
                </Button>
              )}
            </Stack>

            {createForm.pages.map((page, index) => renderPageEditor(page, index))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            disabled={creating || createForm.title.trim().length === 0}
            onClick={() => void handleCreateMaterial()}
          >
            {creating ? 'Сохранение...' : 'Создать материал'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LearningPage;
