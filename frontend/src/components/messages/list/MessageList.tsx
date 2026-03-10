
import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
} from '@mui/material';
import { Search, Clear, CreateNewFolder, LabelOutlined, BookmarkRounded } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useMessageStore } from '../../../store/messageStore';
import { messageService } from '../../../services';
import type { InboxMessage } from '../../../types';
import MessageOrganizationDialog from '../actions/MessageOrganizationDialog';
import { resolveMediaUrl } from '../../../utils/media';

const MessageList: React.FC = () => {
  const { messages, isLoading, selectedMessageId, selectMessage, currentFolderType, editDraft } = useMessageStore();

  const [localSearch, setLocalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InboxMessage[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; messageId: string } | null>(null);
  const [organizationState, setOrganizationState] = useState<{ mode: 'folder' | 'label' | null; messageId: string | null }>({
    mode: null,
    messageId: null,
  });

  // Debounced search
  useEffect(() => {
    if (!localSearch.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await messageService.search(localSearch);
        setSearchResults(response.data || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearch]);

  const handleClearSearch = () => {
    setLocalSearch('');
    setSearchResults(null);
  };

  const handleMessageClick = (message: InboxMessage) => {
    if (currentFolderType === 'drafts') {
      // Open draft in compose dialog for editing
      editDraft(message.id);
    } else {
      // Normal message selection
      selectMessage(message.id);
    }
  };

  const handleContextMenu = (event: React.MouseEvent, message: InboxMessage) => {
    if (currentFolderType === 'drafts' || (!message.canOrganize && message.threadMessageCount <= 1)) {
      return;
    }

    event.preventDefault();
    selectMessage(message.id);
    setContextMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      messageId: message.id,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const openOrganizationDialog = (mode: 'folder' | 'label') => {
    if (!contextMenu?.messageId) {
      return;
    }

    setOrganizationState({
      mode,
      messageId: contextMenu.messageId,
    });
    closeContextMenu();
  };

  // Use search results if available, otherwise use messages from store
  const displayMessages = searchResults !== null ? searchResults : messages;
  const showLoading = isLoading || searching;

  const renderLabelMarkers = (message: InboxMessage) => {
    if (!message.labels || message.labels.length === 0) {
      return null;
    }

    const visibleLabels = message.labels.slice(0, 3);
    const hiddenCount = message.labels.length - visibleLabels.length;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.75, gap: 0.15, flexShrink: 0 }}>
        {visibleLabels.map((label) => (
          <BookmarkRounded
            key={label.id}
            sx={{
              fontSize: '0.95rem',
              color: label.color,
              opacity: 0.88,
              filter: 'drop-shadow(0 1px 2px rgba(24, 57, 74, 0.08))',
            }}
          />
        ))}
        {hiddenCount > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.35 }}>
            +{hiddenCount}
          </Typography>
        )}
      </Box>
    );
  };

  if (showLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Search bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(32, 73, 96, 0.08)', background: 'rgba(255,255,255,0.22)' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Поиск сообщений..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
              endAdornment: localSearch && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (displayMessages.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Search bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(32, 73, 96, 0.08)', background: 'rgba(255,255,255,0.22)' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Поиск сообщений..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
              endAdornment: localSearch && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, color: 'text.secondary' }}>
          <Typography>{searchResults !== null ? 'Сообщения не найдены' : 'Нет сообщений'}</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search bar */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(32, 73, 96, 0.08)', background: 'rgba(255,255,255,0.22)' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Поиск сообщений..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
            endAdornment: localSearch && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}>
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {searchResults !== null && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Найдено: {searchResults.length} сообщений
          </Typography>
        )}
      </Box>

       {/* Message list */}
       <List sx={{ 
         width: '100%', 
         bgcolor: 'transparent', 
         p: 0, 
         overflowY: 'auto', 
         flexGrow: 1,
         '&::-webkit-scrollbar': {
           display: 'none',
         },
         scrollbarWidth: 'none',
         msOverflowStyle: 'none',
       }}>
        {displayMessages.map((message) => (
          <React.Fragment key={message.id}>
          <ListItem disablePadding sx={{ px: 1, py: 0.65 }}>
            <ListItemButton
              alignItems="flex-start"
              selected={selectedMessageId === message.id}
              onClick={() => handleMessageClick(message)}
              onContextMenu={(event) => handleContextMenu(event, message)}
              sx={{
                py: 1.6,
                px: 1.5,
                borderRadius: '20px',
                border: !message.isRead
                  ? '1px solid rgba(29, 122, 143, 0.18)'
                  : '1px solid rgba(255,255,255,0.34)',
                background: !message.isRead
                  ? 'linear-gradient(135deg, rgba(74, 151, 181, 0.1) 0%, rgba(255,255,255,0.52) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.46) 0%, rgba(247,251,253,0.34) 100%)',
              }}
            >
              <ListItemAvatar>
                <Avatar alt={message.sender.firstName} src={resolveMediaUrl(message.sender.avatarUrl)}>
                  {message.sender.firstName[0]}
                </Avatar>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography
                      variant="subtitle2"
                      fontWeight={!message.isRead ? 'bold' : 'normal'}
                      noWrap
                      sx={{ maxWidth: '70%' }}
                    >
                      {message.sender.lastName} {message.sender.firstName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true, locale: ru })}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        color="text.primary"
                        fontWeight={!message.isRead ? 'bold' : 'normal'}
                        noWrap
                        sx={{ flexGrow: 1 }}
                      >
                        {message.subject || '(Без темы)'}
                      </Typography>
                      {renderLabelMarkers(message)}
                      {message.threadMessageCount > 1 && (
                        <Chip
                          size="small"
                          label={`${message.threadMessageCount} в треде`}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.625rem', ml: 1 }}
                        />
                      )}
                      {message.isImportant && (
                        <Chip size="small" label="Важно" color="error" sx={{ height: 20, fontSize: '0.625rem', ml: 1 }} />
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block' }}
                    >
                      {message.preview}
                    </Typography>
                  </Box>
                }
              />
            </ListItemButton>
          </ListItem>
        </React.Fragment>
        ))}
      </List>

      <Menu
        open={contextMenu !== null}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
        }
      >
        <MenuItem onClick={() => openOrganizationDialog('folder')}>
          <CreateNewFolder fontSize="small" sx={{ mr: 1 }} />
          Переместить в папку
        </MenuItem>
        <MenuItem onClick={() => openOrganizationDialog('label')}>
          <LabelOutlined fontSize="small" sx={{ mr: 1 }} />
          Изменить метки
        </MenuItem>
      </Menu>

      <MessageOrganizationDialog
        open={organizationState.mode !== null}
        mode={organizationState.mode}
        messageId={organizationState.messageId}
        onClose={() => setOrganizationState({ mode: null, messageId: null })}
      />
    </Box>
  );
};

export default MessageList;
