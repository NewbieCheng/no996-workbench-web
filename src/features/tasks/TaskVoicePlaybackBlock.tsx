import { useTranslation } from 'react-i18next'
import { Link2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { HoverTip } from '@no996/ui/tooltip'
import { copyVoiceUpstreamUrl, VOICE_UPSTREAM_LINK_TIP } from '../../lib/voice-upstream-link'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { useTaskVoicePlayback } from './use-task-voice-playback'

type Layout = 'inline' | 'audio-only'

type Props = {
  task: WorkbenchTaskRecord
  layout?: Layout
  className?: string
}

/** 配音 / IP 口播任务：页内历史与任务中心共用的试听与复制上游地址 */
export function TaskVoicePlaybackBlock({ task, layout = 'inline', className }: Props) {
  const { t } = useTranslation('workbench')
  const { active, audioUrl, upstreamUrl, playbackFailed, showCopyUpstream, handlePlaybackError } =
    useTaskVoicePlayback(task)

  if (!active) return null

  return (
    <div className={className}>
      {audioUrl ? (
        <audio
          controls
          src={audioUrl}
          className="wb-task-records__audio"
          preload="none"
          onError={handlePlaybackError}
        />
      ) : null}
      {playbackFailed ? (
        <p className="wb-task-records__error">{t('taskPlaybackFailed')}</p>
      ) : null}
      {layout === 'inline' && showCopyUpstream ? (
        <TaskVoiceCopyUpstreamButton upstreamUrl={upstreamUrl} />
      ) : null}
    </div>
  )
}

export function TaskVoiceCopyUpstreamButton({
  upstreamUrl,
  iconOnly = false,
}: {
  upstreamUrl: string
  iconOnly?: boolean
}) {
  const { t } = useTranslation('workbench')
  if (!upstreamUrl) return null
  const tip = iconOnly ? t('taskCopyUpstreamUrl') : VOICE_UPSTREAM_LINK_TIP
  return (
    <HoverTip label={tip}>
      <Button
        type="button"
        variant={iconOnly ? 'ghost' : 'outline'}
        size={iconOnly ? 'icon-sm' : 'sm'}
        className={iconOnly ? 'wb-task-drawer-card__link' : 'wb-task-drawer-card__copy-btn'}
        aria-label={t('taskCopyUpstreamUrl')}
        onClick={() => void copyVoiceUpstreamUrl(upstreamUrl)}
      >
        <Link2 size={iconOnly ? 16 : 14} aria-hidden />
        {iconOnly ? null : t('taskCopyUpstreamUrl')}
      </Button>
    </HoverTip>
  )
}

export { useTaskVoicePlayback, isVoicePlaybackTask } from './use-task-voice-playback'
