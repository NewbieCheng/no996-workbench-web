import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import {
  composeWechatArticlePreview,
  composeWechatImageDraftPreview,
  effectiveWechatPreviewMode,
  makePayload,
  makeSourceArticle,
} from '../../services/social-publish/compose'
import type { WeixinPublishMode } from '../../services/social-publish/types'
import { copyText } from '../../services/browser'
import { PhoneChrome } from './PhoneChrome'

type WechatPreviewPanelProps = {
  title: string
  content: string
  imageUrls: string[]
  previewShape: 'article' | 'image_draft'
  weixinPublishMode: WeixinPublishMode
  onPreviewShapeChange: (v: 'article' | 'image_draft') => void
  onWeixinPublishModeChange: (v: WeixinPublishMode) => void
}

export function WechatPreviewPanel({
  title,
  content,
  imageUrls,
  previewShape,
  weixinPublishMode,
  onPreviewShapeChange,
  onWeixinPublishModeChange,
}: WechatPreviewPanelProps) {
  const { t } = useTranslation('socialPublish')
  const materialType = previewShape === 'image_draft' ? 'image_text' : 'article'
  const article = useMemo(
    () => makeSourceArticle({ title, content, materialType }),
    [title, content, materialType],
  )
  const payload = useMemo(() => makePayload(content), [content])
  const effective = effectiveWechatPreviewMode(previewShape, weixinPublishMode)
  const articleHtml = useMemo(
    () => (effective === 'article' ? composeWechatArticlePreview(article, payload) : ''),
    [effective, article, payload],
  )
  const imageDraft = useMemo(
    () => (effective === 'image_draft' ? composeWechatImageDraftPreview(article, payload) : null),
    [effective, article, payload],
  )

  async function onCopy() {
    if (effective === 'article') await copyText(articleHtml)
    else if (imageDraft) await copyText(imageDraft.content)
  }

  const phoneSubtitle =
    effective === 'image_draft' ? t('subtitleImageDraft') : t('subtitleLongRead')

  return (
    <div>
      <div className="social-preview-toolbar">
        <label>
          {t('previewShape')}
          <select
            value={previewShape}
            onChange={(e) => onPreviewShapeChange(e.target.value as 'article' | 'image_draft')}
          >
            <option value="article">{t('previewShapeArticle')}</option>
            <option value="image_draft">{t('previewShapeImageDraft')}</option>
          </select>
        </label>
        <label>
          {t('sendMode')}
          <select
            value={weixinPublishMode}
            onChange={(e) => onWeixinPublishModeChange(e.target.value as WeixinPublishMode)}
          >
            <option value="auto">{t('sendModeAuto')}</option>
            <option value="article">{t('sendModeArticle')}</option>
            <option value="image_draft">{t('sendModeImageDraft')}</option>
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => void onCopy()}>
          {t('copyLayout')}
        </Button>
        {effective === 'image_draft' && imageDraft ? (
          <span className="text-xs text-muted-foreground">
            {t('imageDraftCount', { count: imageDraft.content.length })}
          </span>
        ) : null}
      </div>
      <PhoneChrome platform="wechat" subtitle={phoneSubtitle}>
        {effective === 'article' ? (
          <div className="social-weixin-html" dangerouslySetInnerHTML={{ __html: articleHtml }} />
        ) : (
          <>
            <div className="social-image-draft-text" dangerouslySetInnerHTML={{ __html: imageDraft?.content || '' }} />
            {imageUrls.length > 0 ? (
              <div className="social-image-gallery">
                {imageUrls.map((url) => (
                  <img key={url} src={url} alt="" />
                ))}
              </div>
            ) : null}
          </>
        )}
      </PhoneChrome>
    </div>
  )
}
