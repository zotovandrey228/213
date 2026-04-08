import { create } from 'zustand';

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  tg_id?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('access_token'),
  user: (() => {
    const u = localStorage.getItem('auth_user');
    return u ? JSON.parse(u) : null;
  })(),
  setAuth: (token, user) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    set({ token: null, user: null });
  },
  isAuthenticated: () => !!get().token,
}));
