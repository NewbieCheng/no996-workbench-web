import { useTranslation } from 'react-i18next';
import {
  DEFAULT_EMAIL_SUFFIX,
  MAIN_EMAIL_DOMAINS,
} from '@/lib/auth/emailDomains';
import { GlassInput } from './GlassInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@no996/ui/select';
import { cn } from '@/lib/utils';

export type EmailSuffixFieldProps = {
  id?: string;
  prefix: string;
  suffix: string;
  onPrefixChange: (prefix: string) => void;
  onSuffixChange: (suffix: string) => void;
  prefixPlaceholder?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  className?: string;
};

export function EmailSuffixField({
  id = 'email-prefix',
  prefix,
  suffix,
  onPrefixChange,
  onSuffixChange,
  prefixPlaceholder,
  disabled,
  'aria-invalid': ariaInvalid,
  className,
}: EmailSuffixFieldProps) {
  const { t } = useTranslation('login');
  const effectiveSuffix = suffix || DEFAULT_EMAIL_SUFFIX;

  return (
    <div className={cn('login-email-composite', className)}>
      <GlassInput
        id={id}
        type="text"
        inputMode="email"
        autoComplete="username"
        placeholder={prefixPlaceholder ?? t('emailPrefixPlaceholder')}
        value={prefix}
        onChange={(event) => onPrefixChange(event.target.value.trimStart())}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        className="login-email-composite__prefix"
      />
      <Select
        value={effectiveSuffix}
        onValueChange={(value) => onSuffixChange(value ?? DEFAULT_EMAIL_SUFFIX)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-label={t('emailSuffixLabel')}
          className="login-email-composite__suffix login-split-field w-[8.5rem] shrink-0 shadow-none focus-visible:ring-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MAIN_EMAIL_DOMAINS.map((domain) => (
            <SelectItem key={domain.value} value={domain.value}>
              {domain.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
