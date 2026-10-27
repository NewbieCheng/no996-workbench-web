import { Play, Pause } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatMmSs } from '../voice-constants'

type Props = {
  title: string
  segmentCount: number
  isPlaying: boolean
  onTogglePlay: () => void
  currentTime: number
  totalDuration: number
}

export function VoicePlayerBar({
  title,
  segmentCount,
  isPlaying,
  onTogglePlay,
  currentTime,
  totalDuration,
}: Props) {
  const { t } = useTranslation('voice')
  const currentFormatted = formatMmSs(currentTime)
  const totalFormatted = formatMmSs(totalDuration)

  return (
    <div className="voice-player-bar">
      <button
        type="button"
        className="voice-player-play-btn"
        onClick={onTogglePlay}
        aria-label={isPlaying ? t('player.pause') : t('player.play')}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
      </button>
      <div className="voice-player-meta">
        <b>{title || t('player.defaultTitle')}</b>
        <small>{t('player.meta', { count: segmentCount })}</small>
      </div>
      <div className="voice-player-time">
        <span>{currentFormatted}</span> / <span>{totalFormatted}</span>
      </div>
    </div>
  )
}
