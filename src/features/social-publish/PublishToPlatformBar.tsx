import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Notice } from '../../components/WorkbenchUI'
import { extensionClient } from '../../services/extension/extension-client'
import { isWorkbenchAiDemoMode } from '../../api/workbench-ai'
import type { BuildSyncDraftResult } from '../../services/social-publish/types'
import { notifyOperationError, notifyOperationWarning, toastSuccess } from '../../lib/toast'

type PublishToPlatformBarProps = {
  disabled?: boolean
  buildDraft: () => Promise<BuildSyncDraftResult>
  channel: 'weixin' | 'xiaohongshu'
}

export function PublishToPlatformBar({ disabled, buildDraft, channel }: PublishToPlatformBarProps) {
  const { t } = useTranslation('socialPublish')
  const demoMode = isWorkbenchAiDemoMode()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const channelLabel = channel === 'weixin' ? t('channelWechat') : t('channelXhs')

  async function onPublish() {
    setMessage('')
    if (demoMode) {
      notifyOperationWarning(t('demoPublishBlocked'), { id: 'social-publish-bar', raw: true })
      return
    }
    setBusy(true)
    try {
      const status = await extensionClient.checkStatus()
      if (!status.connected) {
        throw new Error(t('extensionMissing'))
      }
      const draftPayload = await buildDraft()
      const auth = await extensionClient.checkChannelAuth(draftPayload.channelIds)
      const blocked = draftPayload.channelIds.filter((id) => !auth[id]?.ok)
      if (blocked.length > 0) {
        throw new Error(
          t('channelNotLoggedIn', { channel: channelLabel, ids: blocked.join(', ') }),
        )
      }
      const result = await extensionClient.publishStart({
        channelIds: draftPayload.channelIds,
        draft: draftPayload.draft,
        weixinPublishMode: draftPayload.weixinPublishMode,
      })
      if (!result.ok) {
        throw new Error(result.results[0]?.error || t('publishFailed'))
      }
      const first = result.results.find((r) => r.success)
      if (!first) {
        throw new Error(result.results[0]?.error || t('publishFailed'))
      }
      const successText = first.postUrl
        ? t('publishSuccessWithUrl', { url: first.postUrl })
        : t('publishSuccess')
      setMessage(successText)
      toastSuccess(successText, undefined, 4000)
      if (first.postUrl) window.open(first.postUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      notifyOperationError(e instanceof Error ? e.message : String(e), {
        id: 'social-publish-bar',
        raw: true,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field-stack" style={{ marginTop: '0.75rem' }}>
      <Button type="button" disabled={disabled || busy || demoMode} onClick={() => void onPublish()}>
        {busy ? t('publishing') : t('publish')}
      </Button>
      {demoMode && <Notice>{t('demoDisabled')}</Notice>}
      {message && <Notice>{message}</Notice>}
    </div>
  )
}
