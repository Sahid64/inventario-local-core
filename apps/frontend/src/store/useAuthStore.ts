import type { AuthSession, User, UserRole } from '@inventario-local/shared/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        const { data } = await api.post<AuthSession>('/auth/login', {
          username,
          password,
        });
        set({
          token: data.token,
          user: data.user,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },

      refreshProfile: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const { data } = await api.get<User>('/auth/me');
          set({ user: data, isAuthenticated: true });
        } catch {
          set({ token: null, user: null, isAuthenticated: false });
        }
      },

      hasRole: (...roles: UserRole[]) => {
        const current = get().user;
        if (!current) return false;
        return roles.includes(current.role);
      },
    }),
    {
      name: 'inventario-local-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
