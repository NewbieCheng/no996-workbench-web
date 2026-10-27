import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import {
  composePublishHtml,
  composeXhsNoteDesc,
  effectiveXhsMaterialType,
  xhsContentLengthHint,
} from '../../services/social-publish/compose'
import type { XhsPublishMode } from '../../services/social-publish/types'
import { copyText } from '../../services/browser'
import { PhoneChrome } from './PhoneChrome'

type XhsPreviewProps = {
  title: string
  content: string
  summary: string
  imageUrls: string[]
  xhsPublishMode: XhsPublishMode
  onXhsPublishModeChange: (v: XhsPublishMode) => void
}

export function XhsPreviewSection({
  title,
  content,
  summary,
  imageUrls,
  xhsPublishMode,
  onXhsPublishModeChange,
}: XhsPreviewProps) {
  const { t } = useTranslation('socialPublish')
  const materialType = effectiveXhsMaterialType(xhsPublishMode, imageUrls)
  const noteDesc = useMemo(() => composeXhsNoteDesc(content), [content])
  const publishHtml = useMemo(() => composePublishHtml(content, imageUrls), [content, imageUrls])
  const lengthHint = useMemo(() => xhsContentLengthHint(content, summary), [content, summary])

  const modeLabel = materialType === 'image_text' ? t('modeNote') : t('modeArticle')

  async function onCopyNote() {
    await copyText(noteDesc.desc)
  }

  return (
    <div>
      <div className="social-preview-toolbar">
        <label>
          {t('publishType')}
          <select value={xhsPublishMode} onChange={(e) => onXhsPublishModeChange(e.target.value as XhsPublishMode)}>
            <option value="auto">{t('publishTypeAuto')}</option>
            <option value="image_text">{t('publishTypeNote')}</option>
            <option value="article">{t('publishTypeArticle')}</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground">{t('currentMode', { mode: modeLabel })}</span>
        {materialType === 'image_text' ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void onCopyNote()}>
            {t('copyNoteDesc')}
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">{t('approxChars', { count: lengthHint })}</span>
      </div>
      {materialType === 'image_text' ? (
        <PhoneChrome platform="xiaohongshu" subtitle={t('subtitleNote')}>
          <div className="social-xhs-note-title">{title || t('defaultNoteTitle')}</div>
          {imageUrls.length > 0 ? (
            <div className="social-image-gallery" style={{ marginBottom: '0.75rem' }}>
              {imageUrls.map((url) => (
                <img key={url} src={url} alt="" />
              ))}
            </div>
          ) : null}
          <div className="social-xhs-desc">{noteDesc.desc || t('emptyBody')}</div>
        </PhoneChrome>
      ) : (
        <PhoneChrome platform="xiaohongshu" subtitle={t('subtitleArticle')}>
          <h2 className="social-xhs-note-title">{title || t('defaultArticleTitle')}</h2>
          {summary ? <p className="social-xhs-article-summary">{summary}</p> : null}
          {imageUrls[0] ? <img className="social-xhs-article-cover" src={imageUrls[0]} alt="" /> : null}
          <div className="social-weixin-html" dangerouslySetInnerHTML={{ __html: publishHtml }} />
        </PhoneChrome>
      )}
    </div>
  )
}
