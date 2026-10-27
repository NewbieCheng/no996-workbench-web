import { GrainGradient } from '@paper-design/shaders-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageMenu } from '@/app/LanguageMenu';
import { ThemeMenu } from '@/app/ThemeMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip';

function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 4.7 10.7 3.6v7.7H3V4.7Zm8.8-1.25L21 2.1v9.2h-9.2V3.45ZM3 12.7h7.7v7.7L3 19.3v-6.6Zm8.8 0H21v9.2l-9.2-1.3v-7.9Z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.05 12.54c-.03-3.02 2.47-4.47 2.58-4.54-1.41-2.06-3.6-2.34-4.38-2.37-1.86-.19-3.64 1.1-4.58 1.1-.95 0-2.42-1.07-3.98-1.04-2.05.03-3.94 1.19-4.99 3.02-2.13 3.69-.54 9.16 1.53 12.15 1.01 1.46 2.22 3.1 3.81 3.04 1.53-.06 2.11-.99 3.96-.99s2.37.99 3.99.96c1.65-.03 2.69-1.49 3.69-2.96 1.16-1.69 1.64-3.33 1.66-3.41-.04-.02-3.2-1.23-3.24-4.87ZM14.03 3.66c.84-1.02 1.41-2.43 1.25-3.84-1.21.05-2.68.81-3.55 1.83-.78.9-1.46 2.34-1.28 3.72 1.35.1 2.73-.69 3.58-1.71Z" />
    </svg>
  );
}

function DesktopDownloadButton({ icon, label, soonLabel }: { icon: ReactNode; label: string; soonLabel: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="login-brand-aside__download-wrap">
            <button
              type="button"
              className="login-brand-aside__download"
              disabled
              aria-disabled="true"
            >
              <span className="login-brand-aside__download-icon-slot">{icon}</span>
              <span className="login-brand-aside__download-label">{label}</span>
            </button>
          </span>
        }
      />
      <TooltipContent>{soonLabel}</TooltipContent>
    </Tooltip>
  );
}

export function LoginBrandAside() {
  const { t } = useTranslation('login');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <aside className="login-brand-aside" aria-label={t('brandPanel.aria')}>
      <div className="login-brand-aside__visual">
        {reduceMotion ? (
          <div className="login-brand-aside__gradient login-brand-aside__gradient--static" aria-hidden="true" />
        ) : (
          <GrainGradient
            speed={1}
            scale={1}
            rotation={0}
            offsetX={0}
            offsetY={0}
            softness={0.5}
            intensity={0.5}
            noise={0.25}
            shape="corners"
            frame={2854.5}
            colors={['#FFFFFF', '#FF6400', '#FC7819', '#FFFFFF']}
            colorBack="#00000000"
            className="login-brand-aside__gradient"
          />
        )}

        <div className="login-brand-aside__chrome login-page__controls--split flex items-center gap-2">
          <LanguageMenu />
          <ThemeMenu />
        </div>
      </div>

      <div className="login-brand-aside__content">
        <h2 className="login-brand-aside__headline">
          {t('brandPanel.headlineLine1')}
          <br />
          {t('brandPanel.headlineLine2')}
        </h2>

        <div className="login-brand-aside__downloads">
          <DesktopDownloadButton
            icon={<WindowsIcon className="login-brand-aside__download-icon" />}
            label={t('brandPanel.desktopDownload')}
            soonLabel={t('brandPanel.desktopDownloadSoon')}
          />
          <DesktopDownloadButton
            icon={<AppleIcon className="login-brand-aside__download-icon" />}
            label={t('brandPanel.desktopDownloadMac')}
            soonLabel={t('brandPanel.desktopDownloadSoon')}
          />
        </div>
      </div>
    </aside>
  );
}
