import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/services/browser';

type RemoteImageStatus = 'pending' | 'loaded' | 'failed';

const CAROUSEL_INTERVAL_MS = 6000;
const PICSUM_HERO_SIZE = '900/1400';

const HERO_SLIDE_META = [
  {
    localSrc: assetUrl('desktop/apps/shell/public/login-hero/slide-1.png'),
    titleKey: 'hero.prop1Title' as const,
    textKey: 'hero.prop1Text' as const,
  },
  {
    localSrc: assetUrl('desktop/apps/shell/public/login-hero/slide-2.png'),
    titleKey: 'hero.prop2Title' as const,
    textKey: 'hero.prop2Text' as const,
  },
  {
    localSrc: assetUrl('desktop/apps/shell/public/login-hero/slide-3.png'),
    titleKey: 'hero.prop3Title' as const,
    textKey: 'hero.prop3Text' as const,
  },
] as const;

function buildPicsumHeroSrc(sessionSeed: string, index: number) {
  return `https://picsum.photos/${PICSUM_HERO_SIZE}?random=${sessionSeed}-${index}`;
}

export function LoginHero() {
  const { t } = useTranslation('login');
  const [activeSlide, setActiveSlide] = useState(0);
  const [mounted, setMounted] = useState(false);
  const picsumSessionSeed = useMemo(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const quotes = useMemo(() => {
    const raw = t('hero.quotes', { returnObjects: true });
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [t]);

  const dailyQuote = useMemo(() => {
    if (!quotes.length) return '';
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return quotes[dayOfYear % quotes.length] ?? quotes[0];
  }, [quotes]);

  const slides = useMemo(
    () =>
      HERO_SLIDE_META.map((slide, index) => ({
        localSrc: slide.localSrc,
        remoteSrc: buildPicsumHeroSrc(picsumSessionSeed, index),
        title: t(slide.titleKey),
        text: t(slide.textKey),
      })),
    [picsumSessionSeed, t],
  );

  const [remoteStatuses, setRemoteStatuses] = useState<RemoteImageStatus[]>(
    () => HERO_SLIDE_META.map(() => 'pending'),
  );

  const markRemoteImage = (index: number, status: Exclude<RemoteImageStatus, 'pending'>) => {
    setRemoteStatuses((current) => {
      if (current[index] === status) return current;
      const next = [...current];
      next[index] = status;
      return next;
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="login-hero" aria-hidden="true">
      <div className="login-hero__compact">
        <img
          src={assetUrl('desktop/apps/shell/public/brand/logo-horizontal-color.svg')}
          alt="不加班"
          style={{ height: 28, width: 'auto' }}
        />
      </div>

      <div
        className={cn(
          'login-hero__inner',
          mounted ? 'login-hero__inner--mounted' : 'login-hero__inner--initial',
        )}
      >
        <div className="login-hero__stage">
          <div className="login-hero__canvas">
            <div className="login-hero__slides" aria-hidden="true">
              {slides.map((slide, index) => (
                <div
                  key={slide.localSrc}
                  className={cn('login-hero__slide', activeSlide === index && 'is-active')}
                >
                  <img
                    src={slide.localSrc}
                    alt=""
                    className="login-hero__slide-img"
                    draggable={false}
                    decoding="async"
                  />
                  {remoteStatuses[index] !== 'failed' && (
                    <img
                      src={slide.remoteSrc}
                      alt=""
                      className={cn(
                        'login-hero__slide-img',
                        'login-hero__slide-img--remote',
                        remoteStatuses[index] === 'loaded' && 'is-loaded',
                      )}
                      draggable={false}
                      decoding="async"
                      onLoad={() => markRemoteImage(index, 'loaded')}
                      onError={() => markRemoteImage(index, 'failed')}
                    />
                  )}
                </div>
              ))}
              <div className="login-hero__slide-scrim" />
            </div>

            <div className="login-hero__overlay">
              <div className="login-hero__overlay-top">
                <header className="login-hero__brand">
                  <img
                    src={assetUrl('desktop/apps/shell/public/brand/logo-horizontal-color.svg')}
                    alt="不加班"
                    className="login-hero__brand-logo"
                    style={{ height: 30, width: 'auto' }}
                  />
                </header>
              </div>

              {dailyQuote && (
                <div className="login-hero__quote" aria-label="Daily Quote">
                  <p className="login-hero__quote-text">{dailyQuote}</p>
                </div>
              )}

              <div className="login-hero__dock">
                <div className="login-hero__dots" role="tablist" aria-label={t('hero.title')}>
                  {slides.map((slide, index) => (
                    <button
                      key={slide.localSrc}
                      type="button"
                      role="tab"
                      aria-selected={activeSlide === index}
                      aria-label={slide.title}
                      className={cn('login-hero__dot', activeSlide === index && 'is-active')}
                      onClick={() => setActiveSlide(index)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
