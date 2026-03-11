import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Button,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
} from '@mui/material';
import {
  Inbox as InboxIcon,
  Send as SendIcon,
  Drafts as DraftsIcon,
  Delete as DeleteIcon,
  Label as LabelIcon,
  Add as AddIcon,
  Archive as ArchiveIcon,
  Folder as FolderIcon,
  Star as StarIcon,
  AddCircleOutline as AddCircleOutlineIcon,
} from '@mui/icons-material';
import { useMessageStore } from '../../../store/messageStore';
import { messageService } from '../../../services';

const SYSTEM_ICONS: Record<string, React.ReactElement> = {
  inbox: <InboxIcon />,
  sent: <SendIcon />,
  drafts: <DraftsIcon />,
  trash: <DeleteIcon />,
  archive: <ArchiveIcon />,
  starred: <StarIcon />,
};

// Map system folder names to folder types
const FOLDER_TYPE_MAP: Record<string, 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash' | 'archive' | 'custom'> = {
  inbox: 'inbox',
  sent: 'sent',
  drafts: 'drafts',
  starred: 'starred',
  trash: 'trash',
  archive: 'archive',
};

const FolderList: React.FC = () => {
  const {
    folders,
    labels,
    currentFolderId,
    currentFolderType,
    currentLabelId,
    setFolder,
    setLabel,
    startCompose,
    fetchFolders,
    fetchLabels,
  } = useMessageStore();
  const [dialogMode, setDialogMode] = useState<'folder' | 'label' | null>(null);
  const [entityName, setEntityName] = useState('');
  const [entityColor, setEntityColor] = useState('#4a97b5');
  const [saving, setSaving] = useState(false);

  const handleFolderClick = (folderId: string | null, systemName?: string) => {
    const folderType = systemName ? (FOLDER_TYPE_MAP[systemName] || 'custom') : 'custom';
    setFolder(folderId, folderType);
  };

  const resetDialog = () => {
    setDialogMode(null);
    setEntityName('');
    setEntityColor('#4a97b5');
    setSaving(false);
  };

  const handleCreate = async () => {
    const name = entityName.trim();
    if (!name) {
      return;
    }

    setSaving(true);
    try {
      if (dialogMode === 'folder') {
        await messageService.createFolder(name, entityColor);
        await fetchFolders();
      }

      if (dialogMode === 'label') {
        await messageService.createLabel(name, entityColor);
        await fetchLabels();
      }

      resetDialog();
    } catch (error) {
      console.error('Failed to create message entity:', error);
      alert(dialogMode === 'folder' ? 'Не удалось создать папку' : 'Не удалось создать метку');
      setSaving(false);
    }
  };

  const systemFolders = folders.filter((f) => f.type === 'system');
  const customFolders = folders.filter((f) => f.type === 'custom');

  return (
    <Box sx={{ p: 2.2 }}>
      <Button
        variant="contained"
        fullWidth
        startIcon={<AddIcon />}
        onClick={() => startCompose()}
        sx={{ mb: 2.2, py: 1.55, borderRadius: '18px', boxShadow: '0 16px 32px rgba(29, 122, 143, 0.18)' }}
      >
        Написать
      </Button>

      <List component="nav" sx={{ display: 'grid', gap: 0.35 }}>
        {/* System Folders */}
        {systemFolders.map((folder) => {
          const systemName = folder.systemName || 'inbox';
          // For inbox, folderId should be null; for others, use systemName to determine type
          const isInbox = systemName === 'inbox';
          const isSelected = isInbox 
            ? currentFolderType === 'inbox' && currentFolderId === null
            : currentFolderType === (FOLDER_TYPE_MAP[systemName] || 'custom');

          return (
            <ListItem key={folder.id} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleFolderClick(isInbox ? null : folder.id, systemName)}
                sx={{ borderRadius: '14px' }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: isSelected ? 'primary.main' : 'inherit' }}>
                  {SYSTEM_ICONS[systemName] || <FolderIcon />}
                </ListItemIcon>
                <ListItemText primary={folder.name} />
                {folder.unreadCount > 0 && (
                  <Typography variant="caption" fontWeight="bold" color="primary">
                    {folder.unreadCount}
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}

        <Divider sx={{ my: 2.2 }} />

        {/* Custom Folders */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em' }}>
            Папки
          </Typography>
          <IconButton size="small" onClick={() => setDialogMode('folder')}>
            <AddCircleOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
        {customFolders.map((folder) => (
          <ListItem key={folder.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={currentFolderId === folder.id && currentFolderType === 'custom'}
              onClick={() => handleFolderClick(folder.id, 'custom')}
              sx={{ borderRadius: '14px' }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <FolderIcon sx={{ color: folder.color || 'inherit' }} />
              </ListItemIcon>
              <ListItemText primary={folder.name} />
              {folder.unreadCount > 0 && (
                <Typography variant="caption" fontWeight="bold">
                  {folder.unreadCount}
                </Typography>
              )}
            </ListItemButton>
          </ListItem>
        ))}
        {customFolders.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 0.75 }}>
            Создайте папку, чтобы раскладывать письма по разделам.
          </Typography>
        )}

        <Divider sx={{ my: 2.2 }} />

        {/* Labels */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em' }}>
            Метки
          </Typography>
          <IconButton size="small" onClick={() => setDialogMode('label')}>
            <AddCircleOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
        {labels.map((label) => (
          <ListItem key={label.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton selected={currentFolderType === 'label' && currentLabelId === label.id} sx={{ borderRadius: '14px' }} onClick={() => setLabel(label.id)}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <LabelIcon sx={{ color: label.color }} />
              </ListItemIcon>
              <ListItemText primary={label.name} />
            </ListItemButton>
          </ListItem>
        ))}
        {labels.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 0.75 }}>
            Создайте метки, чтобы быстро фильтровать связанные сообщения.
          </Typography>
        )}
      </List>

      <Dialog open={dialogMode !== null} onClose={resetDialog} fullWidth maxWidth="xs">
        <DialogTitle>{dialogMode === 'folder' ? 'Новая папка' : 'Новая метка'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={dialogMode === 'folder' ? 'Название папки' : 'Название метки'}
              value={entityName}
              onChange={(event) => setEntityName(event.target.value)}
              autoFocus
              fullWidth
            />
            <TextField
              label="Цвет"
              type="color"
              value={entityColor}
              onChange={(event) => setEntityColor(event.target.value)}
              fullWidth
              sx={{ '& input': { minHeight: 52 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetDialog}>Отмена</Button>
          <Button onClick={handleCreate} variant="contained" disabled={!entityName.trim() || saving}>
            Создать
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FolderList;
