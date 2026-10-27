import { Building2, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export type AuthIntent = 'personal' | 'enterprise';

const intentValues: AuthIntent[] = ['personal', 'enterprise'];

const intentIcons = {
  personal: UserRound,
  enterprise: Building2,
} as const;

type IntentLabelPrefix = 'intent' | 'registerIntent';

export function AuthIntentCards({
  value,
  onChange,
  ariaLabel,
  labelPrefix,
  className,
}: {
  value: AuthIntent;
  onChange: (intent: AuthIntent) => void;
  ariaLabel: string;
  labelPrefix: IntentLabelPrefix;
  className?: string;
}) {
  const { t } = useTranslation('login');
  const activeIndex = Math.max(0, intentValues.indexOf(value));

  return (
    <div className={cn('login-split-intent', className)} role="tablist" aria-label={ariaLabel}>
      <div
        className="login-split-intent__indicator"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden
      />
      {intentValues.map((intent) => {
        const Icon = intentIcons[intent];
        const active = value === intent;
        return (
          <button
            key={intent}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn('login-split-intent__item', active && 'is-active')}
            onClick={() => onChange(intent)}
          >
            <Icon className="login-split-intent__icon" aria-hidden strokeWidth={active ? 2.1 : 1.75} />
            <span className="login-split-intent__label">{t(`${labelPrefix}.${intent}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
