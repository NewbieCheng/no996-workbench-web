import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MomentsPlanningMode } from '../domain/moments'
import type { WeekConfigDraft } from '../service/moments-store'
import { MomentsAssistField } from './MomentsAssistField'
import { businessPurposePresets, coreTasksPresets } from '../lib/config-field-presets'
import { InputWizard } from '../../../components/agent/InputWizard'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Label } from '@no996/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'
import { ArrowLeftIcon } from 'lucide-react'
import { formatWeekLabel } from '../service/week-range'
import { toastSuccess } from '../../../lib/toast'
import {
  draftToFormState,
  formStateToDraft,
  validateWeekConfigAll,
  validateWeekConfigStep,
  type WeekConfigFormState,
} from '../lib/week-config-form'

export type { WeekConfigDraft }

interface WeekConfigViewProps {
  initial: WeekConfigDraft
  loading: boolean
  onBack: () => void
  onSubmit: (draft: WeekConfigDraft) => void
  exampleWeekContext?: { weekId: string; weekStart: string; weekEnd: string }
}

const DAY_KEYS = [
  'momentsWeekdayMonday',
  'momentsWeekdayTuesday',
  'momentsWeekdayWednesday',
  'momentsWeekdayThursday',
  'momentsWeekdayFriday',
  'momentsWeekdaySaturday',
  'momentsWeekdaySunday',
] as const

