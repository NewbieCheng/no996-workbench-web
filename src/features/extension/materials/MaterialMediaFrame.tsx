import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import type { SavedMaterial } from '../../../services/materials/material-repository'
import {
  defaultMaterialMediaTab,
  materialBodyFallbackAt,
  materialCoverFallback,
  type MaterialMediaTab,
} from './material-media-helpers'
import { WorkbenchMediaImage } from './WorkbenchMediaImage'
import { WorkbenchMediaVideo } from './WorkbenchMediaVideo'

type Props = {
  material: SavedMaterial
  images: string[]
  videos: string[]
  covers: string[]
  title: string
  pageUrl?: string
  initialTab?: MaterialMediaTab
  initialIndex?: number
}

function MediaTabBar({
  tab,
  onChange,
  imageCount,
  videoCount,
  coverCount,
}: {
  tab: MaterialMediaTab
  onChange: (tab: MaterialMediaTab) => void
  imageCount: number
  videoCount: number
  coverCount: number
}) {
  const { t } = useTranslation('extension')

  return (
    <div className="wb-material-media-tabs" role="tablist" aria-label={t('materialMediaTabs')}>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'image'}
        className={tab === 'image' ? 'is-active' : undefined}
        disabled={!imageCount}
        onClick={() => onChange('image')}
      >
        {t('materialTabImages', { count: imageCount })}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'video'}
        className={tab === 'video' ? 'is-active' : undefined}
        disabled={!videoCount}
        onClick={() => onChange('video')}
      >
        {t('materialTabVideos', { count: videoCount })}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'cover'}
        className={tab === 'cover' ? 'is-active' : undefined}
        disabled={!coverCount}
        onClick={() => onChange('cover')}
      >
        {t('materialTabCovers', { count: coverCount })}
      </button>
    </div>
  )
}

export function MaterialMediaFrame({
  material,
  images,
  videos,
  covers,
  title,
  pageUrl,
  initialTab,
  initialIndex = 0,
}: Props) {
  const { t } = useTranslation('extension')
  const [tab, setTab] = useState<MaterialMediaTab>(() =>
    defaultMaterialMediaTab(images, videos, covers, initialTab),
  )
  const [slide, setSlide] = useState(initialIndex)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)

  useEffect(() => {
    setTab(defaultMaterialMediaTab(images, videos, covers, initialTab))
    setSlide(initialIndex)
    setLightboxOpen(false)
    setVideoFailed(false)
  }, [material.id, images.join('|'), videos.join('|'), covers.join('|'), initialTab, initialIndex])

  const list = tab === 'video' ? videos : tab === 'cover' ? covers : images
  const safeSlide = list.length ? Math.min(slide, list.length - 1) : 0
  const activeUrl = list[safeSlide]
  const poster = covers[0] ?? images[0]
  const activeVideo = videos[0]

  const fallbackForUrl = (url: string, kind: 'body' | 'cover') => {
    if (kind === 'cover') return materialCoverFallback(material)
    const idx = images.indexOf(url)
    return idx >= 0 ? materialBodyFallbackAt(material, idx) : undefined
  }

  return (
    <section className="wb-material-media-panel" aria-label={t('materialMediaPreview')}>
      <MediaTabBar
        tab={tab}
        onChange={(next) => {
          setTab(next)
          setSlide(0)
          setLightboxOpen(false)
          setVideoFailed(false)
        }}
        imageCount={images.length}
        videoCount={videos.length}
        coverCount={covers.length}
      />

      {tab === 'video' && videoFailed ? (
        <div className="wb-material-media wb-material-media-empty">
          <span>{t('materialVideoUnavailable')}</span>
          {pageUrl ? (
            <a className="wb-material-link-ghost" href={pageUrl} target="_blank" rel="noreferrer">
              {t('materialOpenSource')}
            </a>
          ) : null}
        </div>
      ) : tab === 'video' && activeVideo ? (
        <>
          <div className="wb-material-media wb-material-media-video-shell">
            {poster ? (
              <WorkbenchMediaImage
                url={poster}
                fallbackDataUrl={covers[0] ? materialCoverFallback(material) : materialBodyFallbackAt(material, 0)}
                alt={title}
                className="wb-material-media-image wb-material-media-poster"
              />
            ) : (
              <div className="wb-material-media-empty">
                <span>{t('materialVideoPreview')}</span>
              </div>
            )}
            <button
              type="button"
              className="wb-material-play-btn"
              onClick={() => setLightboxOpen(true)}
              aria-label={t('materialPlayVideo')}
            >
              <Play size={22} fill="currentColor" />
              <span>{t('materialTapToPlay')}</span>
            </button>
          </div>
          {lightboxOpen ? (
            <div className="wb-material-lightbox" role="dialog" aria-modal="true" aria-label={t('materialPlayVideo')}>
              <button
                type="button"
                className="wb-material-lightbox-backdrop"
                aria-label={t('materialClose')}
                onClick={() => setLightboxOpen(false)}
              />
              <div className="wb-material-lightbox-panel">
                <div className="wb-material-lightbox-top">
                  <span className="wb-material-lightbox-title">{t('materialPlayVideo')}</span>
                  <button type="button" className="wb-material-link-ghost" onClick={() => setLightboxOpen(false)}>
                    {t('materialClose')}
                  </button>
                </div>
                <WorkbenchMediaVideo
                  src={activeVideo}
                  className="wb-material-lightbox-video"
                  poster={poster}
                  onExhausted={() => {
                    setVideoFailed(true)
                    setLightboxOpen(false)
                  }}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : list.length && activeUrl ? (
        <div className="wb-material-media wb-material-media-carousel">
          <WorkbenchMediaImage
            key={activeUrl}
            url={activeUrl}
            fallbackDataUrl={fallbackForUrl(activeUrl, tab === 'cover' ? 'cover' : 'body')}
            alt={`${title} (${safeSlide + 1}/${list.length})`}
            className="wb-material-media-image"
            expiredMessage={t('materialLinkExpired')}
          />
          {list.length > 1 ? (
            <>
              <button
                type="button"
                className="wb-material-carousel-nav prev"
                onClick={() => setSlide((c) => (c - 1 + list.length) % list.length)}
                aria-label={t('materialPrevImage')}
              >
                ‹
              </button>
              <button
                type="button"
                className="wb-material-carousel-nav next"
                onClick={() => setSlide((c) => (c + 1) % list.length)}
                aria-label={t('materialNextImage')}
              >
                ›
              </button>
              <div className="wb-material-carousel-meta">
                <span>{safeSlide + 1}/{list.length}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="wb-material-media wb-material-media-empty">
          <span>
            {tab === 'cover' ? t('materialNoCoverTab') : tab === 'video' ? t('materialNoVideo') : t('materialNoImages')}
          </span>
          {pageUrl ? (
            <a className="wb-material-link-ghost" href={pageUrl} target="_blank" rel="noreferrer">
              {t('materialOpenSource')}
            </a>
          ) : null}
        </div>
      )}
    </section>
  )
}
