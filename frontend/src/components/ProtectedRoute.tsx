import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { CircularProgress, Box } from '@mui/material';

interface Props {
  children: React.ReactNode;
  requiredPermission?: string;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requiredPermission, requireAdmin }: Props) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Проверка прав администратора
  if (requireAdmin && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Проверка конкретного разрешения
  if (requiredPermission && user) {
    const hasPermission = user.isAdmin || user.permissions.includes(requiredPermission);
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
