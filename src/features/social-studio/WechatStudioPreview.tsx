import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  composeWechatArticlePreview,
  composeWechatImageDraftPreview,
  effectiveWechatPreviewMode,
  makePayload,
  makeSourceArticle,
} from '../../services/social-publish/compose'
import type { WeixinPublishMode } from '../../services/social-publish/types'
import { WechatLayoutPreview } from '../social-publish/WechatLayoutPreview'
import { WebArticlePreview } from '../social-publish/WebArticlePreview'
import { PhoneChrome } from '../social-publish/PhoneChrome'
import type { PreviewDevice, SocialContentMode, WechatLayoutView } from './studio-types'
import { wechatPreviewShape } from './studio-mode'
import type { WechatThemeKey } from '../../services/social-publish/layout/wechat-markdown-preview'

type Props = {
  title: string
  content: string
  imageUrls: string[]
  contentMode: SocialContentMode
  layoutView: WechatLayoutView
  device: PreviewDevice
  themeKey: WechatThemeKey
  weixinPublishMode: WeixinPublishMode
}

export function buildStudioMarkdown(title: string, content: string): string {
  const t = title.trim()
  const c = content.trim()
  if (t && c) return `# ${t}\n\n${c}`
  if (t) return `# ${t}`
  return c
}

export function WechatStudioPreview({
  title,
  content,
  imageUrls,
  contentMode,
  layoutView,
  device,
  themeKey,
  weixinPublishMode,
}: Props) {
  const { t } = useTranslation('socialPublish')
  const previewShape = wechatPreviewShape(contentMode)
  const markdown = useMemo(() => buildStudioMarkdown(title, content), [title, content])
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

  if (contentMode === 'article') {
    if (layoutView === 'web') {
      return <WebArticlePreview markdown={markdown} />
    }
    return <WechatLayoutPreview markdown={markdown} themeKey={themeKey} device={device} />
  }

  const phoneSubtitle = effective === 'image_draft' ? t('subtitleImageDraft') : t('subtitleLongRead')

  return (
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
          ) : (
            <p className="text-xs text-muted-foreground p-2">{t('studioImageTextPreviewNeedImages')}</p>
          )}
        </>
      )}
    </PhoneChrome>
  )
}
