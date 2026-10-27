import { useTranslation } from 'react-i18next';

import { LOGIN_LEGAL_LINKS } from '@/features/auth/constants/legal-links';
import { cn } from '@/lib/utils';

export function LoginLegalLinksText({ className }: { className?: string }) {
  const { t } = useTranslation('login');

  return (
    <span className={cn('login-legal-notice', className)}>
      <span>{t('loginLegalBefore')}</span>
      <a
        href={LOGIN_LEGAL_LINKS.userAgreement}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {t('userAgreement')}
      </a>
      <span>{t('loginLegalBetween')}</span>
      <a
        href={LOGIN_LEGAL_LINKS.privacyPolicy}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        {t('privacyPolicy')}
      </a>
    </span>
  );
}

/** @deprecated Prefer LoginLegalLinksText inside a checkbox row. */
export function LoginLegalNotice({ className }: { className?: string }) {
  return (
    <p className={className ?? 'login-legal-notice'}>
      <LoginLegalLinksText />
    </p>
  );
}
