import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { useTaskVoicePlayback } from './use-task-voice-playback'

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

type Props = {
  task: WorkbenchTaskRecord
}

export function TaskDrawerDetailDuration({ task }: Props) {
  const { t } = useTranslation('workbench')
  const { active, audioUrl } = useTaskVoicePlayback(task)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!active || !audioUrl) {
      setDuration(0)
      return
    }
    const audio = new Audio()
    audio.preload = 'metadata'
    const onMeta = () => {
      const d = audio.duration
      if (Number.isFinite(d) && d > 0) setDuration(d)
    }
    audio.addEventListener('loadedmetadata', onMeta)
    audio.src = audioUrl
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.src = ''
      setDuration(0)
    }
  }, [active, audioUrl])

  if (!duration) return null

  return (
    <span className="wb-task-drawer-card__detail-foot-note">
      {t('taskDetailDuration', { time: formatClock(duration) })}
    </span>
  )
}
