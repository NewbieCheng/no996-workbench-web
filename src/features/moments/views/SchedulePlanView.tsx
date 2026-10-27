import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MomentsScheduleItem, MomentsWeekView } from '../domain/moments'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { AIEditPopover, type AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import { Label } from '@no996/ui/label'
import { Badge } from '@no996/ui/badge'
import { ArrowLeftIcon, CheckIcon, PencilIcon, RefreshCwIcon, WandSparklesIcon } from 'lucide-react'
import { type WeekRange } from '../service/week-range'
import { contentDirectionOptions } from '../agent/stages'
import { MomentsPlanDayDeck } from './MomentsPlanDayDeck'
import { MomentsGoalWeekShell } from './MomentsGoalWeekShell'
import { MomentsContentDirectionField } from './MomentsContentDirectionField'
import { polishMomentsRevision } from '../agent/schedule-field-assist'
import type { DayGoalStatus, MomentsCalendarIndex } from '../service/moments-calendar-index'
import { dayStatusFromWeekView } from '../service/moments-calendar-index'

interface SchedulePlanViewProps {
  week: MomentsWeekView
  range: WeekRange
  saving: boolean
  calendarIndex: MomentsCalendarIndex | null
  activeDate: string
  onActiveDateChange: (date: string) => void
  onShiftWeek: (delta: number) => void
  onPickDate: (dateKey: string) => void
  onBack: () => void
  onEditItem: (
    itemId: string,
    patch: { contentDirection?: string; topic?: string; captureSuggestion?: string },
  ) => Promise<void>
  onConfirm: () => void
  onRevise: (instruction: string) => void
  onOpenDay: (date: string) => void
}

interface EditState {
  itemId: string
  contentDirection: string
  topic: string
  captureSuggestion: string
}

export function SchedulePlanView({
  week,
  range,
  saving,
  calendarIndex,
  activeDate,
  onActiveDateChange,
  onShiftWeek,
  onPickDate,
  onBack,
  onEditItem,
  onConfirm,
  onRevise,
  onOpenDay,
}: SchedulePlanViewProps) {
  const { t } = useTranslation('workbench')
  const [editing, setEditing] = useState<EditState | null>(null)
  const [revision, setRevision] = useState('')
  const [revisionPolishing, setRevisionPolishing] = useState(false)
  const [revisionStreaming, setRevisionStreaming] = useState('')
  const [revisionSuggestion, setRevisionSuggestion] = useState<string>()
  const [revisionError, setRevisionError] = useState('')
  const revisionAbort = useRef<AbortController | null>(null)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const mode = week.week.planningMode
  const options = contentDirectionOptions(mode)
  const confirmed = week.week.status === 'confirmed'
  const modeLabel = mode === 'theme' ? t('momentsModeTheme') : t('momentsModeDaily')
  const revisionLabels = useMemo<AIEditPopoverLabels>(() => ({
    trigger: t('momentsFieldAiOptimize'),
    context: t('momentsRevisionAiContext'),
    promptPlaceholder: t('momentsFieldAiPromptPlaceholder'),
    apply: t('momentsFieldAiApply'), dismiss: t('momentsFieldAiDismiss'), loading: t('momentsFieldAiLoading'),
    send: t('momentsFieldAiSend'), focusHint: t('momentsFieldAiFocusHint'), result: t('momentsFieldAiResult'),
  }), [t])
  const revisionQuickPrompts = useMemo(() => [
    { label: t('momentsFieldTuneCloserPreset'), instruction: t('momentsFieldTuneCloserPreset') },
    { label: t('momentsFieldTuneShorter'), instruction: t('momentsFieldTuneShorter') },
  ], [t])
  const polishRevision = useCallback(async (instruction: string) => {
    revisionAbort.current?.abort()
    const controller = new AbortController()
    revisionAbort.current = controller
    setRevisionPolishing(true)
    setRevisionError('')
    setRevisionSuggestion(undefined)
    setRevisionStreaming('')
    try {
      const suggestion = await polishMomentsRevision({
        value: revision,
        mode,
        businessPurpose: week.week.businessPurpose,
        coreTasks: week.week.coreTasks,
        productName: week.week.productRef?.name,
        activityName: week.week.activityRef?.name,
        instruction: instruction.trim() || undefined,
        signal: controller.signal,
        onPartial: setRevisionStreaming,
      })
      setRevisionSuggestion(suggestion)
    } catch (failure) {
      if (!controller.signal.aborted) setRevisionError(failure instanceof Error ? failure.message : t('momentsFieldAiError'))
    } finally {
      if (revisionAbort.current === controller) {
        revisionAbort.current = null
        setRevisionPolishing(false)
        setRevisionStreaming('')
      }
    }
  }, [mode, revision, t, week.week.activityRef?.name, week.week.businessPurpose, week.week.coreTasks, week.week.productRef?.name])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, MomentsScheduleItem[]>()
    for (const item of week.items) {
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }
    for (const [date, list] of map) {
      map.set(date, [...list].sort((a, b) => a.publishOrder - b.publishOrder))
    }
    return map
  }, [week.items])

  const contentsByDate = useMemo(() => {
    const map = new Map<string, (typeof week.contents)[number][]>()
    for (const row of week.contents) {
      const list = map.get(row.date) ?? []
      list.push(row)
      map.set(row.date, list)
    }
    return map
  }, [week.contents])

  const statusForDate = useCallback(
    (date: string): DayGoalStatus => {
      const items = itemsByDate.get(date) ?? []
      const contents = contentsByDate.get(date) ?? []
      return dayStatusFromWeekView(items, contents)
    },
    [contentsByDate, itemsByDate],
  )

  const scheduledDates = range.dates.filter((date) => (itemsByDate.get(date)?.length ?? 0) > 0)
  const generatedCount = scheduledDates.filter((date) => statusForDate(date) === 'ready').length

  const startEdit = useCallback((item: MomentsScheduleItem) => {
    setEditing({
      itemId: item.id,
      contentDirection: item.contentDirection,
      topic: item.topic,
      captureSuggestion: item.captureSuggestion ?? '',
    })
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editing) return
    setBusyItemId(editing.itemId)
    try {
      await onEditItem(editing.itemId, {
        contentDirection: editing.contentDirection.trim(),
        topic: editing.topic.trim(),
        captureSuggestion: editing.captureSuggestion.trim(),
      })
      setEditing(null)
    } finally {
      setBusyItemId(null)
    }
  }, [editing, onEditItem])

  const focusDate = range.dates.includes(activeDate) ? activeDate : range.dates[0]!
  const dayItems = itemsByDate.get(focusDate) ?? []

  const dayDeckHeadActions =
    dayItems.length > 0
      ? dayItems.map((item) => {
          if (editing?.itemId === item.id) return null
          return (
            <button
              key={item.id}
              type="button"
              className="moments-item__edit moments-item__edit--panel-head"
              onClick={() => startEdit(item)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {dayItems.length > 1
                ? `${t('momentsEdit')} ${String(item.publishOrder).padStart(2, '0')}`
                : t('momentsEdit')}
            </button>
          )
        })
      : null

  return (
    <div className="moments-plan">
      <div className="moments-subhead moments-subhead--plan">
        <div>
          <h2>{t('momentsPlanTitle')}</h2>
          <p>{t('momentsPlanSubtitle')}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {t('momentsBackToOverview')}
        </Button>
      </div>

      <section className="moments-plan-shell">
        <header className="moments-plan-summary">
          <div className="moments-plan-summary__row">
            <Badge variant="secondary">{modeLabel}</Badge>
            {confirmed ? <Badge variant="outline">{t('momentsWeekConfirmedBadge')}</Badge> : null}
          </div>
          <p className="moments-plan-summary__purpose">{week.week.businessPurpose}</p>
          <div className="moments-plan-summary__chips">
            <span className="moments-plan-summary__chip">{week.week.coreTasks}</span>
            {week.week.productRef ? (
              <span className="moments-plan-summary__chip">{week.week.productRef.name}</span>
            ) : null}
            {week.week.activityRef ? (
              <span className="moments-plan-summary__chip">{week.week.activityRef.name}</span>
            ) : null}
          </div>
        </header>

        <div className="moments-plan-shell__divider" />

        <div className="moments-plan-result">
          <header className="moments-plan-result__head">
            <div>
              <h3 className="moments-plan-result__title">{t('momentsPlanAgentResult')}</h3>
              <p className="moments-plan-result__desc">{t('momentsPlanAgentResultDesc')}</p>
            </div>
          </header>

          <MomentsGoalWeekShell
            mode="edit"
            showChrome={false}
            range={range}
            calendarIndex={calendarIndex}
            activeDate={focusDate}
            onActiveDateChange={onActiveDateChange}
            onShiftWeek={onShiftWeek}
            onPickDate={onPickDate}
            statusForDate={statusForDate}
            generatedDays={generatedCount}
            scheduledDays={week.scheduledDays}
          >
            <MomentsPlanDayDeck
              variant="focus"
              weekDates={range.dates}
              activeDate={focusDate}
              onActiveDateChange={onActiveDateChange}
              hasItemsOnDate={(date) => (itemsByDate.get(date)?.length ?? 0) > 0}
              panelHeadActions={dayDeckHeadActions}
            >
              {dayItems.length === 0 ? (
                <p className="moments-day-deck__empty">{t('momentsDayNoItems')}</p>
              ) : (
                <ul className="moments-item-list moments-item-list--deck">
                  {dayItems.map((item) => {
                    const isEditing = editing?.itemId === item.id
                    const showOrderInMeta = !isEditing
                    const showMeta = showOrderInMeta || (!isEditing && Boolean(item.contentDirection?.trim()))
                    return (
                      <li key={item.id} className={`moments-item moments-item--editable moments-item--deck-row${isEditing ? ' moments-item--editing' : ''}`}>
                        {showMeta ? (
                          <div className="moments-item__meta">
                            {showOrderInMeta ? (
                              <span className="moments-item__order">
                                {t('momentsPublishOrder')} {String(item.publishOrder).padStart(2, '0')}
                              </span>
                            ) : null}
                            {!isEditing && item.contentDirection?.trim() ? (
                              <span className="moments-item__direction">{item.contentDirection}</span>
                            ) : null}
                          </div>
                        ) : null}
                        {isEditing && editing ? (
                          <div className="moments-item__form">
                            <div className="moments-item__field">
                              <Label htmlFor={`dir-${item.id}`}>{t('momentsContentDirection')}</Label>
                              <MomentsContentDirectionField
                                inputId={`dir-${item.id}`}
                                value={editing.contentDirection}
                                topic={editing.topic}
                                mode={mode}
                                presetOptions={options}
                                disabled={busyItemId === item.id}
                                onChange={(contentDirection) => setEditing({ ...editing, contentDirection })}
                              />
                            </div>
                            <div className="moments-item__field">
                              <Label htmlFor={`topic-${item.id}`}>{t('momentsTopic')}</Label>
                              <Input
                                id={`topic-${item.id}`}
                                value={editing.topic}
                                onChange={(event) => setEditing({ ...editing, topic: event.target.value })}
                              />
                            </div>
                            <div className="moments-item__field">
                              <Label htmlFor={`capture-${item.id}`}>{t('momentsCaptureOptional')}</Label>
                              <Input
                                id={`capture-${item.id}`}
                                value={editing.captureSuggestion}
                                onChange={(event) => setEditing({ ...editing, captureSuggestion: event.target.value })}
                              />
                            </div>
                            <div className="moments-item__form-actions">
                              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                                {t('momentsCancel')}
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1"
                                disabled={busyItemId === item.id}
                                onClick={() => void saveEdit()}
                              >
                                <CheckIcon className="h-3.5 w-3.5" />
                                {t('momentsSave')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="moments-item__topic moments-item__topic--deck">{item.topic}</p>
                            {item.captureSuggestion?.trim() ? (
                              <p className="moments-item__capture">
                                {t('momentsCaptureSuggestion')}：{item.captureSuggestion}
                              </p>
                            ) : null}
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {confirmed && dayItems.length > 0 && !editing && (
                <div className="moments-day-deck__day-actions">
                  <Button onClick={() => onOpenDay(focusDate)}>
                    {t('momentsGenerateDay')}
                  </Button>
                </div>
              )}
            </MomentsPlanDayDeck>
          </MomentsGoalWeekShell>
        </div>

        <div className="moments-plan-shell__divider" />

        <section className="moments-plan-revise">
          <h3 className="moments-plan-revise__title">{t('momentsReviseTitle')}</h3>
          <p className="moments-plan-revise__desc">{t('momentsReviseDesc')}</p>
          <div className="moments-plan-revise__input-control">
            <Textarea
              rows={3}
              value={revision}
              placeholder={t('momentsRevisePlaceholder')}
              disabled={revisionPolishing}
              onChange={(event) => { setRevision(event.target.value); setRevisionSuggestion(undefined) }}
            />
            <AIEditPopover
              fieldLabel={t('momentsRevisionFieldLabel')}
              value={revision}
              result={revisionSuggestion}
              streamingResult={revisionStreaming}
              busy={revisionPolishing}
              error={revisionError}
              disabled={saving}
              quickPrompts={revisionQuickPrompts}
              labels={revisionLabels}
              triggerClassName="ai-edit-popover--profile"
              className="ai-edit-popover--profile"
              onGenerate={(instruction) => void polishRevision(instruction)}
              onApply={() => { if (revisionSuggestion) setRevision(revisionSuggestion); setRevisionSuggestion(undefined) }}
              onDismiss={() => { setRevisionSuggestion(undefined); setRevisionError('') }}
            />
          </div>
          <div className="moments-plan-revise__actions">
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={!revision.trim()}
              onClick={() => onRevise(revision.trim())}
            >
              <RefreshCwIcon className="h-4 w-4" />
              {t('momentsRegeneratePlan')}
            </Button>
            <Button className="gap-1.5" disabled={saving || confirmed} onClick={onConfirm}>
              <WandSparklesIcon className="h-4 w-4" />
              {confirmed ? t('momentsWeekConfirmedBadge') : t('momentsConfirmSavePlan')}
            </Button>
          </div>
        </section>
      </section>
    </div>
  )
}