export function WeekConfigView({ initial, loading, onBack, onSubmit, exampleWeekContext }: WeekConfigViewProps) {
  const { t } = useTranslation('workbench')
  const wizardSteps = useMemo(
    () => [
      { id: 'mode', label: t('momentsWizardStepMode') },
      { id: 'publish', label: t('momentsWizardStepPublish') },
      { id: 'goals', label: t('momentsWizardStepGoals') },
    ],
    [t],
  )
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WeekConfigFormState>(() => draftToFormState(initial))
  const [touched, setTouched] = useState(false)

  const patch = useCallback((partial: Partial<WeekConfigFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }))
  }, [])

  const applyDraft = useCallback((draft: WeekConfigDraft) => {
    setForm(draftToFormState(draft))
    setTouched(false)
    setStep(2)
  }, [])

  const handleFillExample = useCallback(() => {
    if (!exampleWeekContext) return
    void import('../dev/dev-fixtures').then((mod) => {
      applyDraft(mod.exampleWeekConfig(exampleWeekContext.weekId, exampleWeekContext.weekStart, exampleWeekContext.weekEnd))
      toastSuccess(t('momentsFillExampleDone'))
    })
  }, [applyDraft, exampleWeekContext, t])

  const stepErrors = useMemo(() => validateWeekConfigStep(step, form, t), [step, form, t])
  const allErrors = useMemo(() => validateWeekConfigAll(form, t), [form, t])

  const handleSubmit = useCallback(() => {
    setTouched(true)
    if (allErrors.length > 0) {
      if (validateWeekConfigStep(0, form, t).length) setStep(0)
      else if (validateWeekConfigStep(1, form, t).length) setStep(1)
      else setStep(2)
      return
    }
    onSubmit(formStateToDraft(initial, form))
  }, [allErrors.length, form, initial, onSubmit, t])

  const rangeLabel = formatWeekLabel(initial.planPeriod.startDate, initial.planPeriod.endDate)
  const nextDisabled = stepErrors.length > 0
  const goDisabled = allErrors.length > 0

  const setMode = (mode: MomentsPlanningMode) => patch({ mode })

  return (
    <div className="moments-config">
      <div className="moments-subhead moments-subhead--wizard">
        <div>
          <h2>{t('momentsConfigTitle', { range: rangeLabel })}</h2>
        </div>
        <div className="moments-subhead__actions">
          {exampleWeekContext ? (
            <Button variant="outline" size="sm" onClick={handleFillExample}>
              {t('momentsFillExample')}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {t('momentsBack')}
          </Button>
        </div>
      </div>

      <InputWizard
        steps={wizardSteps}
        active={step}
        onStepChange={setStep}
        goOnLastStepOnly
        goLabel={t('momentsGeneratePlan')}
        busyLabel={t('momentsGeneratingPlan')}
        busy={loading}
        goDisabled={goDisabled}
        nextDisabled={nextDisabled}
        onGo={handleSubmit}
        nextLabel={t('momentsNext')}
        backLabel={t('momentsWizardBack')}
        error={touched && stepErrors.length > 0 ? stepErrors[0] : touched && step === 2 && allErrors[0] ? allErrors[0] : undefined}
        ariaLabel={t('momentsConfigWizardAria')}
      >
        {step === 0 && (
          <div className="moments-config__step">
            <Label>{t('momentsPlanningMode')}</Label>
            <Tabs value={form.mode} onValueChange={(value) => setMode(value as MomentsPlanningMode)}>
              <TabsList variant="toolbar" className="moments-mode-tabs">
                <TabsTrigger value="theme">{t('momentsModeTheme')}</TabsTrigger>
                <TabsTrigger value="daily">{t('momentsModeDaily')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="moments-config__step-desc">
              {form.mode === 'theme' ? t('momentsModeThemeDesc') : t('momentsModeDailyDesc')}
            </p>
            <p className="moments-config__step-desc">{t(form.mode === 'theme' ? 'momentsThemeTargetHint' : 'momentsDailyTargetHint')}</p>
              <div className="moments-target">
                <div className="moments-target__field">
                  <Label htmlFor="moments-product">{t('momentsProductName')}</Label>
                  <Input
                    id="moments-product"
                    value={form.productName}
                    placeholder={t('momentsProductPlaceholder')}
                    onChange={(event) => patch({ productName: event.target.value })}
                  />
                </div>
                <div className="moments-target__field">
                  <Label htmlFor="moments-activity">{t('momentsActivityName')}</Label>
                  <Input
                    id="moments-activity"
                    value={form.activityName}
                    placeholder={t('momentsActivityPlaceholder')}
                    onChange={(event) => patch({ activityName: event.target.value })}
                  />
                </div>
              </div>
          </div>
        )}

        {step === 1 && (
          <div className="moments-config__step">
            <Label>{t('momentsPublishCount')}</Label>
            <div className="moments-publish">
              <div className="moments-publish__modes">
                <label className={`moments-publish__option${!form.splitByDay ? ' moments-publish__option--active' : ''}`}>
                  <input type="radio" name="moments-publish-mode" checked={!form.splitByDay} onChange={() => patch({ splitByDay: false })} />
                  <span><strong>{t('momentsPublishEvenTitle')}</strong><small>{t('momentsPublishEvenDesc')}</small></span>
                </label>
                <label className={`moments-publish__option${form.splitByDay ? ' moments-publish__option--active' : ''}`}>
                  <input type="radio" name="moments-publish-mode" checked={form.splitByDay} onChange={() => patch({ splitByDay: true })} />
                  <span><strong>{t('momentsPerDayLabel')}</strong><small>{t('momentsPublishDailyDesc')}</small></span>
                </label>
              </div>
              {!form.splitByDay ? (
                <div className="moments-publish__weekly">
                  <label htmlFor="moments-weekly-count">{t('momentsPerWeekCount')}</label>
                  <input id="moments-weekly-count" type="number" min={1} max={28} className="moments-publish__number" value={form.perWeek} onChange={(event) => patch({ perWeek: Number(event.target.value) || 1 })} />
                  <span>{t('momentsPerWeekSuffix')}</span>
                </div>
              ) : (
                <div className="moments-publish__days">
                  {DAY_KEYS.map((key, index) => (
                    <div key={key} className="moments-publish__day">
                      <span>{t(key)}</span>
                      <input
                        type="number"
                        min={1}
                        max={4}
                        className="moments-publish__number"
                        value={form.perDay[index] ?? 1}
                        aria-label={t(key)}
                        onChange={(event) => {
                          const next = [...form.perDay]
                          next[index] = Number(event.target.value) || 1
                          patch({ perDay: next })
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="moments-config__step">
            <div className="moments-config__step-field">
              <Label htmlFor="moments-business-purpose">{t('momentsBusinessPurpose')}</Label>
              <MomentsAssistField
                field="businessPurpose"
                inputId="moments-business-purpose"
                label={t('momentsBusinessPurpose')}
                value={form.businessPurpose}
                mode={form.mode}
                productName={form.productName}
                activityName={form.activityName}
                relatedFieldLabel={t('momentsCoreTasks')}
                relatedValue={form.coreTasks}
                presetOptions={businessPurposePresets(form.mode)}
                disabled={loading}
                onChange={value => patch({ businessPurpose: value })}
              />
            </div>
            <div className="moments-config__step-field">
              <Label htmlFor="moments-core-tasks">{t('momentsCoreTasks')}</Label>
              <MomentsAssistField
                field="coreTasks"
                inputId="moments-core-tasks"
                label={t('momentsCoreTasks')}
                value={form.coreTasks}
                mode={form.mode}
                productName={form.productName}
                activityName={form.activityName}
                relatedFieldLabel={t('momentsBusinessPurpose')}
                relatedValue={form.businessPurpose}
                presetOptions={coreTasksPresets(form.mode)}
                disabled={loading}
                onChange={value => patch({ coreTasks: value })}
              />
            </div>
          </div>
        )}
      </InputWizard>
    </div>
  )
}
