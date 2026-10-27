import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { SocialStudioBrief } from './creative/social-studio-brief-types'
import type { SocialStudioRewriteSettings } from './rewrite/social-studio-rewrite-types'
import type { PreviewDevice, SocialContentMode, WechatLayoutView } from './studio-types'
import type { WechatThemeKey } from '../../services/social-publish/layout/wechat-markdown-preview'
import type { WeixinPublishMode, XhsPublishMode } from '../../services/social-publish/types'
import {
  clearSocialStudioDraft,
  isIdbQuotaError,
  loadSocialStudioDraft,
  putSocialStudioDraft,
  type SocialStudioDraftKey,
} from '../../services/social-studio/draft-idb-repository'

const REALTIME_SAVE_DELAY_MS = 450

export type SocialStudioDraftPersistInput = {
  draftKey: SocialStudioDraftKey
  title: string
  content: string
  contentMode: SocialContentMode
  brief: SocialStudioBrief
  weixinPublishMode?: WeixinPublishMode
  xhsPublishMode?: XhsPublishMode
  layoutView?: WechatLayoutView
  device?: PreviewDevice
  themeKey?: WechatThemeKey
  rewriteSettings?: SocialStudioRewriteSettings
  onHydrate: (draft: {
    title: string
    content: string
    contentMode: SocialContentMode
    brief: SocialStudioBrief
    weixinPublishMode?: WeixinPublishMode
    xhsPublishMode?: XhsPublishMode
    layoutView?: WechatLayoutView
    device?: PreviewDevice
    themeKey?: WechatThemeKey
    rewriteSettings?: SocialStudioRewriteSettings
  }) => void
  isEmpty: () => boolean
}

export function useSocialStudioDraftPersist(input: SocialStudioDraftPersistInput) {
  const { t } = useTranslation('socialPublish')
  const [hydrated, setHydrated] = useState(false)
  const skipNextSaveRef = useRef(false)
  const latestInputRef = useRef(input)
  latestInputRef.current = input

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const record = await loadSocialStudioDraft(input.draftKey)
        if (cancelled || !record) {
          setHydrated(true)
          return
        }
        const latestInput = latestInputRef.current
        if (!latestInput.isEmpty()) {
          setHydrated(true)
          return
        }
        skipNextSaveRef.current = true
        latestInput.onHydrate({
          title: record.title,
          content: record.content,
          contentMode: record.contentMode,
          brief: record.brief,
          weixinPublishMode: record.weixinPublishMode,
          xhsPublishMode: record.xhsPublishMode,
          layoutView: record.layoutView,
          device: record.device,
          themeKey: record.themeKey,
          rewriteSettings: record.rewriteSettings,
        })
      } catch {
        // 读取失败不阻断编辑
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [input.draftKey])

  useEffect(() => {
    if (!hydrated) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await putSocialStudioDraft({
            key: input.draftKey,
            title: input.title,
            content: input.content,
            contentMode: input.contentMode,
            brief: input.brief,
            weixinPublishMode: input.weixinPublishMode,
            xhsPublishMode: input.xhsPublishMode,
            layoutView: input.layoutView,
            device: input.device,
            themeKey: input.themeKey,
            rewriteSettings: input.rewriteSettings,
            updatedAt: Date.now(),
          })
        } catch (error) {
          if (isIdbQuotaError(error)) {
            toast.error(t('studioDraftQuotaError'))
          }
        }
      })()
    }, REALTIME_SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [
    hydrated,
    input.draftKey,
    input.title,
    input.content,
    input.contentMode,
    input.brief,
    input.weixinPublishMode,
    input.xhsPublishMode,
    input.layoutView,
    input.device,
    input.themeKey,
    input.rewriteSettings,
    t,
  ])

  const clearPersistedDraft = () => {
    void clearSocialStudioDraft(input.draftKey)
  }

  return { hydrated, clearPersistedDraft }
}
