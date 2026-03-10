import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import {
  Box,
  ButtonBase,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Message as MessageIcon,
  Description as DocumentIcon,
  School as SchoolIcon,
  Quiz as QuizIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  AccountTree as AccountTreeIcon,
  Contacts as ContactsIcon,
  CalendarMonth as CalendarMonthIcon,
} from '@mui/icons-material';
import { useAuthStore, useHasPermission } from '../store/authStore';
import { PermissionCodes } from '../types';
import ComposeDialog from './messages/compose/ComposeDialog';
import { resolveMediaUrl } from '../utils/media';

const mobileDrawerWidth = 288;
const desktopRevealDistance = 180;
const desktopRailSafeOffset = 84;

interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [desktopSidebarHovered, setDesktopSidebarHovered] = useState(false);
  const [desktopSidebarProximity, setDesktopSidebarProximity] = useState(0);
  const [desktopHoveredItem, setDesktopHoveredItem] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const canManageUsers = useHasPermission(PermissionCodes.USERS_MANAGE);

  const menuItems = [
    { text: 'Главная', icon: DashboardIcon, path: '/', show: true },
    { text: 'Сообщения', icon: MessageIcon, path: '/messages', show: true },
    { text: 'Контакты', icon: ContactsIcon, path: '/contacts', show: true },
    { text: 'Структура', icon: AccountTreeIcon, path: '/org-tree', show: true },
    { text: 'Пользователи', icon: PeopleIcon, path: '/users', show: canManageUsers },
    { text: 'Документы', icon: DocumentIcon, path: '/documents', show: true },
    { text: 'Обучение', icon: SchoolIcon, path: '/learning', show: true },
    { text: 'Тестирование', icon: QuizIcon, path: '/tests', show: true },
    { text: 'Настройки', icon: SettingsIcon, path: '/settings', show: false },
  ];

  const visibleMenuItems = menuItems.filter((item) => item.show);

  useEffect(() => {
    if (isMobile) {
      return;
    }

    let frameId = 0;
    let lastProximity = -1;

    const handleMouseMove = (event: MouseEvent) => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        const nextProximity = Math.max(0, 1 - Math.min(event.clientX, desktopRevealDistance) / desktopRevealDistance);

        if (Math.abs(nextProximity - lastProximity) > 0.015) {
          lastProximity = nextProximity;
          setDesktopSidebarProximity(nextProximity);
        }

        if (event.clientX <= 18) {
          setDesktopSidebarOpen(true);
          return;
        }

        if (!desktopSidebarHovered && event.clientX > 280) {
          setDesktopSidebarOpen(false);
        }
      });
    };

    const handleWindowLeave = () => {
      if (!desktopSidebarHovered) {
        setDesktopSidebarOpen(false);
        setDesktopSidebarProximity(0);
        lastProximity = 0;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleWindowLeave);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleWindowLeave);
    };
  }, [desktopSidebarHovered, isMobile]);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const userFullName = user
    ? [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ')
    : '';
  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U'
    : '';
  const currentDateLabel = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const isMenuItemActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const activeMenuItem = menuItems.find((item) => isMenuItemActive(item.path));
  const desktopRailIntensity = desktopSidebarOpen ? 1 : desktopSidebarProximity;

  const mobileDrawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background:
          'linear-gradient(180deg, rgba(17,44,61,0.98) 0%, rgba(22,59,78,0.96) 55%, rgba(20,70,90,0.94) 100%)',
        color: '#eff9ff',
        px: 1.4,
        py: 1.8,
      }}
    >
      <Box sx={{ px: 1, pb: 1.6 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.22em',
            color: 'rgba(227, 242, 251, 0.58)',
            mb: 0.5,
          }}
        >
          Навигация
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Hospital Suite
        </Typography>
      </Box>

      <List sx={{ flexGrow: 1, px: 0.5 }}>
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = isMenuItemActive(item.path);

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isActive}
                onClick={() => handleNavigate(item.path)}
                sx={{
                  minHeight: 50,
                  borderRadius: 999,
                  px: 1.6,
                  color: 'rgba(234, 247, 255, 0.92)',
                  '& .MuiListItemIcon-root': {
                    minWidth: 40,
                    color: 'inherit',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(193, 228, 255, 0.12)',
                  },
                  '&.Mui-selected': {
                    background:
                      'linear-gradient(90deg, rgba(113, 185, 255, 0.34) 0%, rgba(89, 170, 255, 0.18) 100%)',
                    boxShadow: 'inset 0 0 0 1px rgba(219, 242, 255, 0.16)',
                  },
                }}
              >
                <ListItemIcon>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <List sx={{ px: 0.5, pt: 0.8 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 50,
              borderRadius: 999,
              px: 1.6,
              color: 'rgba(255, 232, 232, 0.94)',
              '& .MuiListItemIcon-root': {
                minWidth: 40,
                color: 'inherit',
              },
              '&:hover': {
                backgroundColor: 'rgba(255, 128, 128, 0.12)',
              },
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Выйти" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: 'background.default',
      }}
    >
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          ml: 0,
          color: 'text.primary',
          boxShadow: '0 12px 24px rgba(18, 53, 73, 0.06)',
          px: { xs: 0.4, md: 0.8 },
          zIndex: theme.zIndex.appBar,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 62, md: 68 }, gap: 1 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, minWidth: 0, pl: { md: 1 } }}>
            <Typography variant="h6" component="p" noWrap>
              {activeMenuItem?.text || 'Рабочее пространство'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.15 }}>
              <CalendarMonthIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" noWrap>
                {currentDateLabel}
              </Typography>
            </Box>
          </Box>

          <Chip
            label="Онлайн"
            size="small"
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              bgcolor: 'rgba(38, 138, 96, 0.14)',
              color: 'success.dark',
              border: '1px solid rgba(38, 138, 96, 0.24)',
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: { xs: 0, sm: 0.6 } }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 600 }}>
              {userFullName}
            </Typography>
            <IconButton
              onClick={handleMenuClick}
              size="small"
              sx={{
                p: 0.25,
                border: '1px solid rgba(23, 48, 65, 0.12)',
                bgcolor: 'rgba(255,255,255,0.72)',
              }}
            >
              <Avatar
                data-testid="layout-user-avatar"
                src={resolveMediaUrl(user?.avatarUrl)}
                sx={{
                  width: 36,
                  height: 36,
                  background: 'linear-gradient(145deg, #0f6e6e 0%, #1f5f82 100%)',
                }}
              >
                {userInitials}
              </Avatar>
            </IconButton>
          </Box>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem
              onClick={() => {
                handleMenuClose();
                navigate('/settings');
              }}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Настройки
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Выйти
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: 0,
          flexShrink: 0,
          minHeight: 0,
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: mobileDrawerWidth,
              border: 'none',
            },
          }}
        >
          {mobileDrawer}
        </Drawer>
      </Box>

      {!isMobile && (
        <>
          <Box
            onMouseEnter={() => setDesktopSidebarOpen(true)}
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 18,
              height: '100dvh',
              zIndex: theme.zIndex.drawer + 1,
            }}
          />
          <Box
            onMouseEnter={() => {
              setDesktopSidebarHovered(true);
              setDesktopSidebarOpen(true);
            }}
            onMouseLeave={() => {
              setDesktopSidebarHovered(false);
              setDesktopHoveredItem(null);
              if (desktopSidebarProximity < 0.3) {
                setDesktopSidebarOpen(false);
              }
            }}
            sx={{
              position: 'fixed',
              top: '50%',
              left: 14,
              transform: `translate3d(${desktopSidebarOpen ? 8 : -2 + desktopRailIntensity * 10}px, -50%, 0) scale(${0.97 + desktopRailIntensity * 0.06})`,
              transformOrigin: 'left center',
              opacity: 0.68 + desktopRailIntensity * 0.32,
              transition: 'transform 220ms ease, opacity 220ms ease',
              zIndex: theme.zIndex.drawer + 2,
              pointerEvents: 'auto',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.05,
                py: 1,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 10,
                  bottom: 10,
                  left: 10,
                  width: 56,
                  borderRadius: '999px',
                  background:
                    'linear-gradient(180deg, rgba(105, 135, 153, 0.16) 0%, rgba(152, 176, 190, 0.09) 40%, rgba(116, 144, 159, 0.14) 100%)',
                  boxShadow: '0 18px 44px rgba(63, 93, 110, 0.12)',
                  filter: 'blur(10px)',
                  pointerEvents: 'none',
                },
              }}
            >
              {visibleMenuItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = isMenuItemActive(item.path);
                const isHovered = desktopHoveredItem === item.path;
                const centerIndex = (visibleMenuItems.length - 1) / 2;
                const normalizedDistance =
                  Math.abs(index - centerIndex) / Math.max(centerIndex, 1);
                const arcOffset = (1 - Math.min(normalizedDistance, 1) ** 1.6) * 12;

                return (
                  <Box
                    key={item.text}
                    sx={{
                      pl: `${arcOffset}px`,
                      transition: 'padding-left 180ms ease',
                    }}
                  >
                    <ButtonBase
                      onClick={() => handleNavigate(item.path)}
                      onMouseEnter={() => setDesktopHoveredItem(item.path)}
                      onMouseLeave={() => setDesktopHoveredItem((current) => (current === item.path ? null : current))}
                      sx={{
                        position: 'relative',
                        width: isHovered ? 164 : 54,
                        height: isHovered ? 56 : 54,
                        px: isHovered ? 1.35 : 0,
                        justifyContent: 'flex-start',
                        borderRadius: '32px',
                        overflow: 'hidden',
                        color: isActive ? '#f6fbff' : '#e5eef4',
                        background: isHovered || isActive
                          ? `linear-gradient(90deg, ${alpha('#6f9fbb', isActive ? 0.62 : 0.5)} 0%, ${alpha('#99b7c9', isActive ? 0.42 : 0.34)} 100%)`
                          : `linear-gradient(180deg, ${alpha('#bcced9', 0.42 + desktopRailIntensity * 0.08)} 0%, ${alpha('#aebfca', 0.28 + desktopRailIntensity * 0.06)} 100%)`,
                        border: `1px solid ${alpha('#eff6f9', isHovered || isActive ? 0.34 : 0.18)}`,
                        boxShadow: isHovered || isActive
                          ? `0 18px 34px ${alpha('#36586b', 0.24)}, 0 0 0 14px ${alpha('#cfe0ea', isHovered ? 0.14 : 0.08)}, inset 0 1px 0 ${alpha('#ffffff', 0.22)}`
                          : `0 12px 24px ${alpha('#465f6d', 0.16)}, inset 0 1px 0 ${alpha('#ffffff', 0.14)}`,
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        transition:
                          'width 220ms ease, height 220ms ease, padding 220ms ease, transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease',
                        '&:hover': {
                          transform: 'translateX(6px) scale(1.035)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: isHovered ? 54 : 52,
                          minWidth: isHovered ? 54 : 52,
                          height: isHovered ? 54 : 52,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '50%',
                          color: isActive || isHovered ? '#f8fbfd' : '#e7eff4',
                          textShadow: `0 1px 8px ${alpha('#29414f', isHovered || isActive ? 0.24 : 0.12)}`,
                          transition: 'width 180ms ease, height 180ms ease, color 180ms ease',
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Typography
                        sx={{
                          pr: isHovered ? 1.4 : 0,
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          letterSpacing: '-0.01em',
                          color: isActive ? '#f5fafc' : '#edf4f8',
                          textShadow: isHovered ? `0 1px 12px ${alpha('#213845', 0.24)}` : 'none',
                          opacity: isHovered ? 1 : 0,
                          transform: `translateX(${isHovered ? 0 : -10}px)`,
                          transition: 'opacity 160ms ease, transform 200ms ease',
                        }}
                      >
                        {item.text}
                      </Typography>
                    </ButtonBase>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: '100%',
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'visible',
          overflowY: 'hidden',
          position: 'relative',
          zIndex: 1,
          bgcolor: 'background.default',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 15% -10%, rgba(31, 123, 166, 0.14) 0, rgba(31,123,166,0) 32%), radial-gradient(circle at 100% 100%, rgba(15, 110, 110, 0.12) 0, rgba(15,110,110,0) 28%)',
          },
        }}
      >
        <Toolbar />
        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            '--content-pad-x': { xs: '12px', md: '20px' },
            '--content-pad-y': { xs: '12px', md: '20px' },
            pl: { xs: 'var(--content-pad-x)', md: `calc(var(--content-pad-x) + ${desktopRailSafeOffset}px)` },
            pr: 'var(--content-pad-x)',
            pt: 'var(--content-pad-y)',
            pb: 'var(--content-pad-y)',
            overflowX: 'visible',
            overflowY: 'hidden',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </Box>
      </Box>

      <ComposeDialog />
    </Box>
  );
}
