import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { PhotoCamera, RestartAlt, Save } from '@mui/icons-material';
import { contactService } from '../services';
import { useAuthStore } from '../store/authStore';
import type { ApiResponse, User } from '../types';
import { shellPanelSx } from '../styles/shell';
import { resolveMediaUrl } from '../utils/media';

type ProfileFormState = {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  position: string;
  phone: string;
  phoneInternal: string;
  bio: string;
};

function toFormState(user: User | null): ProfileFormState {
  return {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    middleName: user?.middleName ?? '',
    email: user?.email ?? '',
    position: user?.position ?? '',
    phone: user?.phone ?? '',
    phoneInternal: user?.phoneInternal ?? '',
    bio: user?.bio ?? '',
  };
}

function normalizeNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiResponse>(error)) {
    const message = error.response?.data?.message;
    if (message) {
      return message;
    }
  }
  return fallback;
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(user));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(toFormState(user));
  }, [user]);

  const userInitials = useMemo(() => {
    if (!user) return '';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }, [user]);

  const handleChange = (field: keyof ProfileFormState) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleSave = async () => {
    if (!user) return;

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();

    if (!firstName || !lastName || !email) {
      setSaveError('Имя, фамилия и email обязательны');
      setSaveSuccess(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const updatedUser = await contactService.updateProfile({
        firstName,
        lastName,
        middleName: normalizeNullable(form.middleName),
        email,
        position: normalizeNullable(form.position),
        phone: normalizeNullable(form.phone),
        phoneInternal: normalizeNullable(form.phoneInternal),
        bio: normalizeNullable(form.bio),
      });
      setUser(updatedUser);
      setForm(toFormState(updatedUser));
      setSaveSuccess('Профиль успешно обновлён');
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось сохранить профиль'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm(toFormState(user));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleUploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploadingAvatar(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const result = await contactService.uploadAvatar(file);
      setUser(result.user);
      setSaveSuccess('Фотография профиля обновлена');
    } catch (error) {
      setSaveError(getErrorMessage(error, 'Не удалось загрузить фотографию'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pr: 0.5 }}>
      <Card sx={{ ...shellPanelSx, mb: 2.2 }}>
        <CardContent sx={{ px: 3, py: 2.6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Настройки профиля
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Измените личные данные, фотографию, должность и контактную информацию.
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={shellPanelSx}>
            <CardContent>
              <Stack spacing={2} alignItems="center">
                <Avatar
                  data-testid="settings-profile-avatar"
                  src={resolveMediaUrl(user?.avatarUrl)}
                  sx={{ width: 132, height: 132, bgcolor: 'primary.main', fontSize: '2.8rem' }}
                >
                  {userInitials}
                </Avatar>
                <Typography variant="h6" sx={{ textAlign: 'center' }}>
                  {[form.lastName, form.firstName, form.middleName].filter(Boolean).join(' ')}
                </Typography>
                {user?.department && (
                  <Typography variant="body2" color="text.secondary">
                    {user.department}
                  </Typography>
                )}
                <Button
                  variant="outlined"
                  startIcon={isUploadingAvatar ? <CircularProgress size={16} /> : <PhotoCamera />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  fullWidth
                >
                  {isUploadingAvatar ? 'Загрузка...' : 'Изменить фотографию'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadAvatar}
                  style={{ display: 'none' }}
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={shellPanelSx}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Фамилия" fullWidth value={form.lastName} onChange={handleChange('lastName')} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Имя" fullWidth value={form.firstName} onChange={handleChange('firstName')} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Отчество" fullWidth value={form.middleName} onChange={handleChange('middleName')} />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Должность" fullWidth value={form.position} onChange={handleChange('position')} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Email"
                    type="email"
                    fullWidth
                    value={form.email}
                    onChange={handleChange('email')}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField label="Телефон" fullWidth value={form.phone} onChange={handleChange('phone')} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Внутренний номер"
                    fullWidth
                    value={form.phoneInternal}
                    onChange={handleChange('phoneInternal')}
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    label="О себе"
                    fullWidth
                    multiline
                    minRows={4}
                    value={form.bio}
                    onChange={handleChange('bio')}
                  />
                </Grid>
              </Grid>

              {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
              {saveSuccess && <Alert severity="success" sx={{ mt: 2 }}>{saveSuccess}</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 2.2 }}>
                <Button
                  variant="contained"
                  startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
                  onClick={handleSave}
                  disabled={isSaving || isUploadingAvatar}
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<RestartAlt />}
                  onClick={handleReset}
                  disabled={isSaving || isUploadingAvatar}
                >
                  Сбросить изменения
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
