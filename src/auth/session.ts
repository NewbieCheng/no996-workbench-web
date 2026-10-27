import { isRememberMeEnabled } from '@/api/client';

const EMAIL_KEY = 'no996_wb_email';
const DISPLAY_NAME_KEY = 'no996_wb_display_name';

function emailStore(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage;
}

export function setSessionEmail(email: string, remember = isRememberMeEnabled()) {
  const trimmed = email.trim();
  try {
    const store = emailStore(remember);
    const other = remember ? sessionStorage : localStorage;
    if (trimmed) {
      store.setItem(EMAIL_KEY, trimmed);
    } else {
      store.removeItem(EMAIL_KEY);
    }
    other.removeItem(EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

export function getSessionEmail(): string {
  try {
    return sessionStorage.getItem(EMAIL_KEY) ?? localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearSessionEmail() {
  try {
    sessionStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

/** One-time: move email from sessionStorage to localStorage when tokens are remembered. */
export function migrateSessionEmailToLocalStorage(): void {
  try {
    if (!isRememberMeEnabled()) return;
    const local = localStorage.getItem(EMAIL_KEY);
    if (local?.trim()) return;
    const fromSession = sessionStorage.getItem(EMAIL_KEY)?.trim();
    if (!fromSession) return;
    localStorage.setItem(EMAIL_KEY, fromSession);
    sessionStorage.removeItem(EMAIL_KEY);
  } catch {
    /* ignore */
  }
}

export function setSessionDisplayName(name: string) {
  const trimmed = name.trim();
  try {
    if (trimmed) {
      localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    } else {
      localStorage.removeItem(DISPLAY_NAME_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function getSessionDisplayName(): string {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function clearSessionDisplayName() {
  try {
    localStorage.removeItem(DISPLAY_NAME_KEY);
  } catch {
    /* ignore */
  }
}
