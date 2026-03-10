import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Add,
  ChevronLeft,
  ChevronRight,
  Close,
  CloudDownload,
  Delete,
  Description,
  Edit,
  PictureAsPdf,
  PushPin,
  Search,
  SmartDisplay,
  Visibility,
} from '@mui/icons-material';
import { newsService } from '../../services';
import RichTextEditor from '../messages/compose/RichTextEditor';
import type { NewsItem, NewsMediaFile } from '../../types';
import { PermissionCodes } from '../../types';
import { useHasPermission } from '../../store/authStore';
import { shellEmptyStateSx, shellInnerPanelSx, shellPanelSx } from '../../styles/shell';

interface NewsFormState {
  title: string;
  content: string;
  isPinned: boolean;
  media: NewsMediaFile[];
}

const FILE_ACCEPT =
  'image/*,video/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const mediaCache = new Map<string, string>();

function formatPublishTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function fullName(author: NewsItem['author']): string {
  return `${author.lastName} ${author.firstName}${author.middleName ? ` ${author.middleName}` : ''}`;
}

function normalizeMediaOrder(media: NewsMediaFile[]): NewsMediaFile[] {
  return media.map((item, index) => ({ ...item, order: index }));
}

function buildEmptyForm(): NewsFormState {
  return {
    title: '',
    content: '',
    isPinned: false,
    media: [],
  };
}

