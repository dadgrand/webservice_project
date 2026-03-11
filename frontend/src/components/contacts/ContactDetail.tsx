import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
 import {
   Email,
   Phone,
   PhoneAndroid,
   Star,
   StarBorder,
   Business,
   Edit,
   Close,
 } from '@mui/icons-material';
import { useMessageStore } from '../../store/messageStore';
import { useAuthStore } from '../../store/authStore';
import { contactService } from '../../services';
import type { Contact } from '../../types';
import { shellEmptyStateSx, shellInnerPanelSx, shellInsetSurfaceSx, shellPanelHeaderSx } from '../../styles/shell';
import type { ApiResponse } from '../../types';
import { resolveMediaUrl } from '../../utils/media';
import {
  formatRussianPhone,
  isValidRussianPhone,
  RUSSIAN_PHONE_PLACEHOLDER,
} from '../../utils/phone';

interface ContactDetailProps {
  contact: Contact | null;
  isFavorite: boolean;
  onFavoriteChange: (contactId: string, isFavorite: boolean) => Promise<void>;
}

const ContactDetail: React.FC<ContactDetailProps> = ({ contact, isFavorite, onFavoriteChange }) => {
  const { startCompose } = useMessageStore();
  const { user, setUser } = useAuthStore();
  const [loadingFavorite, setLoadingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  
  // Edit profile state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Check if viewing own profile
  const isOwnProfile = user?.id === contact?.id;
  const profileContact = useMemo(() => {
    if (!contact || !isOwnProfile || !user) {
      return contact;
    }

    return {
      ...contact,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      position: user.position,
      phone: user.phone,
      phoneInternal: user.phoneInternal,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    };
  }, [contact, isOwnProfile, user]);

  useEffect(() => {
    setIsBioExpanded(false);
    setFavoriteError(null);
  }, [profileContact]);

  const handleToggleFavorite = async () => {
    if (!contact || loadingFavorite) return;
    if (isOwnProfile) {
      setFavoriteError('Свой профиль нельзя добавить в избранное.');
      return;
    }

    setLoadingFavorite(true);
    setFavoriteError(null);
    try {
      await onFavoriteChange(contact.id, !isFavorite);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      const message =
        typeof error === 'object' &&
        error &&
        'response' in error &&
        typeof (error as { response?: { data?: ApiResponse<unknown> } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: ApiResponse<unknown> } }).response?.data?.message
          : 'Не удалось обновить избранное.';
      setFavoriteError(message ?? 'Не удалось обновить избранное.');
    } finally {
      setLoadingFavorite(false);
    }
  };

   const handleCompose = () => {
     if (!contact) return;
     startCompose([contact.id]);
   };
   
   const toggleBio = () => {
     setIsBioExpanded(!isBioExpanded);
   };
  
  const handleOpenEditDialog = () => {
    if (!profileContact) return;
    setEditPhone(formatRussianPhone(profileContact.phone));
    setEditBio(profileContact.bio || '');
    setEditError(null);
    setEditDialogOpen(true);
  };
  
  const handleSaveProfile = async () => {
    if (editPhone && !isValidRussianPhone(editPhone)) {
      setEditError(`Телефон должен быть в формате ${RUSSIAN_PHONE_PLACEHOLDER}`);
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const updatedUser = await contactService.updateProfile({
        phone: editPhone || undefined,
        bio: editBio || undefined,
      });
      // Update user in auth store
      if (updatedUser) {
        setUser(updatedUser);
      }
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setEditError('Ошибка сохранения профиля');
    } finally {
      setSaving(false);
    }
  };

  if (!profileContact) {
    return (
      <Box
        sx={{
          height: '100%',
          minHeight: 0,
          px: { xs: 2, md: 3.2 },
          py: { xs: 2, md: 3.2 },
        }}
      >
        <Box sx={shellEmptyStateSx}>
          <Box>
            <Typography variant="h6" sx={{ mb: 0.8, color: 'text.primary' }}>
              Выберите сотрудника из списка
            </Typography>
            <Typography color="text.secondary">
              Карточка контакта откроется здесь в том же спокойном формате, что и в разделе сообщений.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  const fullName = [profileContact.lastName, profileContact.firstName, profileContact.middleName]
    .filter(Boolean)
    .join(' ');

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'transparent',
        overflow: 'hidden',
        gap: 1.5,
      }}
    >
      {/* Header with avatar and name */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.2, lg: 2.6 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'center', md: 'flex-start' },
          flexShrink: 0,
          borderRadius: 0,
          boxShadow: 'none',
          gap: { xs: 2, md: 2.6 },
          ...shellPanelHeaderSx,
        }}
      >
        <Avatar
          src={resolveMediaUrl(profileContact.avatarUrl)}
          sx={{
            width: { xs: 92, lg: 104 },
            height: { xs: 92, lg: 104 },
            flexShrink: 0,
            fontSize: { xs: '2.2rem', lg: '2.7rem' },
            bgcolor: alpha('#1d7a8f', 0.18),
            color: 'primary.dark',
            boxShadow: '0 18px 34px rgba(29, 122, 143, 0.16)',
          }}
        >
          {profileContact.firstName[0]}
        </Avatar>

        <Box
          sx={{
            minWidth: 0,
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', md: 'flex-start' },
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <Typography variant="h5" fontWeight="bold" sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            {fullName}
          </Typography>

          {profileContact.position && (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              {profileContact.position}
            </Typography>
          )}

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', md: 'flex-start' },
              gap: 1,
            }}
          >
            {profileContact.department && (
              <Chip
                icon={<Business />}
                label={profileContact.department.name}
                size="small"
              />
            )}

            {isOwnProfile && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Edit />}
                onClick={handleOpenEditDialog}
              >
                Редактировать профиль
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Contact info */}
      <Box
        sx={{
          p: { xs: 2, lg: 2.4 },
          flexGrow: 1,
          overflow: 'auto',
          minHeight: 0,
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <Typography variant="overline" color="text.secondary" gutterBottom>
          Контактная информация
        </Typography>

        <Box
          sx={{
            mt: 1.4,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.4,
            alignItems: 'start',
          }}
        >
          {/* Email */}
          <Box sx={{ ...shellInsetSurfaceSx, display: 'flex', alignItems: 'flex-start', p: 1.45, minWidth: 0 }}>
            <Email color="action" sx={{ mr: 2 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {profileContact.email}
              </Typography>
            </Box>
          </Box>

          {/* Phone */}
          {profileContact.phone && (
            <Box sx={{ ...shellInsetSurfaceSx, display: 'flex', alignItems: 'flex-start', p: 1.45, minWidth: 0 }}>
              <PhoneAndroid color="action" sx={{ mr: 2 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  Телефон
                </Typography>
                <Typography variant="body2">{formatRussianPhone(profileContact.phone)}</Typography>
              </Box>
            </Box>
          )}

          {/* Internal phone */}
          {profileContact.phoneInternal && (
            <Box sx={{ ...shellInsetSurfaceSx, display: 'flex', alignItems: 'flex-start', p: 1.45, minWidth: 0 }}>
              <Phone color="action" sx={{ mr: 2 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  Внутренний номер
                </Typography>
                <Typography variant="body2">{profileContact.phoneInternal}</Typography>
              </Box>
            </Box>
          )}

          {/* Bio */}
          {profileContact.bio && (
            <Box
              sx={{
                gridColumn: { xs: 'auto', lg: '1 / -1' },
                minWidth: 0,
              }}
            >
              <Divider sx={{ mb: 1.4 }} />
              <Typography variant="overline" color="text.secondary" gutterBottom>
                О сотруднике
              </Typography>
              <Box sx={{ ...shellInnerPanelSx, mt: 0.8, p: 1.6 }}>
                <Typography
                  variant="body2"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: isBioExpanded ? 'unset' : 4,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.5,
                  }}
                >
                  {profileContact.bio}
                </Typography>
                {profileContact.bio.length > 200 && (
                  <Button
                    size="small"
                    onClick={toggleBio}
                    sx={{ mt: 1, textTransform: 'none' }}
                  >
                    {isBioExpanded ? 'Скрыть' : 'Показать полностью'}
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Actions */}
      <Box
        sx={{
          ...shellInnerPanelSx,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0,
        }}
      >
        {favoriteError && (
          <Alert severity={isOwnProfile ? 'info' : 'error'} onClose={() => setFavoriteError(null)}>
            {favoriteError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Email />}
            onClick={handleCompose}
            sx={{ flexGrow: 1 }}
          >
            Написать сообщение
          </Button>
          <Button
            variant={isFavorite ? 'contained' : 'outlined'}
            color={isFavorite ? 'warning' : 'inherit'}
            onClick={handleToggleFavorite}
            disabled={loadingFavorite || isOwnProfile}
            startIcon={isFavorite ? <Star /> : <StarBorder />}
          >
            {isFavorite ? 'В избранном' : 'Избранное'}
          </Button>
        </Box>
        {isOwnProfile && (
          <Typography variant="caption" color="text.secondary">
            Собственный профиль нельзя закрепить в списке контактов.
          </Typography>
        )}
      </Box>
      
      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Редактирование профиля
          <IconButton onClick={() => setEditDialogOpen(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            <TextField
              label="Телефон"
              fullWidth
              value={editPhone}
              onChange={(e) => setEditPhone(formatRussianPhone(e.target.value))}
              placeholder={RUSSIAN_PHONE_PLACEHOLDER}
              inputMode="tel"
              helperText="Формат: +7-999-999-99-99"
            />
            <TextField
              label="О себе"
              fullWidth
              multiline
              rows={4}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Расскажите немного о себе..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} color="inherit">
            Отмена
          </Button>
          <Button onClick={handleSaveProfile} variant="contained" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContactDetail;
