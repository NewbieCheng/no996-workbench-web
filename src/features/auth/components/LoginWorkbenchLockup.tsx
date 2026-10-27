import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/ThemeProvider';
import { assetUrl } from '@/services/browser';

/** Dark uses the new dark lockup; light keeps the color horizontal lockup.
 * 旧白版 viewBox 1559×356，新深色版 1898×470；外框尺寸由 CSS 统一锁定，
 * 详见 login-split-auth.css `.login-page--split .login-page__lockup-img`。 */
const LOCKUP_LIGHT = 'desktop/apps/shell/public/brand/logo-horizontal-color.svg';
const LOCKUP_DARK = 'desktop/apps/shell/public/brand/lockup-dark-white-orange.min.svg';

export function LoginWorkbenchLockup({ className }: { className?: string }) {
  const { dark } = useTheme();
  const { t } = useTranslation('login');
  const src = assetUrl(dark ? LOCKUP_DARK : LOCKUP_LIGHT);

  return (
    <div className={className}>
      <img
        className="login-page__lockup-img"
        src={src}
        alt={t('workbenchLockupAlt')}
        width={330}
        height={68}
        decoding="async"
      />
    </div>
  );
}
