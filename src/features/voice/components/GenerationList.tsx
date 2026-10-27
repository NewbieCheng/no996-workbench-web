import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HoverTip } from '@no996/ui/tooltip'
import { usePageHistoryLayout } from '../../../components/page-history-layout'
import type { WorkbenchTaskRecordLayout } from '../../tasks/WorkbenchTaskRecords'
import type { VoiceTtsPayload, WorkbenchTaskRecord } from '../../../services/workbench-tasks'
import { VoiceGenerationHistoryTable } from './VoiceGenerationHistoryTable'
import { copyVoiceUpstreamUrl, VOICE_UPSTREAM_LINK_TIP } from '../../../lib/voice-upstream-link'
import { downloadUrl } from '../../../services/browser'
import { VoiceCompactPlayer } from '../../../components/VoiceCompactPlayer'
import { formatMmSs, estimateSpeechSeconds, resolveInstructionPillLabel } from '../voice-constants'
import { voiceTaskStatusLabel } from '../voice-i18n'

type Props = {
  items: WorkbenchTaskRecord[]
  onRemove: (id: string) => void
  getPlaybackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getDownloadUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getEmbedFallbackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVoicePayload: (task: WorkbenchTaskRecord) => Promise<VoiceTtsPayload | null>
  /** Hide block title when rendered inside the unified history tab. */
  embedded?: boolean
  layout?: WorkbenchTaskRecordLayout
}

