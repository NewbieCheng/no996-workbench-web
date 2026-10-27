import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { useAuth, requestVerificationCode } from '@/auth/AuthContext';
import { setRememberMe, apiErrorMessage, apiRetryAfterSeconds } from '@/api/client';
import { LoginBrandAside } from './components/LoginBrandAside';
import { LoginLegalLinksText } from './components/LoginLegalNotice';
import { LoginWorkbenchLockup } from './components/LoginWorkbenchLockup';
import { WorkspaceLoginDialog } from './components/WorkspaceLoginDialog';
import { LoginIntentSegment, intentToApiMode } from './components/LoginIntentSegment';
import { LoginAlternateMethodsBar } from './components/LoginAlternateMethodsBar';
import type { LoginMethod } from './components/LoginMethodSegment';
import { EnterpriseRegisterPanel } from './components/EnterpriseRegisterPanel';
import { CaptchaVerifyDialog } from './components/CaptchaVerifyDialog';
import { EmailSuffixField } from './components/EmailSuffixField';
import { ForgotPasswordPanel } from './components/ForgotPasswordPanel';
import { PhoneCNField } from './components/PhoneCNField';
import {
  RegisterIntentSegment,
  type RegisterIntent,
} from './components/RegisterIntentSegment';
import { GlassInput } from './components/GlassInput';
import { GlassPasswordInput } from './components/GlassPasswordInput';

