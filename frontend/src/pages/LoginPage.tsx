import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import type { LoginRequest } from '../types';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const onSubmit = async (data: LoginRequest) => {
    setError(null);
    setIsLoading(true);
    
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
     } catch (err: unknown) {
        const message = err && typeof err === 'object' && 'response' in err 
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message 
          : 'Ошибка авторизации';
        setError(message || null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 8% 10%, rgba(31,123,166,0.2) 0, rgba(31,123,166,0) 32%), radial-gradient(circle at 88% 88%, rgba(15,110,110,0.22) 0, rgba(15,110,110,0) 34%), linear-gradient(140deg, #edf4f8 0%, #f8fcff 52%, #e8f2f8 100%)',
        p: { xs: 1.8, md: 3 },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          top: -160,
          right: -120,
          background: 'radial-gradient(circle, rgba(47,139,139,0.2) 0%, rgba(47,139,139,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <Card
        sx={{
          maxWidth: 460,
          width: '100%',
          borderRadius: 4,
          border: '1px solid rgba(23, 66, 88, 0.08)',
          boxShadow: '0 28px 58px rgba(17, 49, 68, 0.14)',
          background: 'linear-gradient(140deg, rgba(255,255,255,0.96) 0%, rgba(248,252,255,0.94) 100%)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.6, md: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3.2 }}>
            <Box
              sx={{
                width: '100%',
                maxWidth: { xs: 280, sm: 340 },
                mx: 'auto',
                mb: 1.6,
                px: { xs: 0.4, sm: 0.6 },
              }}
            >
              <Box
                component="img"
                src="/hospital-logo-source.png"
                alt="Логотип областной клинической больницы №3"
                sx={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                }}
              />
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              margin="normal"
              autoComplete="email"
              autoFocus
              {...register('email', {
                required: 'Email обязателен',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Некорректный email',
                },
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
            />

            <TextField
              fullWidth
              label="Пароль"
              type={showPassword ? 'text' : 'password'}
              margin="normal"
              autoComplete="current-password"
              {...register('password', {
                required: 'Пароль обязателен',
              })}
              error={!!errors.password}
              helperText={errors.password?.message}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{
                mt: 3,
                mb: 2,
                minHeight: 46,
                background: 'linear-gradient(135deg, #0f6e6e 0%, #1f5f82 100%)',
              }}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </form>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2.2 }}>
            Для получения доступа обратитесь к администратору
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
