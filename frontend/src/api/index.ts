import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// Auth
export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password });

// Users
export const getUsers = () => api.get('/users');
export const getMe = () => api.get('/users/me');
export const createUser = (data: {
  username: string;
  password: string;
  role: string;
  tg_id?: string;
}) => api.post('/users', data);
export const updateUser = (
  id: number,
  data: { password?: string; role?: string; tg_id?: string },
) => api.put(`/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);

// Cartridges
export const getCartridges = (search?: string) =>
  api.get('/cartridges', { params: search ? { search } : undefined });
export const getCartridge = (id: number) => api.get(`/cartridges/${id}`);
export const createCartridge = (data: {
  name: string;
  model?: string;
  serial_number?: string;
  region_id?: number;
  number?: number;
  comment?: string;
  status?: 'refill' | 'ready_to_install' | 'installed' | 'broken';
}) => api.post('/cartridges', data);
export const updateCartridge = (
  id: number,
  data: {
    name?: string;
    model?: string;
    serial_number?: string;
    region_id?: number;
    number?: number;
    comment?: string;
    status?: 'refill' | 'ready_to_install' | 'installed' | 'broken';
    status_reason?: string;
  },
) => api.put(`/cartridges/${id}`, data);
export const deleteCartridge = (id: number) =>
  api.delete(`/cartridges/${id}`);
export const getCartridgeNextNumber = (regionId?: number) =>
  api.get('/cartridges/next-number', {
    params: regionId ? { region_id: regionId } : undefined,
  });
export const getCartridgeNameSuggestions = (query?: string) =>
  api.get('/cartridges/name-suggestions', {
    params: query ? { query } : undefined,
  });

// Regions
export const getRegions = (search?: string) =>
  api.get('/regions', { params: search ? { search } : undefined });
export const createRegion = (data: { name: string; code: number }) =>
  api.post('/regions', data);
export const deleteRegion = (id: number) => api.delete(`/regions/${id}`);

// Works
export const getWorks = (cartridgeId: number) =>
  api.get(`/works/cartridge/${cartridgeId}`);
export const createWork = (data: {
  cartridge_id: number;
  description: string;
  performed_at: string;
  note?: string;
}) => api.post('/works', data);
export const deleteWork = (id: number) => api.delete(`/works/${id}`);

// Notes
export const getNotes = (cartridgeId: number) =>
  api.get(`/notes/cartridge/${cartridgeId}`);
export const createNote = (data: {
  cartridge_id: number;
  content: string;
}) => api.post('/notes', data);
export const deleteNote = (id: number) => api.delete(`/notes/${id}`);

export default api;
