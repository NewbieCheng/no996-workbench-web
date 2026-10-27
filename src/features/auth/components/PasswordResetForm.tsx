import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, requestVerificationCode } from '@/auth/AuthContext';
import {
  composeEmail,
  DEFAULT_EMAIL_SUFFIX,
  isValidComposedEmail,
  parseEmail,
} from '@/lib/auth/emailDomains';
import { apiErrorMessage, apiRetryAfterSeconds } from '@/api/client';
import { EmailSuffixField } from './EmailSuffixField';
import { GlassPasswordInput } from './GlassPasswordInput';
import { GlassInput } from './GlassInput';
import { CaptchaVerifyDialog } from './CaptchaVerifyDialog';
import { Button } from '@no996/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@no996/ui/field';
import { Spinner } from '@no996/ui/spinner';
import { toastError, toastSuccess } from '@/lib/toast';
import {
  useVerificationCodeCooldown,
  verificationCooldownStorageKey,
} from '@/hooks/useVerificationCodeCooldown';

export type PasswordResetFormProps = {
  /** Pre-fill email prefix/suffix when known (e.g. settings page). */
  initialEmail?: string;
  /** Lock email fields when the user is already signed in. */
  emailLocked?: boolean;
  /** Called after a successful reset. */
  onSuccess?: () => void;
  /** Compact layout for dialogs. */
  compact?: boolean;
};

export function PasswordResetForm({
  initialEmail = '',
  emailLocked = false,
  onSuccess,
  compact = false,
}: PasswordResetFormProps) {
  const { t } = useTranslation('login');
  const { resetPassword } = useAuth();
  const parsed = parseEmail(initialEmail);
  const [emailPrefix, setEmailPrefix] = useState(parsed.prefix);
  const [emailSuffix, setEmailSuffix] = useState(parsed.suffix || DEFAULT_EMAIL_SUFFIX);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const email = composeEmail(emailPrefix, emailSuffix);
  const codeCooldown = useVerificationCodeCooldown(
    verificationCooldownStorageKey('reset_password', email),
  );
  const canSendCode = emailPrefix.trim().length > 0;

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!isValidComposedEmail(emailPrefix, emailSuffix)) {
      next.email = t('emailInvalid');
    }
    if (!code.trim()) {
      next.code = t('verificationCodeRequired');
    }
    if (newPassword.length < 8) {
      next.newPassword = t('passwordRequired');
    }
    if (newPassword !== confirmPassword) {
      next.confirmPassword = t('confirmPasswordMismatch');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const sendCode = async (captchaId: string, captchaCode: string) => {
    if (!isValidComposedEmail(emailPrefix, emailSuffix)) {
      setErrors({ email: t('emailInvalid') });
      return;
    }
    if (codeCooldown.isCoolingDown) {
      toastError(t('verificationCodeCooldown', { seconds: codeCooldown.remaining }));
      return;
    }
    setCodeSending(true);
    try {
      await requestVerificationCode({
        email,
        purpose: 'reset_password',
        captcha_id: captchaId,
        captcha_code: captchaCode,
      });
      codeCooldown.startCooldown();
      toastSuccess(t('verificationCodeSent'));
    } catch (err) {
      const retryAfter = apiRetryAfterSeconds(err);
      if (retryAfter) {
        codeCooldown.startCooldown(retryAfter);
      }
      toastError(apiErrorMessage(err));
    } finally {
      setCodeSending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await resetPassword(email, code.trim(), newPassword);
      toastSuccess(t('resetPasswordSuccess'));
      onSuccess?.();
    } catch (err) {
      toastError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form className={compact ? 'flex flex-col gap-4' : 'login-form flex flex-col'} onSubmit={handleSubmit}>
        <FieldGroup className={compact ? 'gap-4' : undefined}>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="reset-email-prefix">{t('registerEmailLabel')}</FieldLabel>
            <EmailSuffixField
              id="reset-email-prefix"
              prefix={emailPrefix}
              suffix={emailSuffix}
              onPrefixChange={setEmailPrefix}
              onSuffixChange={setEmailSuffix}
              disabled={emailLocked}
              aria-invalid={!!errors.email}
            />
            <FieldError>{errors.email}</FieldError>
          </Field>

          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="reset-code">{t('verificationCodeLabel')}</FieldLabel>
            <div className="flex items-stretch gap-2">
              <GlassInput
                id="reset-code"
                placeholder={t('verificationCodePlaceholder')}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                className="login-inline-action-btn shrink-0"
                disabled={codeSending || codeCooldown.isCoolingDown || !canSendCode || (emailLocked && !email)}
                onClick={() => {
                  if (codeCooldown.isCoolingDown || !canSendCode) return;
                  setCaptchaOpen(true);
                }}
              >
                {codeSending ? <Spinner data-icon="inline-start" /> : null}
                {codeCooldown.isCoolingDown
                  ? t('sendVerificationCodeCooldown', { seconds: codeCooldown.remaining })
                  : t('sendVerificationCode')}
              </Button>
            </div>
            <FieldError>{errors.code}</FieldError>
          </Field>

          <Field data-invalid={!!errors.newPassword}>
            <FieldLabel htmlFor="reset-new-password">{t('newPasswordLabel')}</FieldLabel>
            <GlassPasswordInput
              id="reset-new-password"
              placeholder={t('passwordPlaceholder')}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              aria-invalid={!!errors.newPassword}
            />
            <FieldError>{errors.newPassword}</FieldError>
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="reset-confirm-password">{t('confirmPasswordLabel')}</FieldLabel>
            <GlassPasswordInput
              id="reset-confirm-password"
              placeholder={t('passwordPlaceholder')}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={!!errors.confirmPassword}
            />
            <FieldError>{errors.confirmPassword}</FieldError>
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="login-submit h-11 w-full rounded-xl" disabled={submitting}>
          {submitting && <Spinner data-icon="inline-start" />}
          {t('resetPasswordSubmit')}
        </Button>
      </form>

      <CaptchaVerifyDialog
        open={captchaOpen}
        onOpenChange={setCaptchaOpen}
        onSuccess={(captchaId, captchaCode) => {
          void sendCode(captchaId, captchaCode);
        }}
      />
    </>
  );
}
