import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DEFAULT_PHONE_DIAL,
  PHONE_DIAL_OPTIONS,
  composePhoneE164,
  parsePhoneE164,
  type PhoneDial,
} from '@/lib/auth/emailDomains';
import { GlassInput } from './GlassInput';
import { cn } from '@/lib/utils';

export type PhoneCNFieldProps = {
  id?: string;
  /** Full E.164 value, e.g. +8613800138000 */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  className?: string;
};

export function PhoneCNField({
  id = 'phone-cn',
  value,
  onChange,
  placeholder,
  disabled,
  'aria-invalid': ariaInvalid,
  className,
}: PhoneCNFieldProps) {
  const { t } = useTranslation('login');
  const parsed = useMemo(() => parsePhoneE164(value), [value]);
  const dialMeta =
    PHONE_DIAL_OPTIONS.find((option) => option.dial === parsed.dial) ?? PHONE_DIAL_OPTIONS[0];

  const emit = (dial: PhoneDial, national: string) => {
    onChange(composePhoneE164(dial, national));
  };

  return (
    <div className={cn('login-phone-prefix', className)}>
      <label className="sr-only" htmlFor={`${id}-dial`}>
        {t('phoneDialAria')}
      </label>
      <select
        id={`${id}-dial`}
        className="login-phone-prefix__dial"
        value={parsed.dial || DEFAULT_PHONE_DIAL}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        onChange={(event) => emit(event.target.value as PhoneDial, parsed.national)}
      >
        {PHONE_DIAL_OPTIONS.map((option) => (
          <option key={option.dial} value={option.dial}>
            {option.label}
          </option>
        ))}
      </select>
      <GlassInput
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder ?? t('registerPhonePlaceholder')}
        value={parsed.national}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, dialMeta.maxLen);
          emit(parsed.dial || DEFAULT_PHONE_DIAL, next);
        }}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        maxLength={dialMeta.maxLen}
        className="login-phone-prefix__input"
      />
    </div>
  );
}
