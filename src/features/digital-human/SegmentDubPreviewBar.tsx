import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { DigitalHumanVersion } from './lib/project-store'

export type SegmentDubOrigin = 'ai' | 'import' | 'unknown'

export function inferSegmentDubOrigin(version?: DigitalHumanVersion): SegmentDubOrigin {
  if (!version) return 'unknown'
  if (version.audioTaskId || version.status === 'audio_queued') return 'ai'
  if (version.voiceId && !version.audioUrl?.trim()) return 'ai'
  return 'import'
}

type SegmentDubPreviewBarProps = {
  version?: DigitalHumanVersion
  generating: boolean
  originLabel: string
  sharedHint: string
  generatingLabel: string
  audioPreview: ReactNode
}

/** 两种配音录入方式共享：当前镜头已绑定的配音试听（切换模式不隐藏） */
export function SegmentDubPreviewBar({
  version,
  generating,
  originLabel,
  sharedHint,
  generatingLabel,
  audioPreview,
}: SegmentDubPreviewBarProps) {
  const hasAudio = Boolean(version?.audio || version?.audioUrl?.trim())

  if (!generating && !hasAudio) return null

  return (
    <section className="dh-segment-dub-bar" aria-label={originLabel}>
      <div className="dh-segment-dub-bar__head">
        <span className="dh-segment-dub-bar__badge">{originLabel}</span>
        {version?.voiceLabel?.trim() ? (
          <span className="dh-segment-dub-bar__voice truncate">{version.voiceLabel.trim()}</span>
        ) : null}
        {version?.audioDuration ? (
          <span className="dh-segment-dub-bar__duration">{Math.round(version.audioDuration)}s</span>
        ) : null}
      </div>
      <p className="dh-segment-dub-bar__hint">{sharedHint}</p>
      {generating ? (
        <div className="dh-segment-dub-bar__pending" role="status">
          <LoaderCircle size={16} className="animate-spin text-primary shrink-0" aria-hidden />
          <span>{generatingLabel}</span>
        </div>
      ) : (
        <div className="dh-segment-dub-bar__player">{audioPreview}</div>
      )}
    </section>
  )
}