export function JobAudio({
  task,
  getPlaybackUrl,
  getEmbedFallbackUrl,
}: {
  task: WorkbenchTaskRecord
  getPlaybackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getEmbedFallbackUrl: (task: WorkbenchTaskRecord) => Promise<string>
}) {
  const { t } = useTranslation('voice')
  const [src, setSrc] = useState('')
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const [triedFallback, setTriedFallback] = useState(false)
  useEffect(() => {
    if (task.status !== 'succeeded') {
      setSrc('')
      setPlaybackFailed(false)
      setTriedFallback(false)
      return
    }
    let cancelled = false
    setPlaybackFailed(false)
    setTriedFallback(false)
    void getPlaybackUrl(task).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [task, getPlaybackUrl])

  const handlePlaybackError = () => {
    if (triedFallback || !src.startsWith('blob:')) {
      setPlaybackFailed(true)
      return
    }
    setTriedFallback(true)
    void getEmbedFallbackUrl(task).then((fallback) => {
      if (fallback) {
        setPlaybackFailed(false)
        setSrc(fallback)
      } else {
        setPlaybackFailed(true)
      }
    })
  }

  if (task.status === 'queued' || task.status === 'running') {
    return (
      <span className="voice-gen-status voice-gen-status--active">
        {voiceTaskStatusLabel(t, task.status)}
      </span>
    )
  }
  if (task.status === 'failed') {
    return (
      <span className="voice-gen-status voice-gen-status--error">
        {task.errorMessage ?? t('history.generateFailed')}
      </span>
    )
  }
  if (task.status === 'cancelled') {
    return <span className="voice-gen-status">{voiceTaskStatusLabel(t, task.status)}</span>
  }
  if (!src) {
    return (
      <span className="voice-gen-status">
        {playbackFailed ? t('history.playbackFailed') : t('history.loadAudio')}
      </span>
    )
  }
  const label = task.subtitle?.trim() ?? ''
  return (
    <div className="voice-gen-audio-wrap">
      <VoiceCompactPlayer
        audioUrl={src}
        label={label}
        playbackFailed={playbackFailed}
        onPlaybackError={handlePlaybackError}
      />
      {playbackFailed ? (
        <span className="voice-gen-status voice-gen-status--error voice-gen-audio-wrap__error">
          {t('history.playbackFailed')}
        </span>
      ) : null}
    </div>
  )
}

function JobUpstreamLink({
  upstream,
  playbackUrl,
}: {
  upstream: string
  playbackUrl: string
}) {
  const { t } = useTranslation('voice')
  if (!upstream) return null
  if (playbackUrl && upstream === playbackUrl) return null
  return (
    <HoverTip label={VOICE_UPSTREAM_LINK_TIP}>
      <button
        type="button"
        className="voice-chip"
        onClick={() => void copyVoiceUpstreamUrl(upstream)}
      >
        {t('history.copyUrl')}
      </button>
    </HoverTip>
  )
}

function JobRow({
  task,
  getPlaybackUrl,
  getDownloadUrl,
  getEmbedFallbackUrl,
  getVoicePayload,
  onRemove,
}: {
  task: WorkbenchTaskRecord
  getPlaybackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getDownloadUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getEmbedFallbackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVoicePayload: (task: WorkbenchTaskRecord) => Promise<VoiceTtsPayload | null>
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation('voice')
  const [payload, setPayload] = useState<VoiceTtsPayload | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState('')
  useEffect(() => {
    void getVoicePayload(task).then(setPayload)
  }, [task, getVoicePayload])
  useEffect(() => {
    if (task.status !== 'succeeded') {
      setPlaybackUrl('')
      return
    }
    void getPlaybackUrl(task).then(setPlaybackUrl)
  }, [task, getPlaybackUrl])

  const isAdvanced = task.kind === 'voice_dub_advanced'
  const text = payload?.text ?? task.title
  const rate = payload?.rate ?? 1
  const volume = payload?.volume ?? 50
  const pitch = payload?.pitch ?? 1
  const voiceLabel = payload?.voiceLabel ?? task.subtitle ?? ''
  const dur = task.meta?.totalDuration ? Number(task.meta.totalDuration) : estimateSpeechSeconds(text.length, rate)
  const toneLabel = payload?.instruction?.trim()
    ? t('history.tone', { label: resolveInstructionPillLabel(payload.instruction) })
    : null
  const meta = isAdvanced
    ? [
        t('history.kindAdvanced'),
        voiceLabel,
        task.meta?.segmentsCount
          ? t('history.segments', { count: task.meta.segmentsCount })
          : null,
        formatMmSs(dur),
        task.meta?.awaiting_confirm === '1'
          ? t('history.awaitingConfirm')
          : voiceTaskStatusLabel(t, task.status),
      ]
        .filter(Boolean)
        .join(' · ')
    : [
        voiceLabel,
        toneLabel,
        t('history.rate', { rate: rate.toFixed(1) }),
        volume === 0 ? t('history.muted') : t('history.volume', { volume }),
        t('history.pitch', { pitch: pitch.toFixed(1) }),
        formatMmSs(dur),
        voiceTaskStatusLabel(t, task.status),
      ]
        .filter(Boolean)
        .join(' · ')
  const upstream = payload?.upstreamAudioUrl?.trim() ?? ''

  return (
    <div className="voice-gen-item">
      <JobAudio
        task={task}
        getPlaybackUrl={getPlaybackUrl}
        getEmbedFallbackUrl={getEmbedFallbackUrl}
      />
      <div className="voice-gen-meta">
        <div className="t">
          {payload?.textPreview ?? task.title}
          {text.length > (payload?.textPreview?.length ?? 0) ? '…' : ''}
        </div>
        <small>{meta}</small>
      </div>
      {task.status === 'succeeded' ? (
        <>
          <JobDownload task={task} getDownloadUrl={getDownloadUrl} />
          <JobUpstreamLink upstream={upstream} playbackUrl={playbackUrl} />
        </>
      ) : null}
      <button type="button" className="voice-chip" onClick={() => onRemove(task.id)}>
        {t('history.remove')}
      </button>
    </div>
  )
}

function JobDownload({
  task,
  getDownloadUrl,
}: {
  task: WorkbenchTaskRecord
  getDownloadUrl: (task: WorkbenchTaskRecord) => Promise<string>
}) {
  const { t } = useTranslation('voice')
  const [href, setHref] = useState('')
  useEffect(() => {
    void getDownloadUrl(task).then(setHref)
  }, [task, getDownloadUrl])
  if (!href) return null
  const filename = `voice-${task.id.slice(0, 8)}.wav`
  return (
    <button
      type="button"
      className="voice-chip"
      onClick={() => downloadUrl(href, filename)}
    >
      {t('history.download')}
    </button>
  )
}

export function GenerationList({
  items,
  onRemove,
  getPlaybackUrl,
  getDownloadUrl,
  getEmbedFallbackUrl,
  getVoicePayload,
  embedded = false,
  layout: layoutProp = 'cards',
}: Props) {
  const { t } = useTranslation('voice')
  const layoutFromPanel = usePageHistoryLayout()
  const layout = layoutFromPanel ?? layoutProp
  const emptyHint = t('history.empty')

  return (
    <>
      {!embedded ? (
        <div className="voice-block-head">
          <b>{t('history.title')}</b>
          <small>{t('history.sub')}</small>
        </div>
      ) : null}
      {layout === 'list' ? (
        <VoiceGenerationHistoryTable
          items={items}
          onRemove={onRemove}
          getPlaybackUrl={getPlaybackUrl}
          getDownloadUrl={getDownloadUrl}
          getEmbedFallbackUrl={getEmbedFallbackUrl}
          getVoicePayload={getVoicePayload}
          emptyHint={emptyHint}
        />
      ) : items.length === 0 ? (
        <div className="voice-empty">{emptyHint}</div>
      ) : (
        <div className="voice-gen-list">
          {items.map((item) => (
            <JobRow
              key={item.id}
              task={item}
              getPlaybackUrl={getPlaybackUrl}
              getDownloadUrl={getDownloadUrl}
              getEmbedFallbackUrl={getEmbedFallbackUrl}
              getVoicePayload={getVoicePayload}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </>
  )
}
