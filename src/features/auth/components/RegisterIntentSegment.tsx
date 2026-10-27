import { useTranslation } from 'react-i18next';

import { AuthIntentCards, type AuthIntent } from './AuthIntentCards';

export type RegisterIntent = AuthIntent;

export function RegisterIntentSegment({
  value,
  onChange,
}: {
  value: RegisterIntent;
  onChange: (intent: RegisterIntent) => void;
}) {
  const { t } = useTranslation('login');

  return (
    <AuthIntentCards
      value={value}
      onChange={onChange}
      ariaLabel={t('registerIntentAria')}
      labelPrefix="registerIntent"
    />
  );
}
