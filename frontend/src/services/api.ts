import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../types';

export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export const API_ORIGIN = new URL(API_URL, window.location.origin).origin;
export const SOCKET_URL = API_ORIGIN;

export function resolveApiUrl(path: string): string {
  return new URL(path, API_ORIGIN).toString();
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => config);

// Обработка ошибок
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
