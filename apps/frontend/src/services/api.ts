import axios, { AxiosError } from 'axios';

declare global {
  interface Window {
    __DESKTOP_API__?: {
      apiUrl: string;
      backendOrigin: string;
      appSecret: string;
      isDesktop: boolean;
    };
  }
}

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.__DESKTOP_API__?.apiUrl) {
    return window.__DESKTOP_API__.apiUrl.replace(/\/$/, '');
  }
  return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api/v1';
}

function getAppSecret(): string {
  if (typeof window !== 'undefined' && window.__DESKTOP_API__?.appSecret) {
    return window.__DESKTOP_API__.appSecret;
  }
  return import.meta.env.VITE_APP_SECRET || '';
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Adjuntar token JWT y encabezado x-app-secret (en modo escritorio)
api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();

  const secret = getAppSecret();
  if (secret) {
    config.headers['x-app-secret'] = secret;
  }

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
      if (window.location.protocol === 'file:') {
        window.location.hash = '#/login';
      } else if (window.location.pathname !== '/login') {
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
  if (!assetPath) {
    return window.location.protocol === 'file:' ? './default-logo.svg' : '/default-logo.svg';
  }
  if (
    assetPath.startsWith('http://') ||
    assetPath.startsWith('https://') ||
    assetPath.startsWith('data:')
  ) {
    return assetPath;
  }
  const desktopOrigin =
    typeof window !== 'undefined' ? window.__DESKTOP_API__?.backendOrigin?.replace(/\/$/, '') : '';
  const origin = desktopOrigin || import.meta.env.VITE_BACKEND_ORIGIN?.replace(/\/$/, '') || '';
  return `${origin}${assetPath}`;
}
