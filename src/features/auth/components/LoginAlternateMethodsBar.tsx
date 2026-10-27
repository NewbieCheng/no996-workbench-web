import { Landmark, Lock, Mail, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip';

export function LoginAlternateMethodsBar({
  loginMethod,
  onSelectPassword,
  onSelectEmailCode,
  onSelectPlatform,
  className,
}: {
  loginMethod: 'password' | 'emailCode';
  onSelectPassword: () => void;
  onSelectEmailCode: () => void;
  onSelectPlatform: () => void;
  className?: string;
}) {
  const { t } = useTranslation('login');

  return (
    <div className={className ?? 'login-split-alt-methods login-delay-750'}>
      <div className="login-split-alt-methods__divider" role="presentation">
        <span className="login-split-alt-methods__line" />
        <span className="login-split-alt-methods__label">{t('alternateLoginDivider')}</span>
        <span className="login-split-alt-methods__line" />
      </div>
      <div className="login-split-alt-methods__icons" role="group" aria-label={t('moreLoginMethods')}>
        {loginMethod === 'password' ? (
          <button
            type="button"
            className="login-split-alt-methods__icon-btn"
            aria-label={t('switchToEmailCode')}
            onClick={onSelectEmailCode}
          >
            <Mail aria-hidden strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            className="login-split-alt-methods__icon-btn"
            aria-label={t('switchToPassword')}
            onClick={onSelectPassword}
          >
            <Lock aria-hidden strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          className="login-split-alt-methods__icon-btn"
          aria-label={t('workspaceLogin.title.platform')}
          onClick={onSelectPlatform}
        >
          <Landmark aria-hidden strokeWidth={1.75} />
        </button>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="login-split-alt-methods__icon-btn is-disabled"
                disabled
                aria-disabled="true"
                aria-label={t('switchToPhoneCode')}
              >
                <Smartphone aria-hidden strokeWidth={1.75} />
              </button>
            }
          />
          <TooltipContent>{t('phoneCodeLoginUnavailable')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