function toPayload(form: NewsFormState) {
  return {
    title: form.title.trim(),
    content: form.content,
    isPinned: form.isPinned,
    media: normalizeMediaOrder(form.media),
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExcerpt(value: string, maxLength = 150): string {
  const plain = stripHtml(value);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength).trim()}...`;
}

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : '';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function isImageFile(file: NewsMediaFile): boolean {
  return file.mimeType.startsWith('image/');
}

function isVideoFile(file: NewsMediaFile): boolean {
  return file.mimeType.startsWith('video/');
}

function isPdfFile(file: NewsMediaFile): boolean {
  return file.mimeType.toLowerCase().includes('pdf') || getFileExtension(file.fileName) === 'pdf';
}

function isDocxFile(file: NewsMediaFile): boolean {
  const ext = getFileExtension(file.fileName);
  const mime = file.mimeType.toLowerCase();
  return ext === 'docx' || mime.includes('wordprocessingml.document');
}

function isDocFile(file: NewsMediaFile): boolean {
  const ext = getFileExtension(file.fileName);
  return ext === 'doc' || file.mimeType.toLowerCase() === 'application/msword';
}

function ensureBlobType(blob: Blob, file: NewsMediaFile): Blob {
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

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function fileIcon(file: NewsMediaFile) {
  if (isVideoFile(file)) {
    return <SmartDisplay fontSize="small" />;
  }
  if (isPdfFile(file)) {
    return <PictureAsPdf fontSize="small" />;
  }
  return <Description fontSize="small" />;
}

function useMediaUrl(file: NewsMediaFile | null): string | null {
  const cachedUrl = file ? mediaCache.get(file.fileUrl) ?? null : null;
  const [url, setUrl] = useState<string | null>(cachedUrl);

  useEffect(() => {
    if (!file || cachedUrl || (!isImageFile(file) && !isVideoFile(file))) {
      return;
    }

    let active = true;
    void newsService
      .fetchMediaPreview(file.fileUrl)
      .then((blob) => {
        if (!active) return;
        const typedBlob = ensureBlobType(blob, file);
        const objectUrl = URL.createObjectURL(typedBlob);
        mediaCache.set(file.fileUrl, objectUrl);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [file, cachedUrl]);

  return file ? cachedUrl ?? url : null;
}

function NewsFileSurface({
  file,
  height = '100%',
  fit = 'cover',
  showControls = false,
}: {
  file: NewsMediaFile | null;
  height?: number | string;
  fit?: 'cover' | 'contain';
  showControls?: boolean;
}) {
  const url = useMediaUrl(file);

  if (!file) {
    return (
      <Box
        sx={{
          height,
          bgcolor: '#f5fafc',
          borderBottom: '1px solid rgba(32, 73, 96, 0.06)',
        }}
      />
    );
  }

  if (isImageFile(file) && url) {
    return (
      <Box
        component="img"
        src={url}
        alt={file.fileName}
        sx={{
          width: '100%',
          height,
          display: 'block',
          objectFit: fit,
          bgcolor: '#071621',
        }}
      />
    );
  }

  if (isVideoFile(file) && url) {
    return (
      <Box
        component="video"
        src={url}
        controls={showControls}
        muted={!showControls}
        playsInline
        sx={{
          width: '100%',
          height,
          display: 'block',
          objectFit: fit,
          bgcolor: '#05111a',
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: 1.4,
        bgcolor: isPdfFile(file) ? 'rgba(113, 42, 53, 0.9)' : 'rgba(21, 58, 84, 0.92)',
        color: '#f1fbff',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 1.4, bgcolor: 'rgba(255,255,255,0.12)' }}>
          {fileIcon(file)}
        </Box>
        <Typography variant="caption" sx={{ color: 'rgba(241,251,255,0.74)' }}>
          {getFileExtension(file.fileName).toUpperCase() || 'FILE'}
        </Typography>
      </Stack>
      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            lineHeight: 1.25,
          }}
        >
          {file.fileName}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.6, color: 'rgba(241,251,255,0.72)' }}>
          {formatFileSize(file.fileSize)}
        </Typography>
      </Box>
    </Box>
  );
}

function NewsFilePreviewContent({ file, maxHeight }: { file: NewsMediaFile; maxHeight: string | number }) {
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setDocxHtml(null);
      try {
        const sourceBlob = await newsService.fetchMediaPreview(file.fileUrl);
        const blob = ensureBlobType(sourceBlob, file);
        if (isDocxFile(file)) {
          const html = await renderDocxToHtml(blob);
          if (active) {
            setDocxHtml(html);
          }
        }
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setUrl(objectUrl);
        }
      } catch {
        if (active) {
          setUrl(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  if (loading) {
    return <LinearProgress />;
  }

  if (!url) {
    return <Alert severity="warning">Не удалось загрузить предпросмотр файла.</Alert>;
  }

  if (isImageFile(file)) {
    return <Box component="img" src={url} alt={file.fileName} sx={{ width: '100%', maxHeight, objectFit: 'contain', bgcolor: '#eef5f8' }} />;
  }

  if (isVideoFile(file)) {
    return <Box component="video" src={url} controls sx={{ width: '100%', maxHeight }} />;
  }

  if (isPdfFile(file)) {
    return <Box component="iframe" src={url} title={file.fileName} sx={{ width: '100%', height: maxHeight, border: 0, bgcolor: '#fff' }} />;
  }

  if (isDocxFile(file) && docxHtml) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 1.5,
          bgcolor: '#fff',
          maxHeight,
          overflow: 'auto',
          '& p': { mt: 0, mb: 1.4 },
          '& *': { maxWidth: '100%' },
        }}
        dangerouslySetInnerHTML={{ __html: docxHtml }}
      />
    );
  }

  if (isDocFile(file)) {
    return <Alert severity="info">Для файлов DOC встроенный предпросмотр ограничен. Используйте скачивание.</Alert>;
  }

  return <Alert severity="info">Для этого типа файла доступно скачивание.</Alert>;
}

function NewsCard({
  item,
  canManage,
  onOpen,
  onEdit,
  onDelete,
  onTogglePin,
  onPreviewFile,
}: {
  item: NewsItem;
  canManage: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onPreviewFile: (file: NewsMediaFile) => void;
}) {
  const leadFile = item.media[0] ?? null;

  return (
    <Card
      onClick={onOpen}
      sx={{
        ...shellPanelSx,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 28px 56px rgba(24, 57, 74, 0.12)',
        },
      }}
    >
      <Box sx={{ position: 'relative', flex: '0 0 43%', minHeight: 118 }}>
        <NewsFileSurface file={leadFile} />

        {item.isPinned && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: 10,
              px: 1,
              py: 0.45,
              borderRadius: 999,
              bgcolor: 'rgba(7, 35, 52, 0.76)',
              border: '1px solid rgba(151, 212, 236, 0.32)',
              color: '#d7f1ff',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <PushPin sx={{ fontSize: 14 }} />
            <Typography variant="caption" sx={{ color: 'inherit' }}>
              Закреплено
            </Typography>
          </Box>
        )}

        {canManage && (
          <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
            <Tooltip title={item.isPinned ? 'Снять закрепление' : 'Закрепить'}>
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePin();
                }}
                sx={{
                  bgcolor: item.isPinned ? 'rgba(24, 79, 112, 0.92)' : 'rgba(13, 40, 57, 0.72)',
                  color: '#d8f3ff',
                  '&:hover': { bgcolor: 'rgba(21, 65, 90, 0.96)' },
                }}
              >
                <PushPin fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Редактировать">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                sx={{
                  bgcolor: 'rgba(13, 40, 57, 0.72)',
                  color: '#d8f3ff',
                  '&:hover': { bgcolor: 'rgba(21, 65, 90, 0.96)' },
                }}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Удалить">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                sx={{
                  bgcolor: 'rgba(70, 19, 28, 0.68)',
                  color: '#ffd9df',
                  '&:hover': { bgcolor: 'rgba(92, 22, 36, 0.92)' },
                }}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}

        {leadFile && (
          <Tooltip title="Открыть вложение">
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onPreviewFile(leadFile);
              }}
              sx={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                bgcolor: 'rgba(9, 29, 41, 0.78)',
                color: '#e7f9ff',
                '&:hover': { bgcolor: 'rgba(15, 47, 66, 0.96)' },
              }}
            >
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Stack spacing={0.8} sx={{ p: 1.35, flex: 1, minHeight: 0 }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            minHeight: '2.4em',
          }}
        >
          {item.title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
            overflow: 'hidden',
            minHeight: '4.2em',
          }}
        >
          {buildExcerpt(item.content)}
        </Typography>

        <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between" sx={{ mt: 'auto' }}>
          <Typography variant="caption" color="text.secondary">
            {formatPublishTime(item.publishedAt)}
          </Typography>
          {item.media.length > 0 ? (
            <Chip
              size="small"
              variant="outlined"
              label={`${item.media.length} файл${item.media.length === 1 ? '' : item.media.length < 5 ? 'а' : 'ов'}`}
            />
          ) : (
            <Box />
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

export default function NewsPanel() {
  const canManageNews = useHasPermission(PermissionCodes.NEWS_MANAGE);
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isMdDown = useMediaQuery(theme.breakpoints.down('lg'));

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsFormState>(buildEmptyForm);

  const [viewerNewsId, setViewerNewsId] = useState<string | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [previewFile, setPreviewFile] = useState<NewsMediaFile | null>(null);

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [currentPage, setCurrentPage] = useState(1);

  const columns = isXs ? 1 : isMdDown ? 2 : 3;
  const pageSize = columns * 2;

  const sortedNews = useMemo(() => {
    return [...news].sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return Number(b.isPinned) - Number(a.isPinned);
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [news]);

  const filteredNews = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return sortedNews;
    }

    return sortedNews.filter((item) => {
      const haystack = `${item.title} ${stripHtml(item.content)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearch, sortedNews]);

  const pagedNews = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNews.slice(start, start + pageSize);
  }, [currentPage, filteredNews, pageSize]);

  const viewerNews = useMemo(() => sortedNews.find((item) => item.id === viewerNewsId) || null, [sortedNews, viewerNewsId]);
  const activeMedia = viewerNews?.media[activeMediaIndex] ?? null;

  const totalPages = Math.max(1, Math.ceil(filteredNews.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!viewerNewsId) return;
    if (!viewerNews) {
      setViewerNewsId(null);
      setActiveMediaIndex(0);
      return;
    }
    if (activeMediaIndex > viewerNews.media.length - 1) {
      setActiveMediaIndex(0);
    }
  }, [activeMediaIndex, viewerNews, viewerNewsId]);

  const loadNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await newsService.list();
      setNews(items);
    } catch {
      setError('Не удалось загрузить новости');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNews();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(buildEmptyForm());
    setEditorOpen(true);
  };

  const openEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.content,
      isPinned: item.isPinned,
      media: [...item.media].sort((a, b) => a.order - b.order),
    });
    setEditorOpen(true);
  };

  const handleDelete = async (item: NewsItem) => {
    if (!window.confirm(`Удалить новость «${item.title}»?`)) {
      return;
    }

    try {
      await newsService.delete(item.id);
      await loadNews();
      if (viewerNewsId === item.id) {
        setViewerNewsId(null);
      }
    } catch {
      setError('Не удалось удалить новость');
    }
  };

  const handleTogglePin = async (item: NewsItem) => {
    try {
      await newsService.update(item.id, {
        title: item.title,
        content: item.content,
        isPinned: !item.isPinned,
        media: normalizeMediaOrder(item.media),
      });
      await loadNews();
    } catch {
      setError(item.isPinned ? 'Не удалось снять закрепление' : 'Не удалось закрепить новость');
    }
  };

  const handleDownloadFile = async (file: NewsMediaFile) => {
    try {
      const blob = await newsService.fetchMediaDownload(file.fileUrl);
      downloadBlob(blob, file.fileName);
    } catch {
      setError('Не удалось скачать файл');
    }
  };

  const handleUploadMedia = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const uploaded: NewsMediaFile[] = [];
      for (const file of Array.from(fileList)) {
        const result = await newsService.uploadMedia(file);
        uploaded.push(result);
      }

      setForm((prev) => ({
        ...prev,
        media: normalizeMediaOrder([...prev.media, ...uploaded]),
      }));
    } catch {
      setError('Ошибка загрузки файлов новости');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNews = async () => {
    if (!form.title.trim()) {
      setError('Укажите заголовок новости');
      return;
    }

    if (!stripHtml(form.content)) {
      setError('Укажите текст новости');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await newsService.update(editingId, toPayload(form));
      } else {
        await newsService.create(toPayload(form));
      }
      setEditorOpen(false);
      setEditingId(null);
      setForm(buildEmptyForm());
      await loadNews();
    } catch {
      setError('Не удалось сохранить новость');
    } finally {
      setSaving(false);
    }
  };

  const openNews = (item: NewsItem) => {
    setViewerNewsId(item.id);
    setActiveMediaIndex(0);
  };

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
      <Box
        sx={{
          ...shellPanelSx,
          position: 'sticky',
          top: 0,
          zIndex: 4,
          p: 1.2,
          borderRadius: 3,
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <Stack direction="row" spacing={0.7} alignItems="center">
            <IconButton size="small" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={!canGoPrev}>
              <ChevronLeft />
            </IconButton>
            <TextField
              select
              size="small"
              label="Страница"
              value={currentPage}
              onChange={(event) => setCurrentPage(Number(event.target.value))}
              sx={{ minWidth: 140 }}
            >
              {Array.from({ length: totalPages }, (_, index) => (
                <MenuItem key={index + 1} value={index + 1}>
                  {index + 1} / {totalPages}
                </MenuItem>
              ))}
            </TextField>
            <IconButton size="small" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={!canGoNext}>
              <ChevronRight />
            </IconButton>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              Показано {pagedNews.length} из {filteredNews.length}
            </Typography>
          </Stack>

          <TextField
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию и содержанию"
            fullWidth
            InputProps={{
              startAdornment: <Search fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />

          {canManageNews && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openCreate}
              sx={{
                alignSelf: { xs: 'stretch', lg: 'center' },
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: { xs: '100%', lg: 192 },
                px: 2.25,
                borderRadius: 1,
              }}
            >
              Создать новость
            </Button>
          )}
        </Stack>
      </Box>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {filteredNews.length === 0 ? (
          <Box sx={{ ...shellEmptyStateSx, py: 7 }}>
            <Box>
              <Typography variant="h6" sx={{ mb: 0.7, color: 'text.primary' }}>
                {search.trim() ? 'Ничего не найдено' : 'Новостей пока нет'}
              </Typography>
              <Typography color="text.secondary">
                {search.trim()
                  ? 'Измените поисковый запрос или очистите фильтр.'
                  : 'Лента появится здесь в виде сетки одинаковых карточек.'}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
              gap: 1.2,
            }}
          >
            {pagedNews.map((item) => (
              <Box key={item.id} sx={{ minHeight: 0 }}>
                <NewsCard
                  item={item}
                  canManage={canManageNews}
                  onOpen={() => openNews(item)}
                  onEdit={() => openEdit(item)}
                  onDelete={() => void handleDelete(item)}
                  onTogglePin={() => void handleTogglePin(item)}
                  onPreviewFile={(file) => setPreviewFile(file)}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Dialog open={editorOpen} onClose={() => !saving && setEditorOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>{editingId ? 'Редактировать новость' : 'Создать новость'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.4} sx={{ mt: 0.5 }}>
            <TextField
              label="Заголовок"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.7 }}>
                Текст новости
              </Typography>
              <Box sx={{ minHeight: 280 }}>
                <RichTextEditor
                  value={form.content}
                  onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
                  placeholder="Опишите новость, добавьте списки, акценты и структуру текста..."
                />
              </Box>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Закрепить вверху списка
              </Typography>
              <Switch
                checked={form.isPinned}
                onChange={(event) => setForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Вложения ({form.media.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Фото, видео, PDF, DOC и DOCX. Можно сохранить новость без вложений.
                </Typography>
              </Box>
              <Button component="label" variant="outlined" disabled={saving}>
                Загрузить файлы
                <input
                  hidden
                  type="file"
                  accept={FILE_ACCEPT}
                  multiple
                  onChange={(event) => {
                    const { files } = event.target;
                    void handleUploadMedia(files);
                    event.target.value = '';
                  }}
                />
              </Button>
            </Stack>

            {form.media.length > 0 ? (
              <Grid container spacing={1}>
                {form.media.map((item) => (
                  <Grid key={item.fileUrl} size={{ xs: 12, md: 6 }}>
                    <Card sx={{ ...shellInnerPanelSx, overflow: 'hidden' }}>
                      <NewsFileSurface file={item} height={138} />
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between" sx={{ p: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                            {item.fileName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(item.fileSize)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.4}>
                          <Tooltip title="Предпросмотр">
                            <IconButton size="small" onClick={() => setPreviewFile(item)}>
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  media: normalizeMediaOrder(prev.media.filter((media) => media.fileUrl !== item.fileUrl)),
                                }))
                              }
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Stack>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box sx={{ ...shellInnerPanelSx, p: 2, color: 'text.secondary' }}>
                <Typography variant="body2">Вложения не добавлены. Новость можно опубликовать только с текстом.</Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void handleSaveNews()} variant="contained" disabled={saving}>
            {editingId ? 'Сохранить' : 'Опубликовать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(viewerNews)}
        onClose={() => setViewerNewsId(null)}
        fullScreen
        PaperProps={{
          sx: {
            borderRadius: 0,
            overflow: 'hidden',
          },
        }}
      >
        {viewerNews && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#eef5f8' }}>
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                px: { xs: 1.5, md: 2.5 },
                py: 1.1,
                background: 'rgba(238, 245, 248, 0.92)',
                borderBottom: '1px solid rgba(32, 73, 96, 0.08)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" noWrap>
                    {viewerNews.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fullName(viewerNews.author)} • {formatPublishTime(viewerNews.publishedAt)}
                  </Typography>
                </Box>
                <IconButton onClick={() => setViewerNewsId(null)}>
                  <Close />
                </IconButton>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 1.4, md: 2 } }}>
              <Stack spacing={1.4}>
                {activeMedia ? (
                  <Box sx={{ ...shellPanelSx, p: 1.2 }}>
                    <Stack spacing={1.2}>
                      <Box sx={{ minHeight: 340 }}>
                        <NewsFilePreviewContent file={activeMedia} maxHeight="56vh" />
                      </Box>
                      <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                          {viewerNews.media.map((item, index) => (
                            <Chip
                              key={item.id}
                              label={item.fileName}
                              icon={fileIcon(item)}
                              color={index === activeMediaIndex ? 'primary' : 'default'}
                              variant={index === activeMediaIndex ? 'filled' : 'outlined'}
                              onClick={() => setActiveMediaIndex(index)}
                              onDelete={undefined}
                              sx={{ maxWidth: 320 }}
                            />
                          ))}
                        </Stack>
                        <Stack direction="row" spacing={0.4}>
                          {viewerNews.media.length > 1 && (
                            <>
                              <IconButton
                                onClick={() =>
                                  setActiveMediaIndex((prev) => (prev - 1 + viewerNews.media.length) % viewerNews.media.length)
                                }
                              >
                                <ChevronLeft />
                              </IconButton>
                              <IconButton onClick={() => setActiveMediaIndex((prev) => (prev + 1) % viewerNews.media.length)}>
                                <ChevronRight />
                              </IconButton>
                            </>
                          )}
                          <Button startIcon={<Visibility />} onClick={() => setPreviewFile(activeMedia)}>
                            Открыть
                          </Button>
                          <Button startIcon={<CloudDownload />} onClick={() => void handleDownloadFile(activeMedia)}>
                            Скачать
                          </Button>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Box>
                ) : null}

                <Box sx={{ ...shellPanelSx, p: { xs: 1.6, md: 2.2 } }}>
                  <Stack spacing={1.4}>
                    <Typography variant="h4">{viewerNews.title}</Typography>
                    <Typography
                      component="div"
                      variant="body1"
                      sx={{
                        color: 'text.primary',
                        lineHeight: 1.72,
                        '& p': { mt: 0, mb: 1.2 },
                        '& ul, & ol': { pl: 3, my: 1.2 },
                      }}
                      dangerouslySetInnerHTML={{ __html: viewerNews.content }}
                    />

                    {viewerNews.media.length > 0 && (
                      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                        {viewerNews.media.map((file) => (
                          <Chip
                            key={file.id}
                            icon={fileIcon(file)}
                            label={file.fileName}
                            variant="outlined"
                            onClick={() => setPreviewFile(file)}
                            sx={{ cursor: 'pointer', maxWidth: 360 }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          </Box>
        )}
      </Dialog>

      <Dialog
        open={Boolean(previewFile)}
        onClose={() => setPreviewFile(null)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '96vw',
            maxWidth: '96vw',
            height: '92vh',
            maxHeight: '92vh',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="h6" noWrap sx={{ maxWidth: '74vw' }}>
            {previewFile?.fileName || 'Предпросмотр файла'}
          </Typography>
          {previewFile && (
            <Button size="small" startIcon={<CloudDownload />} onClick={() => void handleDownloadFile(previewFile)}>
              Скачать
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          {previewFile ? (
            <NewsFilePreviewContent file={previewFile} maxHeight="78vh" />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Файл не выбран.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewFile(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
