import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Divider,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  Reply,
  ReplyAll,
  Forward,
  Delete,
  Star,
  StarBorder,
  MoreVert,
  AttachFile,
  CreateNewFolder,
  LabelOutlined,
  ForumOutlined,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useMessageStore } from '../../../store/messageStore';
import { messageService } from '../../../services';
import type { Message, MessageThread } from '../../../types';
import MessageOrganizationDialog from '../actions/MessageOrganizationDialog';
import { buildMessagePreview } from '../../../utils/messagePreview';
import { resolveMediaUrl } from '../../../utils/media';

const MessageView: React.FC = () => {
  const {
    selectedMessageId,
    startReply,
    startReplyAll,
    startForward,
    deleteMessage,
    toggleStar,
    fetchMessages,
    fetchFolders,
    selectMessage,
    currentFolderType,
  } = useMessageStore();
  const [message, setMessage] = useState<Message | null>(null);
  const [thread, setThread] = useState<MessageThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [actionAnchorEl, setActionAnchorEl] = useState<HTMLElement | null>(null);
  const [organizationMode, setOrganizationMode] = useState<'folder' | 'label' | null>(null);
  const canOrganizeMessage = currentFolderType !== 'drafts' && Boolean(message?.canOrganize || (message?.threadMessageCount ?? 0) > 1);

  const loadSelectedMessage = useCallback(async (messageId: string) => {
    setLoading(true);
    try {
      const data = await messageService.getById(messageId);
      setMessage(data);
      setIsStarred(data.isStarred ?? false);

      if (data.threadId) {
        const threadData = await messageService.getThread(data.threadId);
        setThread(threadData.messages.length > 1 ? threadData : null);
      } else {
        setThread(null);
      }

      await messageService.markAsRead(messageId);
      await Promise.all([fetchMessages(), fetchFolders()]);
    } catch (error) {
      console.error('Failed to load message:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchFolders, fetchMessages]);

  useEffect(() => {
    if (!selectedMessageId) {
      setMessage(null);
      setThread(null);
      return;
    }

    void loadSelectedMessage(selectedMessageId);
  }, [selectedMessageId, loadSelectedMessage]);

  const handleDelete = async () => {
    if (selectedMessageId) {
      if (confirm('Удалить сообщение?')) {
        await deleteMessage(selectedMessageId);
      }
    }
  };

  const handleToggleStar = async () => {
    if (selectedMessageId) {
      await toggleStar(selectedMessageId);
      setIsStarred(!isStarred);
    }
  };

  if (!selectedMessageId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: 'background.default' }}>
        <Typography color="text.secondary">Выберите сообщение для просмотра</Typography>
      </Box>
    );
  }

  if (loading || !message) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Загрузка...</Typography>
      </Box>
    );
  }

  const relatedThreadMessages = thread?.messages || [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'transparent' }}>
      {/* Toolbar */}
      <Box sx={{ p: 2.2, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(32, 73, 96, 0.08)', background: 'rgba(255,255,255,0.2)' }}>
        <Box>
          <Tooltip title="Ответить">
            <IconButton onClick={() => message && startReply(message)} disabled={!message}><Reply /></IconButton>
          </Tooltip>
          <Tooltip title="Ответить всем">
            <IconButton onClick={() => message && startReplyAll(message)} disabled={!message}><ReplyAll /></IconButton>
          </Tooltip>
          <Tooltip title="Переслать">
            <IconButton onClick={() => message && startForward(message)} disabled={!message}><Forward /></IconButton>
          </Tooltip>
          <Tooltip title="Удалить">
            <IconButton color="error" onClick={handleDelete} disabled={!message}><Delete /></IconButton>
          </Tooltip>
        </Box>
        <Box>
          <IconButton onClick={(event) => setActionAnchorEl(event.currentTarget)}>
            <MoreVert />
          </IconButton>
        </Box>
      </Box>

      {/* Header */}
      <Box sx={{ p: 3.2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" fontWeight="bold">
            {message.subject}
            {message.isImportant && (
              <Chip label="Важно" color="error" size="small" sx={{ ml: 2, verticalAlign: 'middle' }} />
            )}
          </Typography>
          <IconButton onClick={handleToggleStar}>
             {isStarred ? <Star color="warning" /> : <StarBorder />}
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar 
            src={resolveMediaUrl(message.sender.avatarUrl)} 
            sx={{ width: 48, height: 48, mr: 2 }}
          >
            {message.sender.firstName[0]}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {message.sender.lastName} {message.sender.firstName}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                   &lt;{message.sender.email}&gt;
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(new Date(message.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Кому: {message.recipients.map(r => `${r.firstName} ${r.lastName}`).join(', ')}
            </Typography>
            {message.labels && message.labels.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {message.labels.map((label) => (
                  <Chip
                    key={label.id}
                    size="small"
                    icon={<LabelOutlined />}
                    label={label.name}
                    sx={{ '& .MuiChip-icon': { color: label.color }, borderColor: `${label.color}55` }}
                    variant="outlined"
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>

        {/* Attachments */}
        {message.attachments.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
            {message.attachments.map(att => (
              <Chip
                key={att.id}
                icon={<AttachFile />}
                label={att.fileName}
                variant="outlined"
                onClick={() => {
                  const attachmentUrl = resolveMediaUrl(att.fileUrl);
                  if (attachmentUrl) {
                    window.open(attachmentUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}

        {relatedThreadMessages.length > 1 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
              <ForumOutlined fontSize="small" color="action" />
              <Typography variant="subtitle2">Связанный тред</Typography>
              <Typography variant="caption" color="text.secondary">
                {relatedThreadMessages.length} сообщений
              </Typography>
            </Box>
            <Stack spacing={1}>
              {relatedThreadMessages.map((threadMessage) => (
                <Box
                  key={threadMessage.id}
                  onClick={() => selectMessage(threadMessage.id)}
                  sx={{
                    borderRadius: '16px',
                    px: 1.5,
                    py: 1.25,
                    cursor: 'pointer',
                    border: threadMessage.id === message.id
                      ? '1px solid rgba(29, 122, 143, 0.28)'
                      : '1px solid rgba(32, 73, 96, 0.08)',
                    background: threadMessage.id === message.id
                      ? 'linear-gradient(135deg, rgba(74, 151, 181, 0.12) 0%, rgba(255,255,255,0.65) 100%)'
                      : 'rgba(255,255,255,0.45)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                    <Typography variant="subtitle2" noWrap>
                      {threadMessage.sender.lastName} {threadMessage.sender.firstName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {format(new Date(threadMessage.createdAt), 'd MMM, HH:mm', { locale: ru })}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={threadMessage.id === message.id ? 700 : 500} noWrap>
                    {threadMessage.subject || '(Без темы)'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {buildMessagePreview(threadMessage.content, 120)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Divider />
      </Box>

       {/* Content */}
       <Box sx={{ 
         px: 3.2,
         pb: 3.2,
         flexGrow: 1, 
         overflowY: 'auto',
         '&::-webkit-scrollbar': {
           display: 'none',
         },
         scrollbarWidth: 'none',
         msOverflowStyle: 'none',
       }}>
        <Typography 
          variant="body1" 
          component="div"
          sx={{ whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: message.content }} // Assuming content is HTML (TipTap)
        />
      </Box>
      
      {/* Reply Box Stub */}
      <Box sx={{ p: 2.4, borderTop: '1px solid rgba(32, 73, 96, 0.08)', background: 'rgba(255,255,255,0.18)' }}>
        <Button variant="outlined" startIcon={<Reply />} sx={{ mr: 1 }} onClick={() => message && startReply(message)}>
          Ответить
        </Button>
        <Button variant="outlined" startIcon={<Forward />} onClick={() => message && startForward(message)}>
          Переслать
        </Button>
      </Box>

      <Menu anchorEl={actionAnchorEl} open={Boolean(actionAnchorEl)} onClose={() => setActionAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setOrganizationMode('folder');
            setActionAnchorEl(null);
          }}
          disabled={!canOrganizeMessage}
        >
          <CreateNewFolder fontSize="small" sx={{ mr: 1 }} />
          Переместить в папку
        </MenuItem>
        <MenuItem
          onClick={() => {
            setOrganizationMode('label');
            setActionAnchorEl(null);
          }}
          disabled={!canOrganizeMessage}
        >
          <LabelOutlined fontSize="small" sx={{ mr: 1 }} />
          Изменить метки
        </MenuItem>
      </Menu>

      <MessageOrganizationDialog
        open={organizationMode !== null}
        mode={organizationMode}
        messageId={message?.id || null}
        onClose={() => setOrganizationMode(null)}
        onApplied={() => {
          if (selectedMessageId) {
            return loadSelectedMessage(selectedMessageId);
          }
        }}
      />
    </Box>
  );
};

export default MessageView;
