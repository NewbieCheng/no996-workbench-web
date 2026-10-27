export const MAIN_EMAIL_DOMAINS = [
  { label: '@qq.com', value: '@qq.com' },
  { label: '@163.com', value: '@163.com' },
  { label: '@126.com', value: '@126.com' },
  { label: '@gmail.com', value: '@gmail.com' },
  { label: '@outlook.com', value: '@outlook.com' },
  { label: '@hotmail.com', value: '@hotmail.com' },
  { label: '@sina.com', value: '@sina.com' },
  { label: '@sohu.com', value: '@sohu.com' },
  { label: '@foxmail.com', value: '@foxmail.com' },
  { label: '@aliyun.com', value: '@aliyun.com' },
  { label: '@icloud.com', value: '@icloud.com' },
] as const;

export const DEFAULT_EMAIL_SUFFIX = MAIN_EMAIL_DOMAINS[0].value;

const ALLOWED_SUFFIXES = new Set(MAIN_EMAIL_DOMAINS.map((d) => d.value));

export function composeEmail(prefix: string, suffix: string): string {
  const trimmedPrefix = prefix.trim();
  const normalizedSuffix = suffix.startsWith('@') ? suffix : `@${suffix}`;
  if (!trimmedPrefix) return '';
  return `${trimmedPrefix}${normalizedSuffix}`;
}

export function parseEmail(email: string): { prefix: string; suffix: string } {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0) {
    return { prefix: trimmed, suffix: DEFAULT_EMAIL_SUFFIX };
  }
  const prefix = trimmed.slice(0, atIndex);
  const suffix = trimmed.slice(atIndex);
  if (isAllowedEmailDomain(suffix)) {
    return { prefix, suffix };
  }
  return { prefix: trimmed, suffix: DEFAULT_EMAIL_SUFFIX };
}

export function isAllowedEmailDomain(suffix: string): boolean {
  const normalized = suffix.startsWith('@') ? suffix : `@${suffix}`;
  return ALLOWED_SUFFIXES.has(normalized as (typeof MAIN_EMAIL_DOMAINS)[number]['value']);
}

export function isValidComposedEmail(prefix: string, suffix: string): boolean {
  const email = composeEmail(prefix, suffix);
  if (!email || !isAllowedEmailDomain(suffix)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Mainland China mobile: 11 digits starting with 1[3-9]. */
export const CN_PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function normalizeCNPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function isValidCNPhone(value: string): boolean {
  return CN_PHONE_PATTERN.test(normalizeCNPhone(value));
}
