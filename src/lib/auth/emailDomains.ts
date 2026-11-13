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

/** Dial options for the phone field; national rules stay soft except CN. */
export const PHONE_DIAL_OPTIONS = [
  { dial: '+86', label: '+86', maxLen: 11 },
  { dial: '+852', label: '+852', maxLen: 8 },
  { dial: '+853', label: '+853', maxLen: 8 },
  { dial: '+886', label: '+886', maxLen: 9 },
  { dial: '+1', label: '+1', maxLen: 10 },
  { dial: '+81', label: '+81', maxLen: 11 },
  { dial: '+82', label: '+82', maxLen: 11 },
  { dial: '+65', label: '+65', maxLen: 8 },
  { dial: '+44', label: '+44', maxLen: 11 },
] as const;

export type PhoneDial = (typeof PHONE_DIAL_OPTIONS)[number]['dial'];

export const DEFAULT_PHONE_DIAL: PhoneDial = '+86';

/** Mainland China mobile national part: 11 digits starting with 1[3-9]. */
export const CN_PHONE_PATTERN = /^1[3-9]\d{9}$/;

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Compose a draft E.164 string for the controlled phone field.
 * Does NOT require a complete number — validation is isValidPhoneE164's job.
 * Incomplete drafts like "+86138" must round-trip so typing is not swallowed.
 */
export function composePhoneE164(dial: string, national: string): string {
  const dialDigits = digitsOnly(dial);
  const nationalDigits = digitsOnly(national);
  if (!dialDigits) return '';
  return `+${dialDigits}${nationalDigits}`;
}

/**
 * Canonicalize to E.164. Bare mainland mobiles become +86…;
 * other bare numbers without a dial return ''.
 */
export function normalizePhoneE164(value: string): string {
  const raw = value.trim();
  if (!raw) return '';

  let hasPlus = raw.startsWith('+');
  let rest = raw;
  if (rest.startsWith('00')) {
    hasPlus = true;
    rest = rest.slice(2);
  }
  const digits = digitsOnly(rest);
  if (!digits) return '';

  if (!hasPlus) {
    if (CN_PHONE_PATTERN.test(digits)) return `+86${digits}`;
    if (digits.startsWith('86') && CN_PHONE_PATTERN.test(digits.slice(2))) {
      return `+${digits}`;
    }
    return '';
  }

  if (digits.startsWith('0') || digits.length < 8 || digits.length > 15) return '';
  return `+${digits}`;
}

export function parsePhoneE164(value: string): { dial: PhoneDial; national: string } {
  const raw = value.trim();
  if (!raw) {
    return { dial: DEFAULT_PHONE_DIAL, national: '' };
  }

  let body = '';
  if (raw.startsWith('+')) {
    body = digitsOnly(raw.slice(1));
  } else if (raw.startsWith('00')) {
    body = digitsOnly(raw.slice(2));
  } else {
    const normalized = normalizePhoneE164(raw);
    if (normalized) {
      body = normalized.slice(1);
    } else {
      return {
        dial: DEFAULT_PHONE_DIAL,
        national: digitsOnly(raw).slice(0, DEFAULT_PHONE_DIAL === '+86' ? 11 : 15),
      };
    }
  }

  const sorted = [...PHONE_DIAL_OPTIONS].sort((a, b) => b.dial.length - a.dial.length);
  for (const option of sorted) {
    const dialDigits = digitsOnly(option.dial);
    if (body.startsWith(dialDigits)) {
      return {
        dial: option.dial,
        national: body.slice(dialDigits.length).slice(0, option.maxLen),
      };
    }
  }
  return { dial: DEFAULT_PHONE_DIAL, national: body.slice(0, 11) };
}

export function isValidPhoneE164(value: string): boolean {
  const normalized = normalizePhoneE164(value);
  if (!E164_PATTERN.test(normalized)) return false;
  if (normalized.startsWith('+86')) {
    return CN_PHONE_PATTERN.test(normalized.slice(3));
  }
  return true;
}

/** @deprecated Prefer isValidPhoneE164; kept for call sites that still say CN. */
export function isValidCNPhone(value: string): boolean {
  return isValidPhoneE164(value);
}

/** @deprecated Prefer normalizePhoneE164; strips to national only for legacy callers. */
export function normalizeCNPhone(value: string): string {
  const parsed = parsePhoneE164(value);
  if (parsed.dial === '+86') return parsed.national.slice(0, 11);
  return digitsOnly(value).slice(0, 11);
}