import { Checkbox } from '@no996/ui/checkbox';
import {
  LoginSplitOutlineButton,
  LoginSplitPrimaryButton,
  LoginSplitSpinner,
  LoginSplitTextButton,
} from './components/LoginSplitButtons';
import { Field, FieldError, FieldGroup, FieldLabel } from '@no996/ui/field';
import { toastError, toastSuccess } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  composeEmail,
  DEFAULT_EMAIL_SUFFIX,
  isValidCNPhone,
  isValidComposedEmail,
} from '@/lib/auth/emailDomains';
import {
  useVerificationCodeCooldown,
  verificationCooldownStorageKey,
} from '@/hooks/useVerificationCodeCooldown';
import { demoAccountFor, isLocalHost } from '@/lib/devAccounts';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const { t } = useTranslation('login');
  const { login, loginWithEmailCode, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaPurpose, setCaptchaPurpose] = useState<'registerCode' | 'loginCode' | 'passwordLogin'>('loginCode');
  const [pendingPasswordLogin, setPendingPasswordLogin] = useState<{
    credential: string;
    password: string;
  } | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [workspaceLoginOpen, setWorkspaceLoginOpen] = useState(false);
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [loginEmailPrefix, setLoginEmailPrefix] = useState('');
  const [loginEmailSuffix, setLoginEmailSuffix] = useState<string>(DEFAULT_EMAIL_SUFFIX);
  const [registerEmailPrefix, setRegisterEmailPrefix] = useState('');
  const [registerEmailSuffix, setRegisterEmailSuffix] = useState<string>(DEFAULT_EMAIL_SUFFIX);
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerVerificationCode, setRegisterVerificationCode] = useState('');
  const [registerExtrasOpen, setRegisterExtrasOpen] = useState(false);

  const loginEmail = useMemo(
    () => composeEmail(loginEmailPrefix, loginEmailSuffix),
    [loginEmailPrefix, loginEmailSuffix],
  );
  const registerEmail = useMemo(
    () => composeEmail(registerEmailPrefix, registerEmailSuffix),
    [registerEmailPrefix, registerEmailSuffix],
  );
  const canSendLoginCode = loginEmailPrefix.trim().length > 0;
  const canSendRegisterCode = registerEmailPrefix.trim().length > 0;
  const loginCodeCooldown = useVerificationCodeCooldown(
    verificationCooldownStorageKey('login', loginEmail),
  );
  const registerCodeCooldown = useVerificationCodeCooldown(
    verificationCooldownStorageKey('register', registerEmail),
  );

  const initialMode = useMemo<AuthMode>(() => {
    const m = searchParams.get('mode');
    if (m === 'register') return 'register';
    const code = searchParams.get('invite_code') || searchParams.get('code');
    if (code) return 'register';
    return 'login';
  }, [searchParams]);

  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [mounted, setMounted] = useState(false);

  const [loginIntent, setLoginIntent] = useState<'personal' | 'enterprise'>(() =>
    isLocalHost() ? 'enterprise' : 'personal',
  );
  const [registerIntent, setRegisterIntent] = useState<RegisterIntent>('personal');

  /* 仅登录↔注册重播入场；个人/企业、登录方式切换不 remount，避免整页动画重跑 */
  const loginStaggerKey = authMode;

  const initialInviteCode = useMemo(() => {
    return searchParams.get('invite_code') || searchParams.get('code') || '';
  }, [searchParams]);

  const schema = useMemo(() => {
    if (authMode === 'login') {
      if (loginMethod === 'emailCode') {
        return z.object({
          credential: z.string(),
          password: z.string(),
          confirmPassword: z.string(),
          invite_code: z.string(),
          display_name: z.string(),
        });
      }
      return z.object({
        credential: z.string().min(1, t('credentialRequired')),
        password: z.string().min(6, t('passwordRequired')),
        confirmPassword: z.string(),
        invite_code: z.string(),
        display_name: z.string(),
      });
    }

    return z
      .object({
        password: z.string().min(6, t('passwordRequired')),
        confirmPassword: z.string().min(1, t('confirmPasswordMismatch')),
        invite_code: z.string().min(1, t('inviteCodeRequired')),
        display_name: z.string().optional(),
        credential: z.string().optional(),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: t('confirmPasswordMismatch'),
        path: ['confirmPassword'],
      });
  }, [authMode, loginMethod, t]);

  const localDevLoginDefaults = useMemo(() => {
    if (!isLocalHost()) return null;
    return demoAccountFor('enterprise');
  }, []);

  const form = useForm<{
    credential: string;
    password: string;
    confirmPassword: string;
    invite_code: string;
    display_name: string;
  }>({
    defaultValues: {
      credential: localDevLoginDefaults?.credential ?? '',
      password: localDevLoginDefaults?.password ?? '',
      confirmPassword: '',
      invite_code: '',
      display_name: '',
    },
  });

  useEffect(() => {
    setMounted(true);
    if (initialInviteCode) {
      form.setValue('invite_code', initialInviteCode);
    }
  }, [initialInviteCode, form]);

  useEffect(() => {
    form.clearErrors();
    if (authMode === 'register') {
      setRegisterIntent('personal');
    } else {
      if (isLocalHost()) {
        setLoginIntent('enterprise');
        const demo = demoAccountFor('enterprise');
        form.setValue('credential', demo.credential);
        form.setValue('password', demo.password);
      } else {
        setLoginIntent('personal');
        form.setValue('credential', '');
        form.setValue('password', '');
      }
      setLoginMethod('password');
      setRegisterExtrasOpen(false);
    }
  }, [authMode, form]);

  const registerPassword = form.watch('password');
  const showConfirmPassword =
    authMode === 'register' && registerPassword.trim().length > 0;

  useEffect(() => {
    if (showConfirmPassword) return;
    form.setValue('confirmPassword', '');
    form.clearErrors('confirmPassword');
  }, [showConfirmPassword, form]);

  if (isAuthenticated) {
    return <Navigate to="/workbench" replace />;
  }

  const emailPlaceholder =
    authMode === 'login'
      ? loginIntent === 'enterprise'
        ? t('emailPlaceholder.enterprise')
        : t('emailPlaceholder.personal')
      : registerIntent === 'enterprise'
        ? t('emailPlaceholder.enterprise')
        : t('emailPlaceholder.personal');

  const openWorkspaceLogin = () => {
    setWorkspaceLoginOpen(true);
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    if (mode === 'register') {
      setRegisterIntent('personal');
    } else {
      setLoginMethod('password');
    }
  };

  const submitRegister = async (values: {
    email: string;
    phone: string;
    password: string;
    invite_code?: string;
    display_name?: string;
    code: string;
  }) => {
    setLoading(true);
    try {
      const email = values.email.trim();
      const phone = values.phone.trim();
      await register({
        email,
        phone,
        password: values.password,
        invite_code: values.invite_code?.trim() || undefined,
        display_name: values.display_name?.trim() || undefined,
        code: values.code.trim(),
      });
      toastSuccess(t('registerSuccess'));
      navigate('/workbench');
    } catch (err) {
      toastError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = form.handleSubmit(async (raw) => {
    if (authMode === 'register' && registerIntent === 'enterprise') {
      return;
    }

    form.clearErrors();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          form.setError(field as keyof typeof raw, { message: issue.message });
        }
      }
      return;
    }

    const values = parsed.data;

    if (authMode === 'login') {
      if (!agreedToLegal) {
        toastError(t('loginLegalRequired'));
        return;
      }
      setRememberMe(true);
      if (loginMethod === 'emailCode') {
        const email = composeEmail(loginEmailPrefix, loginEmailSuffix);
        if (!isValidComposedEmail(loginEmailPrefix, loginEmailSuffix)) {
          toastError(t('emailInvalid'));
          return;
        }
        if (!verificationCode.trim()) {
          toastError(t('verificationCodeRequired'));
          return;
        }
        setLoading(true);
        try {
          await loginWithEmailCode(
            email,
            verificationCode,
            intentToApiMode(loginIntent),
            true,
          );
          toastSuccess(t('success'));
          navigate('/workbench');
        } catch (err) {
          toastError(apiErrorMessage(err));
        } finally {
          setLoading(false);
        }
        return;
      }
      setPendingPasswordLogin({
        credential: values.credential ?? '',
        password: values.password,
      });
      setCaptchaPurpose('passwordLogin');
      setCaptchaOpen(true);
      return;
    }

    const email = composeEmail(registerEmailPrefix, registerEmailSuffix);
    if (!isValidComposedEmail(registerEmailPrefix, registerEmailSuffix)) {
      toastError(t('emailInvalid'));
      return;
    }
    if (!isValidCNPhone(registerPhone)) {
      toastError(t('phoneInvalid'));
      return;
    }
    if (!registerVerificationCode.trim()) {
      toastError(t('verificationCodeRequired'));
      return;
    }

    await submitRegister({
      email,
      phone: registerPhone,
      password: values.password,
      invite_code: values.invite_code,
      display_name: values.display_name,
      code: registerVerificationCode,
    });
  });

  const sendRegisterVerificationCode = async (captchaId: string, captchaCode: string) => {
    const email = registerEmail;
    if (!isValidComposedEmail(registerEmailPrefix, registerEmailSuffix)) {
      toastError(t('emailInvalid'));
      return;
    }
    if (registerCodeCooldown.isCoolingDown) {
      toastError(t('verificationCodeCooldown', { seconds: registerCodeCooldown.remaining }));
      return;
    }
    setCodeSending(true);
    try {
      await requestVerificationCode({
        email,
        purpose: 'register',
        captcha_id: captchaId,
        captcha_code: captchaCode,
      });
      registerCodeCooldown.startCooldown();
      toastSuccess(t('verificationCodeSent'));
    } catch (err) {
      const retryAfter = apiRetryAfterSeconds(err);
      if (retryAfter) {
        registerCodeCooldown.startCooldown(retryAfter);
      }
      toastError(apiErrorMessage(err));
    } finally {
      setCodeSending(false);
    }
  };

  const finishPasswordLogin = async (captchaId: string, captchaCode: string) => {
    if (!pendingPasswordLogin) return;
    setLoading(true);
    try {
      await login(
        pendingPasswordLogin.credential,
        pendingPasswordLogin.password,
        intentToApiMode(loginIntent),
        true,
        { captcha_id: captchaId, captcha_code: captchaCode },
      );
      setPendingPasswordLogin(null);
      toastSuccess(t('success'));
      navigate('/workbench');
    } catch (err) {
      toastError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const sendLoginVerificationCode = async (captchaId: string, captchaCode: string) => {
    const email = loginEmail;
    if (!isValidComposedEmail(loginEmailPrefix, loginEmailSuffix)) {
      toastError(t('emailInvalid'));
      return;
    }
    if (loginCodeCooldown.isCoolingDown) {
      toastError(t('verificationCodeCooldown', { seconds: loginCodeCooldown.remaining }));
      return;
    }
    setCodeSending(true);
    try {
      await requestVerificationCode({
        email,
        purpose: 'login',
        captcha_id: captchaId,
        captcha_code: captchaCode,
      });
      loginCodeCooldown.startCooldown();
      toastSuccess(t('verificationCodeSent'));
    } catch (err) {
      const retryAfter = apiRetryAfterSeconds(err);
      if (retryAfter) {
        loginCodeCooldown.startCooldown(retryAfter);
      }
      toastError(apiErrorMessage(err));
    } finally {
      setCodeSending(false);
    }
  };

  return (
    <div className="login-page login-page--split">
      <div
        className={cn(
          'login-page__grid',
          mounted ? 'login-page__grid--mounted' : 'login-page__grid--initial',
        )}
      >
        <section
          className={cn(
            'login-page__form-pane login-form-panel',
            authMode === 'register' && 'login-shell--register',
          )}
        >
          <div className="login-form-inner">
            <LoginWorkbenchLockup className="login-page__lockup login-delay-100" />

            <div key={loginStaggerKey} className="login-stagger-surface">
            <form className="login-form login-form--auth login-split-form flex flex-col" onSubmit={onSubmit}>
              <FieldGroup>
                {authMode === 'login' ? (
                  <div className="login-delay-400">
                    <LoginIntentSegment
                      value={loginIntent}
                      onChange={(next) => {
                        if (next !== 'personal' && next !== 'enterprise') return;
                        setLoginIntent(next);
                        setLoginMethod('password');
                        if (isLocalHost()) {
                          const demo = demoAccountFor(next);
                          form.setValue('credential', demo.credential);
                          form.setValue('password', demo.password);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="login-delay-400">
                    <RegisterIntentSegment
                      value={registerIntent}
                      onChange={setRegisterIntent}
                    />
                  </div>
                )}

                {authMode === 'register' && registerIntent === 'enterprise' ? (
                  <EnterpriseRegisterPanel className="login-delay-500" />
                ) : (
                  <>
                    {authMode === 'login' ? (
                      loginMethod === 'password' ? (
                        <Field
                          data-invalid={!!form.formState.errors.credential}
                          className="login-delay-500"
                        >
                          <FieldLabel htmlFor="login-credential">{t('credentialLabel')}</FieldLabel>
                          <GlassInput
                            id="login-credential"
                            placeholder={emailPlaceholder}
                            aria-invalid={!!form.formState.errors.credential}
                            {...form.register('credential')}
                          />
                          <FieldError>{form.formState.errors.credential?.message}</FieldError>
                        </Field>
                      ) : (
                        <>
                          <Field className="login-delay-500">
                            <FieldLabel htmlFor="login-email-prefix">{t('registerEmailLabel')}</FieldLabel>
                            <EmailSuffixField
                              id="login-email-prefix"
                              prefix={loginEmailPrefix}
                              suffix={loginEmailSuffix}
                              onPrefixChange={setLoginEmailPrefix}
                              onSuffixChange={setLoginEmailSuffix}
                            />
                          </Field>
                          <Field className="login-delay-550">
                            <FieldLabel htmlFor="login-verification-code">{t('verificationCodeLabel')}</FieldLabel>
                            <div className="login-split-code-row">
                              <GlassInput
                                id="login-verification-code"
                                placeholder={t('verificationCodePlaceholder')}
                                value={verificationCode}
                                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                maxLength={6}
                                inputMode="numeric"
                                className="flex-1"
                              />
                              <LoginSplitOutlineButton
                                disabled={codeSending || loginCodeCooldown.isCoolingDown || !canSendLoginCode}
                                onClick={() => {
                                  if (loginCodeCooldown.isCoolingDown || !canSendLoginCode) return;
                                  setCaptchaPurpose('loginCode');
                                  setCaptchaOpen(true);
                                }}
                              >
                                {codeSending ? <LoginSplitSpinner /> : null}
                                {loginCodeCooldown.isCoolingDown
                                  ? t('sendVerificationCodeCooldown', { seconds: loginCodeCooldown.remaining })
                                  : t('sendVerificationCode')}
                              </LoginSplitOutlineButton>
                            </div>
                          </Field>
                        </>
                      )
                    ) : (
                      <>
                        <Field className="login-delay-500">
                          <FieldLabel htmlFor="register-email-prefix" required>
                            {t('registerEmailLabel')}
                          </FieldLabel>
                          <EmailSuffixField
                            id="register-email-prefix"
                            prefix={registerEmailPrefix}
                            suffix={registerEmailSuffix}
                            onPrefixChange={setRegisterEmailPrefix}
                            onSuffixChange={setRegisterEmailSuffix}
                          />
                        </Field>
                        <Field className="login-delay-550">
                          <FieldLabel htmlFor="register-phone" required>
                            {t('registerPhoneLabel')}
                          </FieldLabel>
                          <PhoneCNField
                            id="register-phone"
                            value={registerPhone}
                            onChange={setRegisterPhone}
                          />
                        </Field>
                        <Field className="login-delay-600">
                          <FieldLabel htmlFor="register-verification-code" required>
                            {t('verificationCodeLabel')}
                          </FieldLabel>
                          <div className="login-split-code-row">
                            <GlassInput
                              id="register-verification-code"
                              placeholder={t('verificationCodePlaceholder')}
                              value={registerVerificationCode}
                              onChange={(event) =>
                                setRegisterVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                              }
                              maxLength={6}
                              inputMode="numeric"
                              className="flex-1"
                            />
                            <LoginSplitOutlineButton
                              disabled={codeSending || registerCodeCooldown.isCoolingDown || !canSendRegisterCode}
                              onClick={() => {
                                if (registerCodeCooldown.isCoolingDown || !canSendRegisterCode) return;
                                setCaptchaPurpose('registerCode');
                                setCaptchaOpen(true);
                              }}
                            >
                              {codeSending ? <LoginSplitSpinner /> : null}
                              {registerCodeCooldown.isCoolingDown
                                ? t('sendVerificationCodeCooldown', { seconds: registerCodeCooldown.remaining })
                                : t('sendVerificationCode')}
                            </LoginSplitOutlineButton>
                          </div>
                        </Field>
                      </>
                    )}

                    {(authMode === 'register' || (authMode === 'login' && loginMethod === 'password')) && (
                      <Field
                        data-invalid={!!form.formState.errors.password}
                        className={authMode === 'register' ? 'login-delay-650' : 'login-delay-600'}
                      >
                        <FieldLabel htmlFor="login-password" required={authMode === 'register'}>
                          {t('passwordLabel')}
                        </FieldLabel>
                        <GlassPasswordInput
                          id="login-password"
                          placeholder={t('passwordPlaceholder')}
                          aria-invalid={!!form.formState.errors.password}
                          {...form.register('password')}
                        />
                        <FieldError>{form.formState.errors.password?.message}</FieldError>
                      </Field>
                    )}

                    {authMode === 'register' && showConfirmPassword && (
                      <Field
                        data-invalid={!!form.formState.errors.confirmPassword}
                        className="login-delay-700 login-split-reveal"
                      >
                        <FieldLabel htmlFor="register-confirm-password" required>
                          {t('confirmPasswordLabel')}
                        </FieldLabel>
                        <GlassPasswordInput
                          id="register-confirm-password"
                          placeholder={t('confirmPasswordPlaceholder')}
                          aria-invalid={!!form.formState.errors.confirmPassword}
                          {...form.register('confirmPassword')}
                        />
                        <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
                      </Field>
                    )}

                    {authMode === 'register' && (
                      <Field
                        data-invalid={!!form.formState.errors.invite_code}
                        className="login-delay-750"
                      >
                        <FieldLabel htmlFor="register-invite" required>
                          {t('inviteCodeLabel')}
                        </FieldLabel>
                        <GlassInput
                          id="register-invite"
                          placeholder={t('inviteCodePlaceholder')}
                          aria-invalid={!!form.formState.errors.invite_code}
                          {...form.register('invite_code')}
                        />
                        <FieldError>{form.formState.errors.invite_code?.message}</FieldError>
                      </Field>
                    )}

                    {authMode === 'register' && (
                      <div className="login-split-optional login-delay-800">
                        <button
                          type="button"
                          className="login-split-optional__toggle"
                          aria-expanded={registerExtrasOpen}
                          onClick={() => setRegisterExtrasOpen((open) => !open)}
                        >
                          {registerExtrasOpen
                            ? t('registerOptionalCollapse')
                            : t('registerOptionalExpand')}
                        </button>
                        {registerExtrasOpen ? (
                          <div className="login-split-optional__body">
                            <Field
                              data-invalid={!!form.formState.errors.display_name}
                            >
                              <FieldLabel htmlFor="register-display-name">
                                {t('displayNameLabel')}
                              </FieldLabel>
                              <GlassInput
                                id="register-display-name"
                                placeholder={t('displayNamePlaceholder')}
                                aria-invalid={!!form.formState.errors.display_name}
                                {...form.register('display_name')}
                              />
                              <FieldError>{form.formState.errors.display_name?.message}</FieldError>
                            </Field>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </FieldGroup>

              {authMode === 'login' && (
                <div className="login-form-checks login-delay-650">
                  <label className="login-form-checks__item">
                    <Checkbox
                      checked={agreedToLegal}
                      onCheckedChange={(checked) => setAgreedToLegal(checked === true)}
                    />
                    <LoginLegalLinksText />
                  </label>
                </div>
              )}

              {(authMode === 'login' ||
                (authMode === 'register' && registerIntent === 'personal')) &&
                (authMode === 'login' ? (
                  <LoginSplitPrimaryButton
                    className="login-delay-700"
                    disabled={loading || !agreedToLegal}
                  >
                    {loading ? <LoginSplitSpinner /> : null}
                    {t('submit')}
                  </LoginSplitPrimaryButton>
                ) : (
                  <LoginSplitPrimaryButton className="login-delay-825" disabled={loading}>
                    {loading ? <LoginSplitSpinner /> : null}
                    {t('registerSubmit')}
                  </LoginSplitPrimaryButton>
                ))}
            </form>

            <div
              className={cn(
                'login-mode-switch-row login-delay-800',
                authMode === 'register' && 'login-mode-switch-row--center',
              )}
            >
              <p className="login-mode-switch">
                {authMode === 'login' ? (
                  <>
                    {t('modeSwitchPromptRegister')}{' '}
                    <button
                      type="button"
                      className="login-mode-switch__action"
                      onClick={() => switchMode('register')}
                    >
                      {t('modeSwitchActionRegister')}
                    </button>
                  </>
                ) : (
                  <>
                    {t('modeSwitchPromptLogin')}{' '}
                    <button
                      type="button"
                      className="login-mode-switch__action"
                      onClick={() => switchMode('login')}
                    >
                      {t('modeSwitchActionLogin')}
                    </button>
                  </>
                )}
              </p>
              {authMode === 'login' && loginMethod === 'password' ? (
                <LoginSplitTextButton
                  className="login-form-extras__link login-mode-switch-row__forgot"
                  onClick={() => setForgotOpen(true)}
                >
                  {t('forgotPassword')}
                </LoginSplitTextButton>
              ) : null}
            </div>

            {authMode === 'login' && (
              <LoginAlternateMethodsBar
                loginMethod={loginMethod}
                onSelectPassword={() => setLoginMethod('password')}
                onSelectEmailCode={() => setLoginMethod('emailCode')}
                onSelectPlatform={() => openWorkspaceLogin()}
              />
            )}
            </div>
          </div>
        </section>

        <LoginBrandAside />
      </div>

      <CaptchaVerifyDialog
        open={captchaOpen}
        onOpenChange={setCaptchaOpen}
        onSuccess={(captchaId, captchaCode) => {
          if (captchaPurpose === 'passwordLogin') {
            void finishPasswordLogin(captchaId, captchaCode);
            return;
          }
          if (captchaPurpose === 'loginCode') {
            void sendLoginVerificationCode(captchaId, captchaCode);
            return;
          }
          if (captchaPurpose === 'registerCode') {
            void sendRegisterVerificationCode(captchaId, captchaCode);
          }
        }}
      />

      <ForgotPasswordPanel
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        onSuccess={() => {
          setLoginMethod('password');
        }}
      />

      <WorkspaceLoginDialog
        open={workspaceLoginOpen}
        onOpenChange={setWorkspaceLoginOpen}
        keepSignedIn={true}
        onSuccess={() => navigate('/workbench')}
      />
    </div>
  );
}
