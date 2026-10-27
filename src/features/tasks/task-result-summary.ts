import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'

export type TaskSummaryChip = {
  id: string
  /** i18n key under workbench namespace */
  messageKey: string
  values?: Record<string, string | number>
  tone?: 'default' | 'warn'
}

/** 成功任务结果摘要（与 taskSuccessToast 同源 meta 字段，供 UI chip 展示） */
export function taskResultSummaryChips(task: WorkbenchTaskRecord): TaskSummaryChip[] {
  if (task.status !== 'succeeded') return []
  const m = task.meta ?? {}
  const chips: TaskSummaryChip[] = []

  switch (task.kind) {
    case 'titles_generate':
      if (m.score) chips.push({ id: 'score', messageKey: 'taskChipTitlesScore', values: { score: m.score } })
      if (m.pareto && m.pareto !== '0') {
        chips.push({ id: 'pareto', messageKey: 'taskChipTitlesPareto', values: { count: m.pareto } })
      }
      if (m.fallback === '1') chips.push({ id: 'fallback', messageKey: 'taskChipPartialFallback', tone: 'warn' })
      break
    case 'script_generate':
      if (m.retention) {
        chips.push({ id: 'retention', messageKey: 'taskChipScriptRetention', values: { pct: m.retention } })
      }
      if (m.fallback === '1') chips.push({ id: 'fallback', messageKey: 'taskChipPartialFallback', tone: 'warn' })
      break
    case 'persona_generate':
      if (m.usedMock === '1') chips.push({ id: 'mock', messageKey: 'taskChipDemoMode', tone: 'warn' })
      break
    case 'voice_dub_advanced':
      if (m.awaiting_confirm === '1') {
        chips.push({ id: 'confirm', messageKey: 'taskChipDubAwaitingConfirm' })
      } else if (m.segmentsCount) {
        chips.push({ id: 'segments', messageKey: 'taskChipDubSegments', values: { count: m.segmentsCount } })
      }
      break
    case 'text_sections':
      if (m.sectionCount) {
        chips.push({ id: 'sections', messageKey: 'taskChipSectionCount', values: { count: m.sectionCount } })
      }
      break
    case 'source_create':
      if (m.collectedTitle) {
        chips.push({ id: 'title', messageKey: 'taskChipSourceTitle', values: { title: m.collectedTitle } })
      }
      break
    case 'video_factory_export': {
      if (m.resolution) {
        chips.push({
          id: 'resolution',
          messageKey: 'taskChipVideoExportResolution',
          values: { resolution: m.resolution === '1080p' ? '1080P' : '720P' },
        })
      }
      if (m.byteLength) {
        const mb = (Number(m.byteLength) / (1024 * 1024)).toFixed(1)
        chips.push({ id: 'size', messageKey: 'taskChipVideoExportSize', values: { sizeMb: mb } })
      }
      break
    }
    default:
      break
  }

  return chips
}

export function taskProgressPercent(task: WorkbenchTaskRecord): number | undefined {
  if (task.kind === 'digital_human_retalk') return undefined
  if (task.kind === 'video_factory_export') {
    const raw = task.meta?.progress
    if (raw == null || raw === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : undefined
  }
  const raw = task.meta?.pct
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : undefined
}

export function isAgentLikeTask(task: WorkbenchTaskRecord): boolean {
  return (
    task.kind === 'ip_video_create' ||
    task.kind === 'script_generate' ||
    task.kind === 'titles_generate' ||
    task.kind === 'moments_plan' ||
    task.kind === 'moments_copy' ||
    task.kind === 'persona_generate' ||
    task.kind === 'text_sections' ||
    task.kind === 'source_create'
  )
}

export function isVoiceSynthesisTask(task: WorkbenchTaskRecord): boolean {
  return task.kind === 'voice_tts' || task.kind === 'ip_video_audio' || task.kind === 'voice_dub_advanced'
}

export function isVideoExportTask(task: WorkbenchTaskRecord): boolean {
  return task.kind === 'video_factory_export'
}
