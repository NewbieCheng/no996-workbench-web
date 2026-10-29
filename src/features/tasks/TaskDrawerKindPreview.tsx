import { TaskRetalkPreview } from './TaskRetalkPreview'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { useWorkbenchTaskActions, type WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { TaskVoicePlaybackBlock } from './TaskVoicePlaybackBlock'
import {
  isAgentLikeTask,
  isVideoExportTask,
  isVoiceSynthesisTask,
  taskProgressPercent,
  taskResultSummaryChips,
} from './task-result-summary'

type Props = {
  task: WorkbenchTaskRecord
  /** 折叠行已带迷你播放器时，详情区不再重复音频控件 */
  suppressVoicePlayer?: boolean
}

export function TaskDrawerKindPreview({ task, suppressVoicePlayer = false }: Props) {
  const { t } = useTranslation('workbench')
  const { getPayload } = useWorkbenchTaskActions()
  const [payloadHint, setPayloadHint] = useState('')
  const [diagnosticCopyState, setDiagnosticCopyState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const diagnostic = task.kind === 'video_factory_export' ? task.meta?.diagnostic : undefined

  const copyDiagnostic = async () => {
    if (!diagnostic) return
    try {
      await navigator.clipboard.writeText(diagnostic)
      setDiagnosticCopyState('copied')
    } catch {
      setDiagnosticCopyState('manual')
    }
  }

  const running = task.status === 'queued' || task.status === 'running'
  const failed = task.status === 'failed' || task.status === 'cancelled'
  const pct = taskProgressPercent(task)

  useEffect(() => {
    if (task.status !== 'succeeded') {
      setPayloadHint('')
      return
    }
    if (task.kind !== 'text_sections' && task.kind !== 'source_create' && task.kind !== 'social_compose') return
    let cancelled = false
    void getPayload(task.payloadId).then((data) => {
      if (cancelled || !data || typeof data !== 'object') return
      if (task.kind === 'text_sections') {
        const sections = (data as { sections?: unknown[] }).sections
        if (Array.isArray(sections) && sections.length > 0) {
          setPayloadHint(t('taskChipSectionCount', { count: sections.length }))
        }
        return
      }
      if (task.kind === 'social_compose') {
        const result = (data as { result?: { title?: string; imageUrls?: string[] } }).result
        const title = result?.title?.trim()
        if (title) setPayloadHint(t('taskChipSourceTitle', { title }))
        return
      }
      const title = (data as { collectedTitle?: string }).collectedTitle?.trim()
      if (title) setPayloadHint(t('taskChipSourceTitle', { title }))
    })
    return () => {
      cancelled = true
    }
  }, [task, getPayload, t])

  if (task.kind === 'digital_human_retalk') return <TaskRetalkPreview task={task} />

  if (failed && task.errorMessage) {
    return (
      <div className="wb-task-drawer-preview__error-wrap">
        <p className="wb-task-drawer-preview__error">{task.errorMessage}</p>
        {diagnostic ? (
          <div className="wb-task-drawer-preview__diagnostic">
            <button type="button" className="wb-task-drawer-preview__copy-diagnostic" onClick={() => void copyDiagnostic()}>
              <Copy size={14} aria-hidden="true" />
              {diagnosticCopyState === 'copied' ? '已复制错误详情' : '复制错误详情'}
            </button>
            {diagnosticCopyState === 'manual' ? (
              <textarea aria-label="可手动复制的视频导出错误详情" readOnly value={diagnostic} rows={8} onFocus={(event) => event.currentTarget.select()} />
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  if (running && isVoiceSynthesisTask(task)) {
    return (
      <div className="wb-task-drawer-preview">
        <TaskProgressBar pct={pct} label={t('taskVoiceSynthesizing')} />
      </div>
    )
  }

  if (running && isAgentLikeTask(task)) {
    const stage = task.meta?.stageLabel?.trim() || task.meta?.stage?.trim()
    const stageLabel = stage ? t('taskStageRunning', { stage }) : t('taskGenerating')
    return (
      <div className="wb-task-drawer-preview">
        <TaskProgressBar pct={pct} label={stageLabel} />
      </div>
    )
  }

  if (running && isVideoExportTask(task)) {
    const stage = task.meta?.stage?.trim()
    const stageLabel = stage ? t('taskStageRunning', { stage }) : t('taskVideoExportRunning')
    return (
      <div className="wb-task-drawer-preview">
        <TaskProgressBar pct={pct} label={stageLabel} />
      </div>
    )
  }

  if (task.status === 'succeeded') {
    const chips = taskResultSummaryChips(task)
    const showVoiceAudio =
      !suppressVoicePlayer &&
      (task.kind === 'voice_tts' || task.kind === 'ip_video_audio') &&
      task.status === 'succeeded'
    return (
      <div className="wb-task-drawer-preview">
        {chips.length > 0 ? (
          <ul className="wb-task-drawer-preview__chips">
            {chips.map((chip) => (
              <li
                key={chip.id}
                className="wb-task-drawer-preview__chip"
                data-tone={chip.tone === 'warn' ? 'warn' : undefined}
              >
                {t(chip.messageKey, chip.values)}
              </li>
            ))}
          </ul>
        ) : null}
        {payloadHint ? <p className="wb-task-drawer-preview__hint">{payloadHint}</p> : null}
        {showVoiceAudio ? <TaskVoicePlaybackBlock task={task} layout="audio-only" /> : null}
        {task.kind === 'voice_dub_advanced' && task.meta?.awaiting_confirm !== '1' ? (
          <p className="wb-task-drawer-preview__hint">{t('taskDubOpenToReview')}</p>
        ) : null}
      </div>
    )
  }

  return null
}

function TaskProgressBar({ pct, label }: { pct?: number; label: string }) {
  const width = pct != null ? `${pct}%` : undefined
  return (
    <div className="wb-task-drawer-preview__progress">
      <div className="wb-task-drawer-preview__progress-track" aria-hidden>
        <div className="wb-task-drawer-preview__progress-fill" style={{ width }} data-indeterminate={width ? undefined : 'true'} />
      </div>
      <span className="wb-task-drawer-preview__progress-label">
        {pct != null ? `${pct}% · ${label}` : label}
      </span>
    </div>
  )
}
