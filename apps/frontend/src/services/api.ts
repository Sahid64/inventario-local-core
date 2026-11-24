import axios, { AxiosError } from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Adjuntar token JWT guardado en localStorage
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('inventario-local-auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
      const token = parsed?.state?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // Ignorar errores de parseo de storage
  }
  return config;
});

// Manejo global de sesión expirada
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('inventario-local-auth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function extractApiError(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; details?: Array<{ path?: string; message?: string }> }
      | undefined;
    if (data?.details?.length) {
      return `${data.message ?? 'Datos inválidos'}: ${data.details.map((d) => d.message).join(', ')}`;
    }
    if (data?.message) return data.message;
    if (error.message === 'Network Error') {
      return 'No se pudo conectar con el servidor local. Verifica que el backend esté activo.';
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function getAssetUrl(assetPath: string | null | undefined): string {
  if (!assetPath) return '/default-logo.svg';
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('data:')) {
    return assetPath;
  }
  const origin = import.meta.env.VITE_BACKEND_ORIGIN?.replace(/\/$/, '') || '';
  return `${origin}${assetPath}`;
}
