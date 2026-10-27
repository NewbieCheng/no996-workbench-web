import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthContext';
import { apiErrorMessage, setRememberMe } from '@/api/client';
import { setLastLoginIntent } from '@/auth/login-prefs';
import { toastError, toastSuccess } from '@/lib/toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@no996/ui/dialog';
import { Field, FieldLabel } from '@no996/ui/field';
import { Spinner } from '@no996/ui/spinner';

import { CaptchaVerifyDialog } from './CaptchaVerifyDialog';
import { GlassInput } from './GlassInput';
import { GlassPasswordInput } from './GlassPasswordInput';
import { intentToApiMode } from './LoginIntentSegment';

/** 底部「其他登录方式」入口：仅平台运营账号密码登录，无企业/平台身份切换。 */
export function WorkspaceLoginDialog({
  open,
  onOpenChange,
  keepSignedIn,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keepSignedIn: boolean;
  onSuccess: () => void;
}) {
  const { t } = useTranslation('login');
  const { login } = useAuth();
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ credential: string; password: string } | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      setCredential('');
      setPassword('');
    }
  }, [open]);

  const finishLogin = async (captchaId: string, captchaCode: string) => {
    if (!pendingLogin) return;
    setLoading(true);
    try {
      setRememberMe(keepSignedIn);
      await login(
        pendingLogin.credential,
        pendingLogin.password,
        intentToApiMode('platform'),
        keepSignedIn,
        { captcha_id: captchaId, captcha_code: captchaCode },
      );
      setLastLoginIntent('platform');
      setPendingLogin(null);
      toastSuccess(t('success'));
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toastError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedCredential = credential.trim();
    if (!trimmedCredential) {
      toastError(t('credentialRequired'));
      return;
    }
    if (password.length < 6) {
      toastError(t('passwordRequired'));
      return;
    }
    setPendingLogin({ credential: trimmedCredential, password });
    setCaptchaOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="login-workspace-dialog login-split-surface sm:max-w-md">
          <DialogTitle>{t('workspaceLogin.title.platform')}</DialogTitle>
          <DialogDescription>{t('workspaceLogin.desc.platform')}</DialogDescription>

          <form
            className="login-form login-form--auth login-split-form flex flex-col gap-4"
            onSubmit={onSubmit}
          >
            <Field>
              <FieldLabel htmlFor="workspace-login-credential">{t('credentialLabel')}</FieldLabel>
              <GlassInput
                id="workspace-login-credential"
                placeholder={t('emailPlaceholder.platform')}
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                autoComplete="username"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="workspace-login-password">{t('passwordLabel')}</FieldLabel>
              <GlassPasswordInput
                id="workspace-login-password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <button type="submit" className="login-split-btn login-split-btn--primary" disabled={loading}>
              {loading ? <Spinner data-icon="inline-start" /> : null}
              {t('workspaceLogin.submit')}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <CaptchaVerifyDialog
        open={captchaOpen}
        onOpenChange={(next) => {
          setCaptchaOpen(next);
          if (!next) setPendingLogin(null);
        }}
        onSuccess={(captchaId, captchaCode) => {
          void finishLogin(captchaId, captchaCode);
        }}
      />
    </>
  );
}
