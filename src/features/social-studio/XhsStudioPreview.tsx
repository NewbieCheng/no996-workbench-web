import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  composePublishHtml,
  composeXhsNoteDesc,
  effectiveXhsMaterialType,
} from '../../services/social-publish/compose'
import type { XhsPublishMode } from '../../services/social-publish/types'
import type { SocialContentMode } from './studio-types'

function XhsPcPanel({ children }: { children: ReactNode }) {
  return <div className="studio-preview-canvas__pc-card social-studio-xhs-pc-panel">{children}</div>
}
type Props = {
  title: string
  content: string
  summary: string
  imageUrls: string[]
  contentMode: SocialContentMode
  xhsPublishMode: XhsPublishMode
}

export function XhsStudioPreview({ title, content, summary, imageUrls, contentMode, xhsPublishMode }: Props) {
  const { t } = useTranslation('socialPublish')
  const modeOverride = contentMode === 'article' ? 'article' : contentMode === 'image_text' ? 'image_text' : xhsPublishMode
  const materialType = effectiveXhsMaterialType(modeOverride, imageUrls)
  const noteDesc = useMemo(() => composeXhsNoteDesc(content), [content])
  const publishHtml = useMemo(() => composePublishHtml(content, imageUrls), [content, imageUrls])

  if (materialType === 'image_text') {
    return (
      <XhsPcPanel>
        <div className="social-xhs-note-title">{title || t('defaultNoteTitle')}</div>
        {imageUrls.length > 0 ? (
          <div className="social-image-gallery" style={{ marginBottom: '0.75rem' }}>
            {imageUrls.map((url) => (
              <img key={url} src={url} alt="" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-2">{t('studioImageTextPreviewNeedImages')}</p>
        )}
        <div className="social-xhs-desc">{noteDesc.desc || t('emptyBody')}</div>
      </XhsPcPanel>
    )
  }

  return (
    <XhsPcPanel>
      <h2 className="social-xhs-note-title">{title || t('defaultArticleTitle')}</h2>
      {summary ? <p className="social-xhs-article-summary">{summary}</p> : null}
      {imageUrls[0] ? <img className="social-xhs-article-cover" src={imageUrls[0]} alt="" /> : null}
      <div className="social-weixin-html" dangerouslySetInnerHTML={{ __html: publishHtml }} />
    </XhsPcPanel>
  )
}

export function resolveXhsModeForStudio(contentMode: SocialContentMode, xhsPublishMode: XhsPublishMode): XhsPublishMode {
  if (contentMode === 'article') return 'article'
  if (contentMode === 'image_text') return 'image_text'
  return xhsPublishMode
}
