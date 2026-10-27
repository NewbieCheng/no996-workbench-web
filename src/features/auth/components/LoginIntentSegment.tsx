import { useTranslation } from 'react-i18next';

import type { Workspace } from '@/theme';

import { AuthIntentCards, type AuthIntent } from './AuthIntentCards';

export type LoginIntent = Workspace;

export function LoginIntentSegment({
  value,
  onChange,
}: {
  value: LoginIntent;
  onChange: (intent: LoginIntent) => void;
}) {
  const { t } = useTranslation('login');
  const safeValue: AuthIntent =
    value === 'enterprise' || value === 'personal' ? value : 'personal';

  return (
    <AuthIntentCards
      value={safeValue}
      onChange={(next) => onChange(next)}
      ariaLabel={t('intentAria')}
      labelPrefix="intent"
    />
  );
}

export function intentToApiMode(intent: LoginIntent): number {
  return intent === 'enterprise' ? 2 : 1;
}

export function intentMismatchMessageKey(intent: LoginIntent): string {
  return `mismatch.${intent}`;
}
