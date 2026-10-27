import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Film, GripVertical, History, Plus, Trash2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip'
import { activeDigitalHumanVersion, type DigitalHumanProject } from './lib/project-store'
import { SegmentTakeSelect } from './SegmentTakeSelect'

const ACTIVE_TASK_STATUSES = ['queued', 'running', 'waiting_remote', 'QUEUED', 'SUBMITTED', 'RUNNING']
const TIMELINE_COLLAPSED_KEY = 'no996.dh.timelineCollapsed'

function readTimelineCollapsed(): boolean {
  try {
    return sessionStorage.getItem(TIMELINE_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function formatSegmentPreview(text: string, maxChars = 32): string {
  const flat = text.trim().replace(/\s+/g, ' ')
  if (!flat) return ''
  const chars = Array.from(flat)
  if (chars.length <= maxChars) return flat
  return `${chars.slice(0, maxChars).join('')}…`
}

function reorderSegmentList(
  segments: DigitalHumanProject['segments'],
  sourceId: string,
  targetId: string
): DigitalHumanProject['segments'] {
  if (sourceId === targetId) return segments
  const next = [...segments]
  const from = next.findIndex(item => item.id === sourceId)
  const to = next.findIndex(item => item.id === targetId)
  if (from < 0 || to < 0) return segments
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

type DigitalHumanTimelineRailProps = {
  segments: DigitalHumanProject['segments']
  selectedSegmentId?: string
  readySegmentsCount: number
  busy?: string | null
  statusLabel: (value?: string) => string
  onUpdateProject: (updater: (previous: DigitalHumanProject) => DigitalHumanProject) => void
  onSelectSegment: (segmentId: string) => void
  onOpenTaskHistory: () => void
  onConcatFullVideo?: () => void
  isConcatenating?: boolean
}

export function DigitalHumanTimelineRail({
  segments,
  selectedSegmentId,
  readySegmentsCount,
  busy,
  statusLabel,
  onUpdateProject,
  onSelectSegment,
  onOpenTaskHistory,
  onConcatFullVideo,
  isConcatenating,
}: DigitalHumanTimelineRailProps) {
  const { t } = useTranslation('digitalHuman')
  const [collapsed, setCollapsed] = useState(readTimelineCollapsed)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(TIMELINE_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [collapsed])

  const reorderDisabled = !!busy

  function renderHistoryButton() {
    const button = (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        disabled={!!busy}
        aria-label={t('timelineOpenHistory')}
        onClick={() => onOpenTaskHistory()}
      >
        <History size={14} aria-hidden />
      </Button>
    )

    return (
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent side="top">{t('timelineOpenHistory')}</TooltipContent>
      </Tooltip>
    )
  }

  if (collapsed) {
    return (
      <section
        className="dh-timeline-rail dh-timeline-rail--collapsed"
        aria-label={t('timelineRailTitle')}
      >
        <div
          className="dh-timeline-rail__summary"
          role="button"
          tabIndex={0}
          onClick={() => setCollapsed(false)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setCollapsed(false)
            }
          }}
        >
          <p className="dh-timeline-rail__summary-text">
            {t('timelineCollapsedLine', { total: segments.length, ready: readySegmentsCount })}
          </p>
          <div className="dh-timeline-rail__summary-actions" onClick={event => event.stopPropagation()}>
            {renderHistoryButton()}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground"
                    aria-label={t('expandTimeline')}
                    onClick={() => setCollapsed(false)}
                  >
                    <ChevronUp size={14} aria-hidden />
                  </Button>
                }
              />
              <TooltipContent side="top">{t('expandTimeline')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="dh-timeline-rail" aria-label={t('timelineRailTitle')}>
      <div className="dh-timeline-rail__header">
        <div className="dh-timeline-rail__title-block min-w-0">
          <div className="dh-timeline-rail__title-row">
            <Film size={14} className="text-primary shrink-0" aria-hidden />
            <h4>{t('timelineRailTitle')}</h4>
            <span className="dh-count-pill dh-count-pill--meta">
              {t('timelineHeaderMeta', { total: segments.length, ready: readySegmentsCount })}
            </span>
          </div>
        </div>
        <div className="dh-timeline-rail__actions">
          {onConcatFullVideo && readySegmentsCount >= 2 ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    disabled={!!busy || isConcatenating}
                    onClick={onConcatFullVideo}
                  >
                    <Film size={13} />
                    <span>{isConcatenating ? '拼接中...' : '合并成片'}</span>
                  </Button>
                }
              />
              <TooltipContent side="top">将所有已就绪段落拼接为完整视频（浏览器本地合成）</TooltipContent>
            </Tooltip>
          ) : null}
          {renderHistoryButton()}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={!!busy}
                  aria-label={t('addSegment')}
                  onClick={() => {
                    const next = { id: crypto.randomUUID(), text: '', versions: [] }
                    onUpdateProject(previous => ({ ...previous, segments: [...previous.segments, next] }))
                    onSelectSegment(next.id)
                  }}
                >
                  <Plus size={14} aria-hidden />
                </Button>
              }
            />
            <TooltipContent side="top">{t('addSegment')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground"
                  aria-label={t('collapseTimeline')}
                  onClick={() => setCollapsed(true)}
                >
                  <ChevronDown size={14} aria-hidden />
                </Button>
              }
            />
            <TooltipContent side="top">{t('collapseTimeline')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="dh-timeline-rail__track">
        {segments.map((item, index) => {
          const current = activeDigitalHumanVersion(item)
          const isSelected = item.id === selectedSegmentId
          const hasAudio = Boolean(current?.audio || current?.audioUrl)
          const isReadyVideo = Boolean(current?.sourceVideoUrl || current?.videoUrl || current?.videoBlob)
          const hasText = Boolean(item.text.trim())
          const isDragOver = dragOverId === item.id && draggingId !== item.id

          let railStatus: string
          let railStatusKind: 'video' | 'audio' | 'script' | 'draft'
          if (isReadyVideo) {
            railStatus = t('segmentRailStatusVideo')
            railStatusKind = 'video'
          } else if (hasAudio) {
            railStatus = current?.audioDuration
              ? t('segmentRailStatusAudio', { seconds: current.audioDuration.toFixed(1) })
              : t('segmentRailStatusAudioReady')
            railStatusKind = 'audio'
          } else if (hasText) {
            railStatus = t('segmentRailStatusScript')
            railStatusKind = 'script'
          } else {
            railStatus = t('segmentRailStatusDraft')
            railStatusKind = 'draft'
          }

          const preview = formatSegmentPreview(item.text)
          const cardHint = hasText
            ? `${railStatus} · ${item.text.trim().replace(/\s+/g, ' ')}`
            : railStatus

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger
                render={
            <div
              className="dh-segment-card"
              data-active={isSelected}
              data-drag-over={isDragOver}
              data-status-kind={railStatusKind}
              onDragOver={event => {
                if (reorderDisabled || !draggingId) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDragOverId(item.id)
              }}
              onDragLeave={() => {
                if (dragOverId === item.id) setDragOverId(null)
              }}
              onDrop={event => {
                event.preventDefault()
                event.stopPropagation()
                const sourceId = draggingId || event.dataTransfer.getData('text/plain')
                if (!sourceId || reorderDisabled) return
                onUpdateProject(previous => ({
                  ...previous,
                  segments: reorderSegmentList(previous.segments, sourceId, item.id),
                }))
                setDraggingId(null)
                setDragOverId(null)
              }}
              onClick={() => {
                onSelectSegment(item.id)
              }}
            >
              <button
                type="button"
                className="dh-segment-card__drag"
                draggable={!reorderDisabled}
                disabled={reorderDisabled}
                aria-label={t('timelineDragHandle')}
                onClick={event => event.stopPropagation()}
                onDragStart={event => {
                  event.stopPropagation()
                  setDraggingId(item.id)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', item.id)
                }}
                onDragEnd={() => {
                  setDraggingId(null)
                  setDragOverId(null)
                }}
              >
                <GripVertical size={14} aria-hidden />
              </button>

              <span className="dh-segment-card__index" aria-hidden>
                {index + 1}
              </span>

              <div className="dh-segment-card__rail-line">
                <span className="dh-segment-card__rail-status">{railStatus}</span>
                <span className="dh-segment-card__rail-preview" data-empty={!hasText}>
                  {preview || t('timelineEmptyScript')}
                </span>
              </div>

              <div className="dh-segment-card__ops" onClick={e => e.stopPropagation()}>
                <SegmentTakeSelect
                  segment={item}
                  statusLabel={statusLabel}
                  disabled={!!busy}
                  onSelectTake={takeId =>
                    onUpdateProject(previous => ({
                      ...previous,
                      segments: previous.segments.map(s =>
                        s.id === item.id ? { ...s, activeVersionId: takeId } : s
                      ),
                    }))
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                  disabled={
                    !!busy ||
                    segments.length <= 1 ||
                    item.versions.some(v => ACTIVE_TASK_STATUSES.includes(v.status ?? '') || v.status === 'audio_queued')
                  }
                  aria-label={t('deleteSegment')}
                  title={t('deleteSegment')}
                  onClick={() =>
                    onUpdateProject(previous => ({
                      ...previous,
                      segments: previous.segments.filter(s => s.id !== item.id),
                    }))
                  }
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
                }
              />
              <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                {cardHint}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </section>
  )
}
