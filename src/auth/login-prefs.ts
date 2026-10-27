const CREDENTIAL_KEY = 'no996_last_credential';
const REMEMBER_PASSWORD_KEY = 'no996_remember_password';
const LAST_INTENT_KEY = 'no996_last_login_intent';

export type StoredLoginIntent = 'enterprise' | 'platform' | 'personal';

export function getLastCredential(): string {
  try {
    return localStorage.getItem(CREDENTIAL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setLastCredential(credential: string): void {
  try {
    const trimmed = credential.trim();
    if (trimmed) localStorage.setItem(CREDENTIAL_KEY, trimmed);
    else localStorage.removeItem(CREDENTIAL_KEY);
  } catch {
    /* ignore */
  }
}

export function getLastLoginIntent(): StoredLoginIntent | null {
  try {
    const raw = localStorage.getItem(LAST_INTENT_KEY);
    if (raw === 'enterprise' || raw === 'platform' || raw === 'personal') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function setLastLoginIntent(intent: StoredLoginIntent): void {
  try {
    localStorage.setItem(LAST_INTENT_KEY, intent);
  } catch {
    /* ignore */
  }
}

export function isRememberPasswordEnabled(): boolean {
  try {
    return localStorage.getItem(REMEMBER_PASSWORD_KEY) === '1';
  } catch {
    return false;
  }
}

export function setRememberPassword(remember: boolean): void {
  try {
    if (remember) localStorage.setItem(REMEMBER_PASSWORD_KEY, '1');
    else localStorage.removeItem(REMEMBER_PASSWORD_KEY);
  } catch {
    /* ignore */
  }
}
