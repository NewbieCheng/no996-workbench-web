import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import i18n, { normalizeAppLanguage } from '@/i18n';
import {
  api,
  clearTokens,
  ensureAccessToken,
  getAccessToken,
  getRefreshToken,
  setTokens,
  type ApiEnvelope,
} from '@/api/client';
import {
  clearSessionDisplayName,
  clearSessionEmail,
  getSessionDisplayName,
  getSessionEmail,
  migrateSessionEmailToLocalStorage,
  setSessionDisplayName,
  setSessionEmail,
} from './session';
import { resolveUserDisplayName } from './display-name';
import { isAccessTokenValid, parseJwtPayload } from './jwt';

export type RegisterPayload = {
  email: string;
  phone: string;
  password: string;
  invite_code?: string;
  display_name?: string;
  code: string;
};

export type VerificationCodePayload = {
  email?: string;
  phone?: string;
  target?: string;
  purpose: 'register' | 'reset_password' | 'login';
  captcha_id?: string;
  captcha_code?: string;
  locale?: string;
};

export type AuthStatus = 'booting' | 'authenticated' | 'anonymous';

export interface AuthState {
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  userId: number | null;
  tenantId: number | null;
  role: number | null;
  userEmail: string;
  /** Nickname from register/local profile; not synced from server until login API returns display_name. */
  userDisplayName: string;
  login: (
    credential: string,
    password: string,
    mode?: number,
    rememberMe?: boolean,
    captcha?: { captcha_id: string; captcha_code: string },
  ) => Promise<void>;
  loginWithEmailCode: (
    email: string,
    code: string,
    mode?: number,
    rememberMe?: boolean,
  ) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

export async function requestVerificationCode(payload: VerificationCodePayload): Promise<void> {
  const body: Record<string, string> = { purpose: payload.purpose };
  const target = payload.target?.trim();
  const email = payload.email?.trim();
  const phone = payload.phone?.trim();
  if (target) body.target = target;
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (payload.captcha_id) body.captcha_id = payload.captcha_id;
  if (payload.captcha_code) body.captcha_code = payload.captcha_code;
  body.locale = payload.locale?.trim() || normalizeAppLanguage(i18n.language);
  await api.post('/auth/verification-codes', body);
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokenVersion, setTokenVersion] = useState(0);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('booting');

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const access = getAccessToken();
      const refresh = getRefreshToken();

      if (isAccessTokenValid(access)) {
        migrateSessionEmailToLocalStorage();
        if (!cancelled) setAuthStatus('authenticated');
        return;
      }

      if (!refresh) {
        if (access) clearTokens();
        if (!cancelled) setAuthStatus('anonymous');
        return;
      }

      const token = await ensureAccessToken();
      if (cancelled) return;

      if (token) {
        migrateSessionEmailToLocalStorage();
        setTokenVersion((v) => v + 1);
        setAuthStatus('authenticated');
        return;
      }

      clearTokens();
      clearSessionEmail();
      setTokenVersion((v) => v + 1);
      setAuthStatus('anonymous');
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    const access = getAccessToken();
    const claims = access ? parseJwtPayload(access) : null;
    const isAuthenticated = authStatus === 'authenticated';

    const markAuthenticated = () => {
      setAuthStatus('authenticated');
      setTokenVersion((v) => v + 1);
    };

    return {
      authStatus,
      isAuthenticated,
      userId: claims?.uid ?? null,
      tenantId: claims?.tid ?? null,
      role: claims?.role ?? null,
      userEmail: getSessionEmail(),
      userDisplayName: resolveUserDisplayName({
        storedDisplayName: getSessionDisplayName(),
        userEmail: getSessionEmail(),
        fallback: '',
      }),
      login: async (credential, password, mode = 1, rememberMe = true, captcha) => {
        const trimmed = credential.trim();
        const isEmail = trimmed.includes('@');
        const payload: Record<string, string | number> = isEmail
          ? { email: trimmed, password, mode, session_channel: 'app' }
          : { phone: trimmed, password, mode, session_channel: 'app' };
        if (captcha?.captcha_id) payload.captcha_id = captcha.captcha_id;
        if (captcha?.captcha_code) payload.captcha_code = captcha.captcha_code;

        const res = await api.post<
          ApiEnvelope<{ access_token: string; refresh_token: string; user_id: number }>
        >('/auth/login', payload);
        const data = res.data.data;
        if (!data?.access_token) {
          throw new Error('登录失败，未收到访问令牌');
        }
        setTokens(data.access_token, data.refresh_token, rememberMe);
        setSessionEmail(trimmed, rememberMe);
        markAuthenticated();
      },
      loginWithEmailCode: async (email, code, mode = 1, rememberMe = true) => {
        const trimmed = email.trim();
        const res = await api.post<
          ApiEnvelope<{ access_token: string; refresh_token: string; user_id: number }>
        >('/auth/login', {
          email: trimmed,
          code: code.trim(),
          mode,
          session_channel: 'app',
        });
        const data = res.data.data;
        if (!data?.access_token) {
          throw new Error('登录失败，未收到访问令牌');
        }
        setTokens(data.access_token, data.refresh_token, rememberMe);
        setSessionEmail(trimmed, rememberMe);
        markAuthenticated();
      },
      register: async (payload) => {
        const res = await api.post<
          ApiEnvelope<{ access_token: string; refresh_token: string; user_id: number }>
        >('/auth/register', {
          email: payload.email.trim(),
          phone: payload.phone.trim(),
          password: payload.password,
          invite_code: payload.invite_code?.trim() || undefined,
          display_name: payload.display_name?.trim() || undefined,
          code: payload.code.trim(),
          session_channel: 'app',
        });
        const data = res.data.data;
        if (!data?.access_token) {
          throw new Error('注册完成但未签发会话，请使用账号登录');
        }
        setTokens(data.access_token, data.refresh_token, true);
        setSessionEmail(payload.email.trim(), true);
        if (payload.display_name?.trim()) {
          setSessionDisplayName(payload.display_name.trim());
        }
        markAuthenticated();
      },
      resetPassword: async (email, code, newPassword) => {
        await api.post('/auth/reset-password', {
          email: email.trim(),
          code: code.trim(),
          new_password: newPassword,
        });
      },
      logout: async () => {
        const refresh = getRefreshToken();
        try {
          if (refresh) {
            await api.post('/auth/logout', { refresh_token: refresh });
          }
        } catch {
          // 忽略退出接口网络错误，本地照常清理
        } finally {
          clearTokens();
          clearSessionEmail();
          clearSessionDisplayName();
          setAuthStatus('anonymous');
          setTokenVersion((v) => v + 1);
        }
      },
    };
  }, [tokenVersion, authStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
