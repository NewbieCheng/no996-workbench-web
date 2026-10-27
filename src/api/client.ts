import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n';
import { isAccessTokenValid } from '@/auth/jwt';
import { invalidateAllDefaultModelCaches } from './capability-model-cache';

const ACCESS_KEY = 'no996_wb_access';
const REFRESH_KEY = 'no996_wb_refresh';
const REMEMBER_KEY = 'no996_wb_remember';

export function isRememberMeEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(REMEMBER_KEY) !== '0';
}

export function setRememberMe(remember: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  if (!remember) {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } else {
    const access = sessionStorage.getItem(ACCESS_KEY);
    const refresh = sessionStorage.getItem(REFRESH_KEY);
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY) ?? localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY) ?? localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string, remember = isRememberMeEnabled()) {
  setRememberMe(remember);
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  store.setItem(ACCESS_KEY, access);
  store.setItem(REFRESH_KEY, refresh);
  other.removeItem(ACCESS_KEY);
  other.removeItem(REFRESH_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  invalidateAllDefaultModelCaches();
}

export function buildLoginHref(baseUrl = import.meta.env.BASE_URL): string {
  const base = String(baseUrl || '/').replace(/\/$/, '');
  return `${base}/login` || '/login';
}

export interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  trace_id?: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

/** Open channel: voice clone, web_search (`/v1/**`, not `/api/v1`). */
export const v1Api = axios.create({
  baseURL: '/v1',
  timeout: 120000,
});

function attachAuthInterceptors(instance: typeof api) {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    const isPublicAuth =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/verification-codes') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/captcha') ||
      url.includes('/auth/reset-password') ||
      url.includes('/auth/invitations/accept');
    if (!isPublicAuth) {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  });
}

attachAuthInterceptors(api);
attachAuthInterceptors(v1Api);

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await axios.post<ApiEnvelope<{ access_token: string; refresh_token: string }>>(
      '/api/v1/auth/refresh',
      { refresh_token: refresh },
    );
    const data = res.data.data;
    if (!data?.access_token) return null;
    setTokens(data.access_token, data.refresh_token ?? refresh, isRememberMeEnabled());
    return data.access_token;
  } catch {
    return null;
  }
}

/** Return a usable access token, refreshing via refresh_token when needed. */
export async function ensureAccessToken(options?: { force?: boolean }): Promise<string | null> {
  const access = getAccessToken();
  if (!options?.force && isAccessTokenValid(access)) return access;
  if (!getRefreshToken()) return null;
  if (!refreshing) {
    refreshing = refreshAccessToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function attach401Retry(instance: typeof api) {
  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const original = error.config as RetriableConfig | undefined;
      if (
        !original ||
        original.url?.includes('/auth/login') ||
        original.url?.includes('/auth/register') ||
        original.url?.includes('/auth/verification-codes') ||
        original.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }
      if (error.response?.status === 401) {
        if (original._retry) {
          clearTokens();
          window.location.href = buildLoginHref();
          return Promise.reject(error);
        }
        original._retry = true;
        const token = await ensureAccessToken({ force: true });
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return instance.request(original);
        }
        clearTokens();
        window.location.href = buildLoginHref();
      }
      return Promise.reject(error);
    },
  );
}

attach401Retry(api);
attach401Retry(v1Api);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiEnvelope<unknown> | undefined;
    const msg = data?.error?.message ?? err.message;
    const trace = data?.trace_id;
    return trace ? `${msg}（trace: ${trace}）` : msg;
  }
  if (err instanceof Error) return err.message;
  return i18n.t('common:requestFailed');
}

export function apiRetryAfterSeconds(err: unknown): number | null {
  if (!axios.isAxiosError(err)) return null;
  const data = err.response?.data as ApiEnvelope<unknown> | undefined;
  const raw = data?.error?.details?.retry_after_seconds;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.ceil(raw);
}
