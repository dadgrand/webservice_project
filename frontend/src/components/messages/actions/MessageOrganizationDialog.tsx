import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
  Stack,
  Typography,
} from '@mui/material';
import { ArchiveOutlined, Folder as FolderIcon, Label as LabelIcon, MoveToInbox as InboxIcon } from '@mui/icons-material';
import { messageService } from '../../../services';
import { useMessageStore } from '../../../store/messageStore';
import type { Message } from '../../../types';

interface MessageOrganizationDialogProps {
  open: boolean;
  mode: 'folder' | 'label' | null;
  messageId: string | null;
  onClose: () => void;
  onApplied?: () => Promise<void> | void;
}

const MessageOrganizationDialog: React.FC<MessageOrganizationDialogProps> = ({
  open,
  mode,
  messageId,
  onClose,
  onApplied,
}) => {
  const { folders, labels, fetchFolders, fetchLabels, fetchMessages } = useMessageStore();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [threadMessageCount, setThreadMessageCount] = useState(0);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);

  useEffect(() => {
    if (!open || !mode || !messageId) {
      setMessage(null);
      setSelectedFolderId(null);
      setSelectedLabelIds([]);
      setThreadMessageCount(0);
      setScopeDialogOpen(false);
      return;
    }

    let cancelled = false;

    const loadContext = async () => {
      setLoading(true);
      try {
        const details = await messageService.getById(messageId);
        if (cancelled) {
          return;
        }

        setMessage(details);
        setSelectedFolderId(details.folderId ?? null);
        setSelectedLabelIds((details.labels || []).map((label) => label.id));

        if (details.threadId) {
          const thread = await messageService.getThread(details.threadId);
          if (!cancelled) {
            setThreadMessageCount(thread.messages.length);
          }
        } else if (!cancelled) {
          setThreadMessageCount(0);
        }
      } catch (error) {
        console.error('Failed to load message organization context:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [mode, messageId, open]);

  const availableFolders = [
    { id: null, name: 'Входящие', color: null },
    ...folders
      .filter((folder) => folder.type === 'system' && folder.systemName === 'archive')
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        color: folder.color,
      })),
    ...folders.filter((folder) => folder.type === 'custom').map((folder) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
    })),
  ];

  const hasThreadScopeChoice = threadMessageCount > 1;
  const canApplySingle = Boolean(message?.canOrganize);
  const canApplyThread = hasThreadScopeChoice;

  const closeAll = () => {
    setScopeDialogOpen(false);
    onClose();
  };

  const applyChanges = async (applyToThread: boolean) => {
    if (!mode || !message) {
      return;
    }

    if (!applyToThread && !canApplySingle) {
      return;
    }

    setSaving(true);
    try {
      if (mode === 'folder') {
        await messageService.moveToFolder(message.id, selectedFolderId, applyToThread);
      }

      if (mode === 'label') {
        const currentIds = new Set((message.labels || []).map((label) => label.id));
        const nextIds = new Set(selectedLabelIds);
        const labelsToAdd = selectedLabelIds.filter((labelId) => !currentIds.has(labelId));
        const labelsToRemove = Array.from(currentIds).filter((labelId) => !nextIds.has(labelId));

        await Promise.all(labelsToAdd.map((labelId) => messageService.addLabel(message.id, labelId, applyToThread)));
        await Promise.all(labelsToRemove.map((labelId) => messageService.removeLabel(message.id, labelId, applyToThread)));
      }

      await Promise.all([fetchFolders(), fetchLabels(), fetchMessages()]);
      await onApplied?.();
      closeAll();
    } catch (error) {
      console.error('Failed to apply message organization changes:', error);
      alert(mode === 'folder' ? 'Не удалось переместить сообщение в папку' : 'Не удалось обновить метки сообщения');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!message || !mode) {
      return;
    }

    if (mode === 'folder' && selectedFolderId === (message.folderId ?? null)) {
      closeAll();
      return;
    }

    if (mode === 'label') {
      const currentIds = new Set((message.labels || []).map((label) => label.id));
      const nextIds = new Set(selectedLabelIds);
      const hasChanges =
        currentIds.size !== nextIds.size || Array.from(currentIds).some((labelId) => !nextIds.has(labelId));

      if (!hasChanges) {
        closeAll();
        return;
      }
    }

    if (!canApplySingle && canApplyThread) {
      await applyChanges(true);
      return;
    }

    if (hasThreadScopeChoice) {
      setScopeDialogOpen(true);
      return;
    }

    if (canApplySingle) {
      await applyChanges(false);
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  return (
    <>
      <Dialog open={open && mode !== null} onClose={closeAll} fullWidth maxWidth="sm">
        <DialogTitle>{mode === 'folder' ? 'Переместить в папку' : 'Изменить метки'}</DialogTitle>
        <DialogContent>
          {loading || !message ? (
            <Typography color="text.secondary">Загрузка данных сообщения...</Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2">{message.subject || '(Без темы)'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {!canApplySingle && canApplyThread
                    ? `Для этого сообщения действие можно применить только ко всему треду из ${threadMessageCount} сообщений.`
                    : hasThreadScopeChoice
                    ? `Сообщение входит в тред из ${threadMessageCount} сообщений.`
                    : 'Действие будет применено к выбранному сообщению.'}
                </Typography>
              </Box>

              {mode === 'folder' ? (
                <>
                  {availableFolders.length > 0 ? (
                    <List sx={{ p: 0 }}>
                      {availableFolders.map((folder) => (
                        <ListItemButton
                          key={folder.id ?? 'inbox'}
                          selected={selectedFolderId === folder.id}
                          onClick={() => setSelectedFolderId(folder.id)}
                          sx={{ borderRadius: '14px', mb: 0.5 }}
                        >
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {folder.id === null ? (
                              <InboxIcon />
                            ) : folder.name === 'Архив' ? (
                              <ArchiveOutlined />
                            ) : (
                              <FolderIcon sx={{ color: folder.color || 'inherit' }} />
                            )}
                          </ListItemIcon>
                          <ListItemText primary={folder.name} />
                          <Radio checked={selectedFolderId === folder.id} />
                        </ListItemButton>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">
                      Пока нет кастомных папок. Создайте их в разделе «Папки» слева.
                    </Typography>
                  )}
                </>
              ) : (
                <>
                  {labels.length > 0 ? (
                    <List sx={{ p: 0 }}>
                      {labels.map((label) => (
                        <ListItemButton key={label.id} onClick={() => toggleLabel(label.id)} sx={{ borderRadius: '14px', mb: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <Checkbox edge="start" checked={selectedLabelIds.includes(label.id)} tabIndex={-1} disableRipple />
                          </ListItemIcon>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <LabelIcon sx={{ color: label.color }} />
                          </ListItemIcon>
                          <ListItemText primary={label.name} />
                        </ListItemButton>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">
                      Пока нет меток. Создайте их в разделе «Метки» слева.
                    </Typography>
                  )}
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAll}>Отмена</Button>
          <Button onClick={() => void handleSubmit()} variant="contained" disabled={loading || saving || !message}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={scopeDialogOpen} onClose={() => setScopeDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Применить действие к треду?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            В этом треде найдено {threadMessageCount} сообщений. Выберите, нужно применить действие только к текущему сообщению или ко всему треду.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => void applyChanges(false)} disabled={saving || !canApplySingle}>
              Только это сообщение
            </Button>
            <Button onClick={() => void applyChanges(true)} variant="contained" disabled={saving}>
              Весь тред
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MessageOrganizationDialog;
