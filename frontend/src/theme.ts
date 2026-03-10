import { alpha, createTheme } from '@mui/material/styles';

const shellBlue = '#1f6e8c';
const shellTeal = '#2f8a8a';
const shellInk = '#163042';
const shellMist = '#eef6f9';
const surfaceBorder = alpha('#ffffff', 0.62);
const softShadow = '0 24px 56px rgba(24, 58, 76, 0.12)';
const softInset = `inset 0 1px 0 ${alpha('#ffffff', 0.62)}`;
const glassSurface =
  'linear-gradient(145deg, rgba(255,255,255,0.88) 0%, rgba(245,251,254,0.78) 48%, rgba(234,244,249,0.72) 100%)';
const glassSurfaceMuted =
  'linear-gradient(145deg, rgba(255,255,255,0.76) 0%, rgba(243,249,252,0.68) 100%)';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1d7a8f',
      light: '#4d9fb6',
      dark: '#185f71',
      contrastText: '#f7fcfe',
    },
    secondary: {
      main: '#4e7f96',
      light: '#7ba5b9',
      dark: '#35596d',
    },
    background: {
      default: shellMist,
      paper: '#f8fcfe',
    },
    success: {
      main: '#2a8c68',
      light: '#5faf89',
      dark: '#1f694d',
    },
    warning: {
      main: '#bf8b2d',
      light: '#d8ab57',
      dark: '#8d6621',
    },
    text: {
      primary: shellInk,
      secondary: '#567181',
    },
    divider: 'rgba(32, 73, 96, 0.1)',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Manrope", "Segoe UI", sans-serif',
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.028em',
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.016em',
    },
    subtitle1: {
      fontWeight: 600,
    },
    body1: {
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
  },
  shape: {
    borderRadius: 22,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'light',
        },
        '@keyframes uiFloatIn': {
          from: {
            opacity: 0,
            transform: 'translateY(10px)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
        html: {
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        },
        body: {
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          margin: 0,
          background: `
            radial-gradient(circle at 0% 0%, rgba(46,128,160,0.16) 0, rgba(46,128,160,0) 28%),
            radial-gradient(circle at 100% 0%, rgba(49,138,132,0.12) 0, rgba(49,138,132,0) 26%),
            radial-gradient(circle at 16% 100%, rgba(117,158,181,0.14) 0, rgba(117,158,181,0) 24%),
            linear-gradient(180deg, #eef6f9 0%, #edf5f8 100%)
          `,
        },
        '#root': {
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        },
        '*': {
          boxSizing: 'border-box',
        },
        '::selection': {
          backgroundColor: alpha(shellBlue, 0.18),
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 16,
          paddingInline: 18,
          minHeight: 42,
          transition: 'transform 140ms ease, box-shadow 180ms ease, background-color 180ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          backgroundImage: `linear-gradient(135deg, ${shellBlue} 0%, ${shellTeal} 100%)`,
          boxShadow: '0 14px 28px rgba(29, 110, 140, 0.18)',
          '&:hover': {
            boxShadow: '0 18px 34px rgba(29, 110, 140, 0.24)',
          },
        },
        outlined: {
          borderColor: alpha(shellBlue, 0.16),
          backgroundColor: alpha('#ffffff', 0.56),
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          '&:hover': {
            borderColor: alpha(shellBlue, 0.22),
            backgroundColor: alpha('#ffffff', 0.72),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          color: alpha(shellInk, 0.84),
          backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.84) 0%, rgba(244,250,253,0.72) 100%)',
          backgroundColor: alpha('#ffffff', 0.74),
          border: `1px solid ${alpha(shellBlue, 0.14)}`,
          boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.7)}`,
          '& .MuiChip-icon': {
            color: alpha(shellInk, 0.68),
          },
        },
        outlined: {
          backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.78) 0%, rgba(242,248,251,0.68) 100%)',
          backgroundColor: alpha('#ffffff', 0.7),
          borderColor: alpha(shellBlue, 0.18),
          color: alpha(shellInk, 0.84),
        },
      },
      variants: [
        {
          props: { color: 'primary' },
          style: {
            color: '#f4fbff',
            borderColor: 'transparent',
            backgroundImage: `linear-gradient(135deg, ${alpha(shellBlue, 0.96)} 0%, ${alpha(shellTeal, 0.92)} 100%)`,
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          },
        },
        {
          props: { color: 'success' },
          style: {
            color: '#f3fff9',
            borderColor: 'transparent',
            backgroundImage: 'linear-gradient(135deg, rgba(42,140,104,0.94) 0%, rgba(66,172,126,0.88) 100%)',
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          },
        },
        {
          props: { color: 'warning' },
          style: {
            color: '#fffaf1',
            borderColor: 'transparent',
            backgroundImage: 'linear-gradient(135deg, rgba(191,139,45,0.94) 0%, rgba(219,167,64,0.88) 100%)',
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          },
        },
        {
          props: { color: 'error' },
          style: {
            color: '#fff5f7',
            borderColor: 'transparent',
            backgroundImage: 'linear-gradient(135deg, rgba(188,77,89,0.94) 0%, rgba(213,97,112,0.88) 100%)',
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          },
        },
        {
          props: { color: 'info' },
          style: {
            color: '#f3fbff',
            borderColor: 'transparent',
            backgroundImage: `linear-gradient(135deg, ${alpha(shellBlue, 0.92)} 0%, ${alpha('#5e99b3', 0.9)} 100%)`,
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 28,
          border: `1px solid ${surfaceBorder}`,
          backgroundImage: glassSurface,
          backgroundColor: alpha('#ffffff', 0.72),
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: `${softShadow}, ${softInset}`,
          animation: 'uiFloatIn 240ms ease-out both',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 28,
          border: `1px solid ${surfaceBorder}`,
          backgroundImage: glassSurfaceMuted,
          backgroundColor: alpha('#ffffff', 0.68),
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: `${softShadow}, ${softInset}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.9) 0%, rgba(245,251,254,0.82) 100%)',
          borderBottom: `1px solid ${alpha(shellBlue, 0.08)}`,
          boxShadow: '0 14px 38px rgba(28, 61, 79, 0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          backgroundImage: glassSurfaceMuted,
          backgroundColor: alpha('#f8fcfe', 0.84),
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 48px rgba(27, 58, 74, 0.14)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          backgroundColor: alpha('#ffffff', 0.72),
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'box-shadow 140ms ease, border-color 140ms ease, background-color 140ms ease',
          '& fieldset': {
            borderColor: alpha(shellBlue, 0.14),
          },
          '&:hover fieldset': {
            borderColor: alpha(shellBlue, 0.22),
          },
          '&.Mui-focused': {
            backgroundColor: alpha('#ffffff', 0.84),
            boxShadow: `0 0 0 5px ${alpha(shellBlue, 0.1)}`,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-input::placeholder': {
            opacity: 1,
            color: alpha(shellInk, 0.46),
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          transition: 'transform 140ms ease, background-color 140ms ease, box-shadow 180ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            backgroundColor: alpha(shellBlue, 0.08),
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: alpha(shellInk, 0.92),
          borderRadius: 12,
          fontSize: '0.75rem',
          boxShadow: '0 16px 32px rgba(17, 39, 52, 0.24)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 30,
          border: `1px solid ${surfaceBorder}`,
          backgroundImage: glassSurface,
          backgroundColor: alpha('#ffffff', 0.86),
          boxShadow: '0 32px 80px rgba(23, 55, 73, 0.2)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          paddingTop: 22,
          paddingBottom: 14,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          '&.MuiDialogContent-dividers': {
            borderColor: alpha(shellBlue, 0.08),
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: `1px solid ${surfaceBorder}`,
          backgroundImage: glassSurfaceMuted,
          backgroundColor: alpha('#ffffff', 0.84),
          boxShadow: '0 20px 48px rgba(25, 54, 71, 0.16)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          border: `1px solid ${alpha(shellBlue, 0.08)}`,
          backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.78) 0%, rgba(247,251,253,0.72) 100%)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 24,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(shellBlue, 0.045),
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: alpha(shellBlue, 0.08),
        },
        head: {
          color: alpha(shellInk, 0.78),
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 140ms ease',
          '&:hover': {
            backgroundColor: alpha(shellBlue, 0.035),
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          transition: 'background-color 140ms ease, transform 140ms ease, box-shadow 160ms ease',
          '&:hover': {
            backgroundColor: alpha(shellBlue, 0.06),
            transform: 'translateX(2px)',
          },
          '&.Mui-selected': {
            backgroundImage: `linear-gradient(90deg, ${alpha(shellBlue, 0.18)} 0%, ${alpha('#ffffff', 0.48)} 100%)`,
            boxShadow: `inset 0 0 0 1px ${alpha(shellBlue, 0.08)}`,
            '&:hover': {
              backgroundImage: `linear-gradient(90deg, ${alpha(shellBlue, 0.22)} 0%, ${alpha('#ffffff', 0.54)} 100%)`,
            },
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: alpha(shellBlue, 0.08),
        },
      },
    },
  },
});
