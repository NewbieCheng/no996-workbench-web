import { useTranslation } from 'react-i18next';
import { normalizeCNPhone } from '@/lib/auth/emailDomains';
import { GlassInput } from './GlassInput';
import { cn } from '@/lib/utils';

export type PhoneCNFieldProps = {
  id?: string;
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

  return (
    <div className={cn('login-phone-prefix', className)}>
      <span className="login-phone-prefix__badge" aria-hidden="true">
        {t('phonePrefix')}
      </span>
      <GlassInput
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder ?? t('registerPhonePlaceholder')}
        value={value}
        onChange={(event) => onChange(normalizeCNPhone(event.target.value))}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        maxLength={11}
        className="login-phone-prefix__input"
      />
    </div>
  );
}
