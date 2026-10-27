import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SavedMaterial } from '../../../services/materials/material-repository'
import { materialBodyFallbackAt, materialCoverFallback, type MaterialMediaTab } from './material-media-helpers'
import { WorkbenchMediaImage } from './WorkbenchMediaImage'

const PREVIEW_LIMIT = 8

export type AttachmentLightboxRequest = {
  initialTab: MaterialMediaTab
  initialIndex: number
}

type Props = {
  material: SavedMaterial
  images: string[]
  videos: string[]
  covers: string[]
  firstBodySharesCover: boolean
  onOpenMedia?: (request: AttachmentLightboxRequest) => void
}

export function MaterialAttachmentStrip({
  material,
  images,
  videos,
  covers,
  firstBodySharesCover,
  onOpenMedia,
}: Props) {
  const { t } = useTranslation('extension')

  const imageItems = images.map((url, index) => ({
    url,
    kind: 'image' as const,
    isCover: firstBodySharesCover && index === 0,
  }))
  const items = [
    ...imageItems,
    ...videos.map((url) => ({
      url,
      kind: 'video' as const,
      poster: covers[0] ?? images[0],
      isCover: false,
    })),
  ]

  if (!items.length) {
    return <span className="wb-material-attach-empty">—</span>
  }

  const visible = items.slice(0, PREVIEW_LIMIT)
  const overflow = items.length - visible.length

  const openAt = (kind: 'image' | 'video', indexInKind: number) => {
    onOpenMedia?.({
      initialTab: kind === 'video' ? 'video' : 'image',
      initialIndex: indexInKind,
    })
  }

  return (
    <div className="wb-material-attach-strip">
      {visible.map((item, index) => {
        const kindIndex =
          item.kind === 'video' ? videos.indexOf(item.url) : images.indexOf(item.url)
        const coverMarked = item.kind === 'image' && item.isCover
        const fallback =
          item.kind === 'image' && kindIndex >= 0
            ? materialBodyFallbackAt(material, kindIndex)
            : undefined

        return (
          <button
            key={`${item.kind}-${item.url}-${index}`}
            type="button"
            className={[
              'wb-material-attach-thumb',
              item.kind === 'video' ? 'is-video' : '',
              coverMarked ? 'is-cover' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => openAt(item.kind, Math.max(0, kindIndex))}
          >
            {item.kind === 'video' ? (
              <>
                <WorkbenchMediaImage
                  url={item.poster}
                  fallbackDataUrl={materialCoverFallback(material) ?? materialBodyFallbackAt(material, 0)}
                  alt=""
                />
                <span className="wb-material-attach-play" aria-hidden>
                  <Play size={14} fill="currentColor" />
                </span>
              </>
            ) : (
              <>
                <WorkbenchMediaImage url={item.url} fallbackDataUrl={fallback} alt="" />
                {coverMarked ? (
                  <span className="wb-material-attach-cover-badge">{t('materialCoverBadge')}</span>
                ) : null}
              </>
            )}
          </button>
        )
      })}
      {overflow > 0 ? <span className="wb-material-attach-more">+{overflow}</span> : null}
    </div>
  )
}
