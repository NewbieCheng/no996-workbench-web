import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type LoginMethod = 'password' | 'emailCode';

const methodValues: LoginMethod[] = ['password', 'emailCode'];

export function LoginMethodSegment({
  value,
  onChange,
}: {
  value: LoginMethod;
  onChange: (method: LoginMethod) => void;
}) {
  const { t } = useTranslation('login');
  const activeIndex = methodValues.indexOf(value);

  return (
    <div
      className="login-intent-bars login-intent-bars--cols-2"
      role="tablist"
      aria-label={t('loginMethodAria')}
    >
      <div
        className="login-intent-bars__indicator"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden="true"
      />
      {methodValues.map((method) => (
        <button
          key={method}
          type="button"
          role="tab"
          aria-selected={value === method}
          className={cn('login-intent-bars__item', value === method && 'is-active')}
          onClick={() => onChange(method)}
        >
          {method === 'password' ? t('loginMethodPassword') : t('loginMethodEmailCode')}
        </button>
      ))}
    </div>
  );
}
