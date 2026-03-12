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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
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
import DepartmentFormDialog from '../components/DepartmentFormDialog';
import UserFormDialog from '../components/UserFormDialog';
import { contactService, userService } from '../services';
import { useAuthStore } from '../store/authStore';
import { shellPanelHeaderSx, shellPanelSx } from '../styles/shell';
import type { Department, User } from '../types';

const MIN_USERS_PER_PAGE = 6;
const FALLBACK_HEADER_HEIGHT = 56;
const FALLBACK_ROW_HEIGHT = 82;

const normalizeValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

const getUserFullName = (user: Pick<User, 'firstName' | 'lastName' | 'middleName'>) =>
  [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ');

const getDepartmentHeadName = (department: Department) =>
  department.head ? [department.head.lastName, department.head.firstName].filter(Boolean).join(' ') : '';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.isAdmin ?? false;
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
  const [searchValue, setSearchValue] = useState('');
  const [departmentSearchValue, setDepartmentSearchValue] = useState('');
  const [pageSelection, setPageSelection] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(MIN_USERS_PER_PAGE);
  const [departmentSortDirection, setDepartmentSortDirection] = useState<'asc' | 'desc'>('asc');

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userDeleteDialogOpen, setUserDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [departmentFormOpen, setDepartmentFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentDeleteDialogOpen, setDepartmentDeleteDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; user: User | null; newPassword?: string }>({
    open: false,
    user: null,
  });

  const {
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAll(1, 1000),
  });

  const {
    data: departments = [],
    isLoading: departmentsLoading,
    error: departmentsError,
  } = useQuery<Department[]>({
    queryKey: ['departments', 'users-page'],
    queryFn: contactService.getDepartments,
    enabled: isAdmin,
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => userService.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setUserDeleteDialogOpen(false);
      setUserToDelete(null);
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: (id: string) => contactService.deleteDepartment(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['departments'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]);
      setDepartmentDeleteDialogOpen(false);
      setDepartmentToDelete(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => userService.resetPassword(id),
    onSuccess: (result) => {
      setResetPasswordDialog((prev) => ({ ...prev, newPassword: result.generatedPassword }));
    },
  });

  const users = useMemo(() => usersResponse?.data ?? [], [usersResponse?.data]);

  const departmentParentNameById = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments]
  );

  const departmentChildCountById = useMemo(() => {
    const next = new Map<string, number>();
    for (const department of departments) {
      if (!department.parentId) {
        continue;
      }

      next.set(department.parentId, (next.get(department.parentId) ?? 0) + 1);
    }
    return next;
  }, [departments]);

  const userSearchTerms = useMemo(
    () => searchValue.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [searchValue]
  );

  const filteredUsers = useMemo(() => {
    const matchesSearch = (user: User) => {
      if (userSearchTerms.length === 0) {
        return true;
      }

      const haystacks = [
        normalizeValue(getUserFullName(user)),
        normalizeValue(user.email),
        normalizeValue(user.position),
        normalizeValue(user.department),
      ];

      return userSearchTerms.every((term) => haystacks.some((value) => value.includes(term)));
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
  }, [departmentSortDirection, userSearchTerms, users]);

  const departmentSearchTerms = useMemo(
    () => departmentSearchValue.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [departmentSearchValue]
  );

  const filteredDepartments = useMemo(() => {
    const matchesSearch = (department: Department) => {
      if (departmentSearchTerms.length === 0) {
        return true;
      }

      const haystacks = [
        normalizeValue(department.name),
        normalizeValue(department.description),
        normalizeValue(department.parentId ? departmentParentNameById.get(department.parentId) : 'корневое'),
        normalizeValue(getDepartmentHeadName(department)),
      ];

      return departmentSearchTerms.every((term) => haystacks.some((value) => value.includes(term)));
    };

    return [...departments]
      .filter(matchesSearch)
      .sort((left, right) => {
        if (left.order !== right.order) {
          return left.order - right.order;
        }
        return left.name.localeCompare(right.name, 'ru');
      });
  }, [departmentParentNameById, departmentSearchTerms, departments]);

  useEffect(() => {
    if (!isAdmin && activeTab !== 'users') {
      setActiveTab('users');
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab !== 'users') {
      return undefined;
    }

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
  }, [activeTab, filteredUsers.length]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const currentPage = Math.min(pageSelection, totalPages);

  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * usersPerPage;
    return filteredUsers.slice(start, start + usersPerPage);
  }, [currentPage, filteredUsers, usersPerPage]);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const departmentChildrenToMove = departmentToDelete ? departmentChildCountById.get(departmentToDelete.id) ?? 0 : 0;
  const departmentEmployeesToDetach = departmentToDelete?.employeeCount ?? 0;

  const handleOpenUserForm = (user: User | null) => {
    setEditingUser(user);
    setUserFormOpen(true);
  };

  const handleCloseUserForm = () => {
    setUserFormOpen(false);
    setEditingUser(null);
  };

  const handleOpenDepartmentForm = (department: Department | null) => {
    setEditingDepartment(department);
    setDepartmentFormOpen(true);
  };

  const handleCloseDepartmentForm = () => {
    setDepartmentFormOpen(false);
    setEditingDepartment(null);
  };

  const activeSearchValue = activeTab === 'users' ? searchValue : departmentSearchValue;
  const activeSearchPlaceholder =
    activeTab === 'users'
      ? 'Поиск по ФИО, email, должности и отделению'
      : 'Поиск по названию, описанию, руководителю и родителю';
  const addButtonLabel = activeTab === 'users' ? 'Добавить пользователя' : 'Добавить отделение';

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
            display: 'flex',
            flexDirection: 'column',
            gap: 1.2,
          }}
        >
          {isAdmin && (
            <Tabs
              value={activeTab}
              onChange={(_event, value: 'users' | 'departments') => setActiveTab(value)}
              sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, px: 1.5 } }}
            >
              <Tab value="users" label="Пользователи" />
              <Tab value="departments" label="Отделения" />
            </Tabs>
          )}

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              gap: 1.2,
              alignItems: { xs: 'stretch', lg: 'center' },
            }}
          >
            {activeTab === 'users' ? (
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
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                Найдено {filteredDepartments.length} из {departments.length}
              </Typography>
            )}

            <TextField
              size="small"
              value={activeSearchValue}
              onChange={(event) => {
                if (activeTab === 'users') {
                  setSearchValue(event.target.value);
                  setPageSelection(1);
                } else {
                  setDepartmentSearchValue(event.target.value);
                }
              }}
              placeholder={activeSearchPlaceholder}
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
              onClick={() => (activeTab === 'users' ? handleOpenUserForm(null) : handleOpenDepartmentForm(null))}
              sx={{
                alignSelf: { xs: 'stretch', lg: 'center' },
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: { xs: '100%', lg: 220 },
              }}
            >
              {addButtonLabel}
            </Button>
          </Box>
        </Box>

        {activeTab === 'users' ? (
          usersLoading ? (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : usersError ? (
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
                            <IconButton size="small" onClick={() => {
                              setResetPasswordDialog({ open: true, user, newPassword: undefined });
                              resetPasswordMutation.mutate(user.id);
                            }}>
                              <KeyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Редактировать">
                            <IconButton size="small" onClick={() => handleOpenUserForm(user)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setUserToDelete(user);
                                setUserDeleteDialogOpen(true);
                              }}
                            >
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
          )
        ) : departmentsLoading ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : departmentsError ? (
          <Alert severity="error" sx={{ m: 2 }}>
            Ошибка загрузки отделений
          </Alert>
        ) : (
          <TableContainer
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
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Название</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Родитель</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Руководитель</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Сотрудники</TableCell>
                  <TableCell sx={{ backgroundColor: 'transparent' }}>Порядок</TableCell>
                  <TableCell align="right" sx={{ minWidth: 120, backgroundColor: 'transparent' }}>
                    Действия
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDepartments.map((department) => {
                  const childCount = departmentChildCountById.get(department.id) ?? 0;
                  const parentName = department.parentId ? departmentParentNameById.get(department.parentId) ?? '—' : 'Корневое';
                  const headName = getDepartmentHeadName(department);

                  return (
                    <TableRow key={department.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {department.name}
                          </Typography>
                          {department.description && (
                            <Typography variant="caption" color="text.secondary">
                              {department.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                          <Typography variant="body2">{parentName}</Typography>
                          {childCount > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              Дочерних отделений: {childCount}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{headName || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={`${department.employeeCount ?? 0} сотрудников`}
                          color={(department.employeeCount ?? 0) > 0 ? 'primary' : 'default'}
                          variant={(department.employeeCount ?? 0) > 0 ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>{department.order}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'nowrap' }}>
                          <Tooltip title="Редактировать">
                            <IconButton size="small" onClick={() => handleOpenDepartmentForm(department)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setDepartmentToDelete(department);
                                setDepartmentDeleteDialogOpen(true);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredDepartments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                      {departmentSearchValue.trim() ? 'Отделения не найдены' : 'Отделения появятся здесь после загрузки'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <UserFormDialog open={userFormOpen} onClose={handleCloseUserForm} user={editingUser} />

      <DepartmentFormDialog
        open={departmentFormOpen}
        onClose={handleCloseDepartmentForm}
        department={editingDepartment}
        departments={departments}
        users={users}
      />

      <Dialog open={userDeleteDialogOpen} onClose={() => setUserDeleteDialogOpen(false)}>
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
          <Button onClick={() => setUserDeleteDialogOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
            disabled={deleteUserMutation.isPending}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={departmentDeleteDialogOpen} onClose={() => setDepartmentDeleteDialogOpen(false)}>
        <DialogTitle>Удалить отделение?</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Вы уверены, что хотите удалить отделение <strong>{departmentToDelete?.name}</strong>?
          </Typography>
          <Typography color="text.secondary">
            Сотрудников без привязки к отделению: {departmentEmployeesToDetach}. Дочерних отделений будет поднято на уровень выше:{' '}
            {departmentChildrenToMove}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepartmentDeleteDialogOpen(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => departmentToDelete && deleteDepartmentMutation.mutate(departmentToDelete.id)}
            disabled={deleteDepartmentMutation.isPending}
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
