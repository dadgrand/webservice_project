import { create } from 'zustand';
import type { User } from '../types';
import { authService } from '../services';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  (set) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    login: async (email: string, password: string) => {
      const { user } = await authService.login({ email, password });
      set({ user, isAuthenticated: true, isLoading: false });
    },

    logout: () => {
      void authService.logout().catch(() => undefined);
      set({ user: null, isAuthenticated: false, isLoading: false });
    },

    checkAuth: async () => {
      set((state) => ({ ...state, isLoading: true }));

      try {
        const user = await authService.me();
        set({ user, isAuthenticated: true, isLoading: false });
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    setUser: (user: User) => set({ user }),
  })
);

// Проверка прав
export function useHasPermission(permissionCode: string): boolean {
  const user = useAuthStore((state) => state.user);
  if (!user) return false;
  if (user.isAdmin) return true;
  return user.permissions.includes(permissionCode);
}

export function useHasAnyPermission(...permissionCodes: string[]): boolean {
  const user = useAuthStore((state) => state.user);
  if (!user) return false;
  if (user.isAdmin) return true;
  return permissionCodes.some((code) => user.permissions.includes(code));
}

if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });
}
