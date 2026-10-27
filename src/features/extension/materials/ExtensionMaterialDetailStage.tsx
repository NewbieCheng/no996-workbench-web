import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import type { SavedMaterial } from '../../../services/materials/material-repository'
import {
  materialBodyText,
  materialCoverUrl,
  materialDisplayTitle,
} from './material-media'
import {
  materialBodyFallbackAt,
  materialCoverFallback,
  materialMediaFromSaved,
} from './material-media-helpers'
import { MaterialAttachmentStrip, type AttachmentLightboxRequest } from './MaterialAttachmentStrip'
import { MaterialMediaFrame } from './MaterialMediaFrame'
import { WorkbenchMediaImage } from './WorkbenchMediaImage'
import { readMaterialPersistImages } from './material-settings'
import { hydrateMaterialFallbacks } from '../../../services/materials/material-asset-hydration'

type Props = {
  materials: SavedMaterial[]
  activeId: string
  onBack: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onAfterHydrate?: () => void
  platformLabel: (platformId: SavedMaterial['platformId']) => string
}

export function ExtensionMaterialDetailStage({
  materials,
  activeId,
  onBack,
  onSelect,
  onDelete,
  onAfterHydrate,
  platformLabel,
}: Props) {
  const { t } = useTranslation('extension')
  const active = materials.find((m) => m.id === activeId) ?? materials[0]
  const [mediaFocus, setMediaFocus] = useState<AttachmentLightboxRequest | null>(null)

  const media = useMemo(() => (active ? materialMediaFromSaved(active) : null), [active])

  useEffect(() => {
    if (!active || !readMaterialPersistImages()) return
    const needsHydrate =
      !active.imageFallbackDataUrls?.some(Boolean) && !active.coverFallbackDataUrl
    if (!needsHydrate) return
    void hydrateMaterialFallbacks(active.id).then(() => onAfterHydrate?.())
  }, [active?.id, onAfterHydrate])

  const statsChips = useMemo(() => {
    if (!active) return []
    const chips: string[] = []
    if (active.likes != null) chips.push(t('materialLikes', { count: active.likes }))
    if (active.comments != null) chips.push(t('materialComments', { count: active.comments }))
    if (active.collects != null) chips.push(t('materialCollects', { count: active.collects }))
    return chips
  }, [active, t])

  if (!active || !media) return null

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(active.url)
    } catch {
      // ignore
    }
  }

  return (
    <div className="wb-material-detail-wrap">
      <div className="wb-material-detail-toolbar">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft size={16} />
          {t('materialBackToLibrary')}
        </Button>
        <div className="wb-material-detail-toolbar-actions">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void handleCopyLink()}>
            <Copy size={14} />
            {t('materialCopyPostLink')}
          </Button>
          <a
            href={active.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2"
          >
            <ExternalLink size={14} />
            {t('materialOpenSource')}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 gap-1"
            onClick={() => onDelete(active.id)}
          >
            <Trash2 size={14} />
            {t('deleteBtn')}
          </Button>
        </div>
      </div>

      <div className="wb-material-detail-layout">
        <aside className="wb-material-rail" aria-label={t('materialRailLabel')}>
          <div className="wb-material-rail-head">
            <span>{t('materialRailRecords')}</span>
            <strong>{materials.length}</strong>
          </div>
          <ul className="wb-material-rail-list">
            {materials.map((m) => {
              const cover = materialCoverUrl(m)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className={`wb-material-rail-item${m.id === active.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setMediaFocus(null)
                      onSelect(m.id)
                    }}
                  >
                    <span className="wb-material-rail-thumb">
                      {cover ? (
                        <WorkbenchMediaImage
                          url={cover}
                          fallbackDataUrl={
                            materialBodyFallbackAt(m, 0) ?? materialCoverFallback(m)
                          }
                          alt=""
                        />
                      ) : (
                        '·'
                      )}
                    </span>
                    <span className="wb-material-rail-copy">
                      <strong>{materialDisplayTitle(m)}</strong>
                      {m.author ? <p>{m.author}</p> : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="wb-material-stage">
          <header className="wb-material-stage-head">
            <h2 className="wb-material-stage-title">{materialDisplayTitle(active)}</h2>
            <p className="wb-material-stage-meta">
              {platformLabel(active.platformId)}
              {active.author ? ` · ${active.author}` : ` · ${t('unknownAuthor')}`}
            </p>
            {statsChips.length ? (
              <div className="wb-material-stage-chips">
                {statsChips.map((chip) => (
                  <span key={chip} className="wb-material-chip">{chip}</span>
                ))}
              </div>
            ) : null}
          </header>

          <MaterialMediaFrame
            material={active}
            images={media.images}
            videos={media.videos}
            covers={media.covers}
            title={materialDisplayTitle(active)}
            pageUrl={active.url}
            initialTab={mediaFocus?.initialTab}
            initialIndex={mediaFocus?.initialIndex ?? 0}
          />

          <div className="wb-material-attach-block">
            <span className="wb-material-attach-label">{t('materialAttachments')}</span>
            <MaterialAttachmentStrip
              material={active}
              images={media.images}
              videos={media.videos}
              covers={media.covers}
              firstBodySharesCover={media.firstBodySharesCover}
              onOpenMedia={(req) => setMediaFocus(req)}
            />
          </div>

          <div className="wb-material-stage-body">
            <p className="wb-material-stage-content">{materialBodyText(active) || t('materialNoBody')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
