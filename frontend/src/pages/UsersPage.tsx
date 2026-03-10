import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Check as CheckIcon,
  ChevronLeft,
  ChevronRight,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Key as KeyIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { userService } from '../services';
import type { User } from '../types';
import UserFormDialog from '../components/UserFormDialog';
import { shellPanelHeaderSx, shellPanelSx } from '../styles/shell';

const MIN_USERS_PER_PAGE = 6;
const FALLBACK_HEADER_HEIGHT = 56;
const FALLBACK_ROW_HEIGHT = 82;

const normalizeValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

const getUserFullName = (user: User) =>
  [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ');

export default function UsersPage() {
  const queryClient = useQueryClient();
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [pageSelection, setPageSelection] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(MIN_USERS_PER_PAGE);
  const [departmentSortDirection, setDepartmentSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; user: User | null; newPassword?: string }>({
    open: false,
    user: null,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(1, 1000),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => userService.resetPassword(id),
    onSuccess: (result) => {
      setResetPasswordDialog((prev) => ({ ...prev, newPassword: result.generatedPassword }));
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordDialog({ open: true, user, newPassword: undefined });
    resetPasswordMutation.mutate(user.id);
  };

  const users = useMemo(() => data?.data ?? [], [data?.data]);
  const searchTerms = useMemo(
    () => searchValue.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [searchValue]
  );

  const filteredUsers = useMemo(() => {
    const matchesSearch = (user: User) => {
      if (searchTerms.length === 0) {
        return true;
      }

      const haystacks = [
        normalizeValue(getUserFullName(user)),
        normalizeValue(user.email),
        normalizeValue(user.position),
        normalizeValue(user.department),
      ];

      return searchTerms.every((term) => haystacks.some((value) => value.includes(term)));
    };

    const directionFactor = departmentSortDirection === 'asc' ? 1 : -1;

    return [...users]
      .filter(matchesSearch)
      .sort((left, right) => {
        const departmentCompare = normalizeValue(left.department).localeCompare(normalizeValue(right.department), 'ru');
        if (departmentCompare !== 0) {
          return departmentCompare * directionFactor;
        }

        return getUserFullName(left).localeCompare(getUserFullName(right), 'ru');
      });
  }, [departmentSortDirection, searchTerms, users]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) {
      return undefined;
    }

    let frameId = 0;

    const recalculateUsersPerPage = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const tableHead = container.querySelector('thead');
        const firstBodyRow = container.querySelector('tbody tr');

        const headerHeight =
          tableHead instanceof HTMLElement ? tableHead.getBoundingClientRect().height : FALLBACK_HEADER_HEIGHT;
        const rowHeight =
          firstBodyRow instanceof HTMLElement ? firstBodyRow.getBoundingClientRect().height : FALLBACK_ROW_HEIGHT;

        const availableHeight = Math.max(0, container.clientHeight - headerHeight);
        const nextUsersPerPage = Math.max(
          MIN_USERS_PER_PAGE,
          Math.floor(availableHeight / Math.max(rowHeight, 1))
        );

        setUsersPerPage((prev) => (prev === nextUsersPerPage ? prev : nextUsersPerPage));
      });
    };

    recalculateUsersPerPage();

    const resizeObserver = new ResizeObserver(recalculateUsersPerPage);
    resizeObserver.observe(container);

    window.addEventListener('resize', recalculateUsersPerPage);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', recalculateUsersPerPage);
    };
  }, [filteredUsers.length]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const currentPage = Math.min(pageSelection, totalPages);

  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * usersPerPage;
    return filteredUsers.slice(start, start + usersPerPage);
  }, [currentPage, filteredUsers, usersPerPage]);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <Box sx={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Card sx={{ ...shellPanelSx, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box
          sx={{
            ...shellPanelHeaderSx,
            p: 1.6,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 1.2, alignItems: { xs: 'stretch', lg: 'center' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexShrink: 0, flexWrap: 'wrap' }}>
              <IconButton size="small" onClick={() => setPageSelection((prev) => Math.max(1, prev - 1))} disabled={!canGoPrev}>
                <ChevronLeft />
              </IconButton>
              <TextField
                select
                size="small"
                label="Страница"
                value={currentPage}
                onChange={(event) => setPageSelection(Number(event.target.value))}
                sx={{ minWidth: 144 }}
              >
                {Array.from({ length: totalPages }, (_, index) => (
                  <MenuItem key={index + 1} value={index + 1}>
                    {index + 1} / {totalPages}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton
                size="small"
                onClick={() => setPageSelection((prev) => Math.min(totalPages, prev + 1))}
                disabled={!canGoNext}
              >
                <ChevronRight />
              </IconButton>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                Показано {pagedUsers.length} из {filteredUsers.length}
              </Typography>
            </Box>

            <TextField
              size="small"
              value={searchValue}
              onChange={(event) => {
                setSearchValue(event.target.value);
                setPageSelection(1);
              }}
              placeholder="Поиск по ФИО, email, должности и отделению"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingUser(null);
                setFormOpen(true);
              }}
              sx={{
                alignSelf: { xs: 'stretch', lg: 'center' },
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: { xs: '100%', lg: 220 },
              }}
            >
              Добавить пользователя
            </Button>
          </Box>
        </Box>

        {isLoading ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Ошибка загрузки пользователей
          </Alert>
        ) : (
          <TableContainer
            ref={tableContainerRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              px: 1,
              pb: 1,
              '&::-webkit-scrollbar': {
                display: 'none',
              },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>ФИО</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Email</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Должность</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>
                    <TableSortLabel
                      active
                      direction={departmentSortDirection}
                      onClick={() => {
                        setDepartmentSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        setPageSelection(1);
                      }}
                    >
                      Отделение
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Статус</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Роль</TableCell>
                  <TableCell align="right" sx={{ minWidth: 160, backgroundColor: 'transparent' }}>
                    Действия
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedUsers.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>{getUserFullName(user)}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.position || '—'}</TableCell>
                    <TableCell>{user.department || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={user.isActive ? <CheckIcon /> : <CloseIcon />}
                        label={user.isActive ? 'Активен' : 'Неактивен'}
                        color={user.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Chip size="small" label="Админ" color="primary" />
                      ) : (
                        <Chip size="small" label="Пользователь" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 160 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'nowrap' }}>
                        <Tooltip title="Сбросить пароль">
                          <IconButton size="small" onClick={() => handleResetPassword(user)}>
                            <KeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Редактировать">
                          <IconButton size="small" onClick={() => handleEdit(user)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                          <IconButton size="small" color="error" onClick={() => handleDelete(user)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {pagedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                      {searchValue.trim() ? 'Пользователи не найдены' : 'Пользователи появятся здесь после загрузки'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <UserFormDialog open={formOpen} onClose={() => setFormOpen(false)} user={editingUser} />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Удалить пользователя?</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить пользователя{' '}
            <strong>
              {userToDelete?.lastName} {userToDelete?.firstName}
            </strong>
            ? Это действие необратимо.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => userToDelete && deleteMutation.mutate(userToDelete.id)}
            disabled={deleteMutation.isPending}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetPasswordDialog.open} onClose={() => setResetPasswordDialog({ open: false, user: null })}>
        <DialogTitle>Новый пароль</DialogTitle>
        <DialogContent>
          {resetPasswordMutation.isPending ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress />
            </Box>
          ) : resetPasswordDialog.newPassword ? (
            <>
              <Typography gutterBottom>
                Новый пароль для пользователя{' '}
                <strong>
                  {resetPasswordDialog.user?.lastName} {resetPasswordDialog.user?.firstName}
                </strong>
                :
              </Typography>
              <TextField fullWidth value={resetPasswordDialog.newPassword} InputProps={{ readOnly: true }} sx={{ mt: 2 }} />
              <Alert severity="warning" sx={{ mt: 2 }}>
                Сохраните этот пароль! После закрытия окна он не будет доступен.
              </Alert>
            </>
          ) : (
            <Typography>Ошибка генерации пароля</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialog({ open: false, user: null })}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
