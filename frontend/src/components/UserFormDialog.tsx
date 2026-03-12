import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useForm, Controller, useWatch } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormGroup,
  Checkbox,
  Typography,
  Box,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { userService, contactService } from '../services';
import type { User, CreateUserRequest, Permission, Department } from '../types';
import { formatRussianPhone, isValidRussianPhone, RUSSIAN_PHONE_PLACEHOLDER } from '../utils/phone';

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

interface FormData {
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  position: string;
  departmentId: string;
  phone: string;
  password: string;
  isAdmin: boolean;
  isActive: boolean;
  permissions: string[];
}

export default function UserFormDialog({ open, onClose, user }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!user;
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: userService.getPermissions,
    enabled: open,
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments', 'user-form'],
    queryFn: contactService.getDepartments,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      middleName: '',
      position: '',
      departmentId: '',
      phone: '',
      password: '',
      isAdmin: false,
      isActive: true,
      permissions: [],
    },
  });

  const isAdmin = useWatch({ control, name: 'isAdmin' });

  useEffect(() => {
    if (open) {
      if (user) {
        reset({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          middleName: user.middleName || '',
          position: user.position || '',
          departmentId: user.departmentId || '',
          phone: formatRussianPhone(user.phone),
          password: '',
          isAdmin: user.isAdmin,
          isActive: user.isActive,
          permissions: user.permissions,
        });
      } else {
        reset({
          email: '',
          firstName: '',
          lastName: '',
          middleName: '',
          position: '',
          departmentId: '',
          phone: '',
          password: '',
          isAdmin: false,
          isActive: true,
          permissions: [],
        });
      }
      const timer = window.setTimeout(() => {
        setGeneratedPassword(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, user, reset]);

  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => userService.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (result.generatedPassword) {
        setGeneratedPassword(result.generatedPassword);
      } else {
        onClose();
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormData> }) =>
      userService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      const updateData: Partial<FormData> = { ...data };
      delete updateData.password;
      updateMutation.mutate({ id: user.id, data: updateData });
    } else {
      createMutation.mutate({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName || undefined,
        position: data.position || undefined,
        departmentId: data.departmentId || undefined,
        phone: data.phone || undefined,
        password: data.password || undefined,
        isAdmin: data.isAdmin,
        permissions: data.permissions,
      });
    }
  };

  const error = createMutation.error || updateMutation.error;
  const isLoading = createMutation.isPending || updateMutation.isPending;
  const errorMessage = (() => {
    if (!error) return null;
    if (axios.isAxiosError<{ message?: string }>(error)) {
      return error.response?.data?.message || 'Ошибка сохранения';
    }
    return 'Ошибка сохранения';
  })();

  // Группировка разрешений по категориям
  const permissionsByCategory = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const categoryNames: Record<string, string> = {
    tests: 'Тестирование',
    learning: 'Обучение',
    documents: 'Документы',
    messages: 'Сообщения',
    users: 'Пользователи',
  };

  if (generatedPassword) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
         <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}>
           Пользователь создан
         </DialogTitle>
         <DialogContent sx={{ bgcolor: 'grey.50', borderRadius: 1 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Пользователь успешно создан!
          </Alert>
          <Typography gutterBottom>
            Сгенерированный пароль для отправки пользователю:
          </Typography>
           <TextField
             fullWidth
             size="small"
             value={generatedPassword}
             slotProps={{ input: { readOnly: true } }}
             sx={{ mt: 1 }}
           />
          <Alert severity="warning" sx={{ mt: 2 }}>
            Сохраните этот пароль и передайте его пользователю! После закрытия окна он не будет доступен.
          </Alert>
         </DialogContent>
         <DialogActions sx={{ px: 3, py: 2 }}>
           <Button variant="contained" onClick={onClose}>
             Закрыть
           </Button>
         </DialogActions>
      </Dialog>
    );
  }

  return (
     <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
         <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}>
           {isEditing ? 'Редактировать пользователя' : 'Новый пользователь'}
         </DialogTitle>
           <DialogContent sx={{ maxHeight: '80vh', overflowY: 'auto', px: 2, py: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
           {error && (
             <Alert severity="error" sx={{ mb: 1.5 }}>
               {errorMessage}
             </Alert>
           )}

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {/* Левая колонка - основные поля */}
              <Grid size={{ xs: 12, md: isAdmin ? 12 : 6 }}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Фамилия *"
                      {...register('lastName', { required: 'Обязательное поле' })}
                      error={!!errors.lastName}
                      helperText={errors.lastName?.message}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Имя *"
                      {...register('firstName', { required: 'Обязательное поле' })}
                      error={!!errors.firstName}
                      helperText={errors.firstName?.message}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth size="small" label="Отчество" {...register('middleName')} />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Email *"
                      type="email"
                      {...register('email', {
                        required: 'Обязательное поле',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Некорректный email' },
                      })}
                      error={!!errors.email}
                      helperText={errors.email?.message}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="phone"
                      control={control}
                      rules={{
                        validate: (value) => isValidRussianPhone(value) || `Формат: ${RUSSIAN_PHONE_PLACEHOLDER}`,
                      }}
                      render={({ field }) => (
                        <TextField
                          fullWidth
                          size="small"
                          label="Телефон"
                          value={field.value || ''}
                          onChange={(event) => field.onChange(formatRussianPhone(event.target.value))}
                          inputMode="tel"
                          placeholder={RUSSIAN_PHONE_PLACEHOLDER}
                          error={!!errors.phone}
                          helperText={errors.phone?.message || ' '}
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth size="small" label="Должность" {...register('position')} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="departmentId"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth size="small">
                          <InputLabel>Отделение</InputLabel>
                          <Select
                            {...field}
                            label="Отделение"
                            value={field.value || ''}
                            onChange={(event) => field.onChange(event.target.value)}
                          >
                            <MenuItem value="">
                              <em>Не выбрано</em>
                            </MenuItem>
                            {departments.map((dept) => (
                              <MenuItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>

                  {!isEditing && (
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Пароль"
                        type="password"
                        {...register('password', {
                          minLength: { value: 8, message: 'Минимум 8 символов' },
                        })}
                        error={!!errors.password}
                        helperText={errors.password?.message || 'Оставьте пустым для автогенерации'}
                      />
                    </Grid>
                  )}

                  <Grid size={{ xs: 12 }}>
                    <Divider sx={{ my: 2, borderWidth: 1, borderColor: 'primary.light' }} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'nowrap' }}>
                      <Controller
                        name="isAdmin"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={<Switch {...field} checked={field.value} color="primary" size="small" />}
                            label={
                              <Box>
                                <Typography>Администратор</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Полный доступ ко всем функциям
                                </Typography>
                              </Box>
                            }
                          />
                        )}
                      />
                      {isEditing && (
                        <Controller
                          name="isActive"
                          control={control}
                          render={({ field }) => (
                            <FormControlLabel
                              control={<Switch {...field} checked={field.value} color="success" size="small" />}
                              label="Активен"
                            />
                          )}
                        />
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Grid>

              {/* Правая колонка - разрешения */}
              {!isAdmin && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                    Разрешения
                  </Typography>
                  <Controller
                    name="permissions"
                    control={control}
                    render={({ field }) => (
                      <Box>
                        {Object.entries(permissionsByCategory).map(([category, perms]) => (
                          <Box key={category} sx={{ mb: 1.5 }}>
                            <Chip
                              label={categoryNames[category] || category}
                              size="small"
                              sx={{
                                mb: 0.5,
                                fontWeight: 700,
                                bgcolor: 'rgba(29, 122, 143, 0.16)',
                                color: 'text.primary',
                                border: '1px solid rgba(29, 122, 143, 0.24)',
                              }}
                            />
                            <FormGroup row sx={{ '& .MuiFormControlLabel-root': { mr: 1.5, mb: 0.5 } }}>
                              {perms.map((perm) => (
                                <FormControlLabel
                                  key={perm.code}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={field.value.includes(perm.code)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          field.onChange([...field.value, perm.code]);
                                        } else {
                                          field.onChange(field.value.filter((c) => c !== perm.code));
                                        }
                                      }}
                                    />
                                  }
                                  label={
                                    <Box>
                                      <Typography variant="body2">{perm.name}</Typography>
                                    </Box>
                                  }
                                />
                              ))}
                            </FormGroup>
                          </Box>
                        ))}
                      </Box>
                    )}
                  />
                </Grid>
              )}
            </Grid>
         </DialogContent>
         <DialogActions sx={{ px: 3, py: 2 }}>
           <Button onClick={onClose}>Отмена</Button>
           <Button type="submit" variant="contained" disabled={isLoading}>
             {isLoading ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
           </Button>
         </DialogActions>
      </form>
    </Dialog>
  );
}
