import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { contactService } from '../services';
import type { Department, User } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  department: Department | null;
  departments: Department[];
  users: User[];
}

interface FormData {
  name: string;
  description: string;
  parentId: string;
  headId: string;
  order: number;
  color: string;
}

const getUserFullName = (user: Pick<User, 'firstName' | 'lastName' | 'middleName'>) =>
  [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ');

export default function DepartmentFormDialog({ open, onClose, department, departments, users }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!department;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      description: '',
      parentId: '',
      headId: '',
      order: 0,
      color: '',
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({
      name: department?.name ?? '',
      description: department?.description ?? '',
      parentId: department?.parentId ?? '',
      headId: department?.headId ?? '',
      order: department?.order ?? 0,
      color: department?.color ?? '',
    });
  }, [department, open, reset]);

  const blockedParentIds = useMemo(() => {
    if (!department) {
      return new Set<string>();
    }

    const ids = new Set<string>([department.id]);
    let hasChanges = true;

    while (hasChanges) {
      hasChanges = false;
      for (const candidate of departments) {
        if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
          ids.add(candidate.id);
          hasChanges = true;
        }
      }
    }

    return ids;
  }, [department, departments]);

  const availableParentDepartments = useMemo(
    () =>
      departments
        .filter((candidate) => !blockedParentIds.has(candidate.id))
        .sort((left, right) => {
          if (left.order !== right.order) {
            return left.order - right.order;
          }
          return left.name.localeCompare(right.name, 'ru');
        }),
    [blockedParentIds, departments]
  );

  const availableHeads = useMemo(
    () =>
      [...users].sort((left, right) => getUserFullName(left).localeCompare(getUserFullName(right), 'ru')),
    [users]
  );

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name.trim(),
        description: data.description.trim() || (isEditing ? null : undefined),
        parentId: data.parentId || (isEditing ? null : undefined),
        headId: data.headId || (isEditing ? null : undefined),
        order: Number.isFinite(data.order) ? data.order : 0,
        color: data.color.trim() || (isEditing ? null : undefined),
      };

      if (isEditing && department) {
        return contactService.updateDepartment(department.id, payload);
      }

      return contactService.createDepartment(payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['departments'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
      onClose();
    },
  });

  const errorMessage = (() => {
    if (!saveMutation.error) {
      return null;
    }

    if (axios.isAxiosError<{ message?: string }>(saveMutation.error)) {
      return saveMutation.error.response?.data?.message || 'Ошибка сохранения отделения';
    }

    return 'Ошибка сохранения отделения';
  })();

  const onSubmit = (data: FormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onClose={() => !saveMutation.isPending && onClose()} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          {isEditing ? 'Редактировать отделение' : 'Новое отделение'}
        </DialogTitle>
        <DialogContent sx={{ maxHeight: '80vh', overflowY: 'auto', px: 2, py: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {errorMessage}
            </Alert>
          )}

          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 7 }}>
              <TextField
                fullWidth
                size="small"
                label="Название *"
                {...register('name', {
                  required: 'Обязательное поле',
                  validate: (value) => value.trim().length > 0 || 'Обязательное поле',
                })}
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Порядок"
                {...register('order', { valueAsNumber: true })}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="parentId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Родительское отделение</InputLabel>
                    <Select
                      {...field}
                      label="Родительское отделение"
                      value={field.value || ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      <MenuItem value="">
                        <em>Корневое отделение</em>
                      </MenuItem>
                      {availableParentDepartments.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Controller
                name="headId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth size="small">
                    <InputLabel>Руководитель</InputLabel>
                    <Select
                      {...field}
                      label="Руководитель"
                      value={field.value || ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      <MenuItem value="">
                        <em>Не выбран</em>
                      </MenuItem>
                      {availableHeads.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {getUserFullName(item)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="Описание"
                multiline
                minRows={3}
                {...register('description')}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="Цвет"
                placeholder="#1D7A8F"
                {...register('color')}
                helperText="Необязательно. HEX-цвет для связанных представлений."
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  height: '100%',
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  bgcolor: 'rgba(29, 122, 143, 0.08)',
                  border: '1px solid rgba(29, 122, 143, 0.18)',
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Что изменится при удалении
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Сотрудники отдела останутся в системе без привязки к отделению, а дочерние отделения перейдут на уровень выше.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={saveMutation.isPending}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
