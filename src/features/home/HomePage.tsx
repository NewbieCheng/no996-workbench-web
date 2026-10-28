import { ArrowRight, Puzzle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { navigation, type NavItem } from '../../app/navigation'

const BENTO_LAYOUT: Record<string, string> = {
  persona: 'home-bento-card--persona',
  'product-position': 'home-bento-card--product',
  titles: 'home-bento-card--titles',
  'video-script': 'home-bento-card--video',
  'live-script': 'home-bento-card--live',
  xiaohongshu: 'home-bento-card--xhs',
  'wechat-article': 'home-bento-card--wechat',
  moments: 'home-bento-card--moments',
}

const PERSONA_BARS = [
  { key: 'homePersonaBarIdentity', width: '82%' },
  { key: 'homePersonaBarBusiness', width: '58%' },
  { key: 'homePersonaBarAudience', width: '70%' },
] as const

function ToolIcon({ item }: { item: NavItem }) {
  return <item.icon size={22} strokeWidth={1.8} aria-hidden />
}

export default function HomePage() {
  const { t, i18n } = useTranslation('workbench')
  const date = new Intl.DateTimeFormat(i18n.language, {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
  const contentTools = navigation.filter((item) => item.group === '内容创作' && item.path)
  const avTools = navigation.filter((item) => item.group === '音视频' && item.path)

  return (
    <>
      <header className="home-hero">
        <div className="home-hero-copy">
          <div className="home-hero-meta">
            <span className="home-pill">{date}</span>
          </div>
          <h1 className="home-hero-title" aria-label={t('homeHeadline')}>
            {t('homeHeroLead') ? (
              <>
                <span className="home-hero-lead">{t('homeHeroLead')}</span>
                <br />
              </>
            ) : null}
            <span>{t('homeHeroBefore')}</span>
            <span className="home-grad">{t('homeHeroAccent')}</span>
            {t('homeHeroAfter') ? <span>{t('homeHeroAfter')}</span> : null}
          </h1>
          <p className="home-hero-sub">{t('homeSubhead')}</p>
          <p className="home-hero-persona">
            <strong>{t('homePersonaTitle')}</strong>
            {t('homePersonaBody')}
          </p>
          <Link className="home-cta" to="/workbench/persona">
            {t('homePersonaCta')}
            <ArrowRight size={18} strokeWidth={2.4} aria-hidden />
          </Link>
        </div>

        <aside className="home-trial" aria-label={t('homeTrialCaption')}>
          <div>
            <span className="home-trial-caption">{t('homeTrialCaption')}</span>
            <div className="home-trial-title">
              <span className="home-trial-num">3</span>
              <span className="home-trial-unit">{t('homeTrialUnit')}</span>
            </div>
            <p className="home-trial-body">{t('homeTrialBody')}</p>
          </div>
          <Link className="home-trial-link" to="/workbench/membership">
            {t('homeTrialLink')}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </aside>
      </header>

      <section className="home-section" aria-labelledby="content-tools-title">
        <div className="home-section-heading">
          <h2 id="content-tools-title">{t('homeContentSection')}</h2>
          <span>{t('homeContentHint')}</span>
        </div>
        <div className="home-bento">
          {contentTools.map((item, index) => {
            const n = String(index + 1).padStart(2, '0')
            const featured = item.id === 'persona'
            return (
              <Link
                key={item.id}
                className={`home-bento-card ${BENTO_LAYOUT[item.id] ?? ''} ${featured ? 'home-bento-card--feat' : ''}`}
                to={item.path!}
              >
                <span className="home-bento-no">
                  {n}
                  {featured ? ` · ${t('homeStartLabel')}` : ''}
                </span>
                <span className="home-bento-ic">
                  <ToolIcon item={item} />
                </span>
                <h3>{t(item.labelKey)}</h3>
                <p>{t(item.descriptionKey)}</p>
                {featured ? (
                  <div className="home-persona-bars" aria-hidden>
                    {PERSONA_BARS.map((bar) => (
                      <div key={bar.key} className="home-persona-bar">
                        <span>{t(bar.key)}</span>
                        <div className="home-bar">
                          <i style={{ width: bar.width }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <span className="home-bento-ar" aria-hidden>
                  <ArrowRight size={16} strokeWidth={2.4} />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="home-section home-section--more" aria-label={t('homeMoreAria')}>
        <div className="home-section-heading">
          <h2>{t('homeAvSection')}</h2>
          <span>{t('homeAvHint')}</span>
        </div>
        <div className="home-more-grid">
          <div className="home-av-panel">
            {avTools.map((item) => (
              <Link className="home-av-row" to={item.path!} key={item.id}>
                <div>
                  <strong>{t(item.labelKey)}</strong>
                  <p>{t(item.descriptionKey)}</p>
                </div>
                <ArrowRight size={18} strokeWidth={2.2} className="home-av-row__arrow" aria-hidden />
              </Link>
            ))}
          </div>
          <div className="home-extension">
            <Puzzle size={22} strokeWidth={1.6} aria-hidden />
            <h3>{t('homeExtensionTitle')}</h3>
            <p>{t('homeExtensionBody')}</p>
            <Link className="home-extension-link" to="/workbench/extension">
              {t('homeExtensionCta')}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </section>

    </>
  )
}
