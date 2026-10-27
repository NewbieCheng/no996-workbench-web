import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@no996/ui/card'
import { ScrollArea } from '@no996/ui/scroll-area'
import { Textarea } from '@no996/ui/textarea'
import { FormSheet } from '@no996/ui/module-form'
import { ArrowRightIcon, ChevronDownIcon, PanelRightCloseIcon } from 'lucide-react'
import type { UserProfileFormData } from '../../../services/persona'
import { polishUserProfileField } from '../agent/form-assist'
import type { AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import { ChatPromptAttachments, useChatPromptAttachments } from '../../../components/ChatPromptAttachments'
import { PersonaPresetPicker } from './PersonaPresetPicker'
import {
  ProfileFormFieldCard,
  type FieldRevision,
  type PersonaFieldKey,
  type PersonaFieldVariant,
} from './ProfileFormFieldCard'

type Props = {
  isConfigured: boolean
  initialData: UserProfileFormData
  onSubmit: (data: UserProfileFormData, attachmentItems: AttachmentUploaderItem[]) => void
  onFormChange?: (data: UserProfileFormData) => void
  onTryExample?: (data: UserProfileFormData) => void
  submitBusy?: boolean
  editorMode?: boolean
  onSaveDraft?: (data: UserProfileFormData) => void
  savingDraft?: boolean
  onActiveStepChange?: (step: number) => void
  onToggleCollapse?: () => void
  canCollapse?: boolean
}

type FieldDef = {
  key: PersonaFieldKey
  labelKey: string
  placeholderKey: string
  multiline?: boolean
  required?: boolean
  variant?: PersonaFieldVariant
  section: 'core' | 'optional'
}

type IdentityFieldProps = {
  fieldKey: 'industry' | 'role'
  label: string
  placeholder: string
  value: string
  options: readonly string[]
  suggestionsLabel: string
  error?: string
  onChange: (value: string) => void
}

function IdentitySentenceField({ fieldKey, label, placeholder, value, options, suggestionsLabel, error, onChange }: IdentityFieldProps) {
  const inputId = `persona-${fieldKey}`
  const matchingOptions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase()
    if (!query) return []
    return options
      .filter((option) => option !== value && option.toLocaleLowerCase().includes(query))
      .slice(0, 5)
  }, [options, value])
  return (
    <span className="persona-identity-field">
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <span className="persona-identity-field__ghost" aria-hidden="true">
        {value || placeholder}
      </span>
      <span className="persona-identity-field__control">
        <Textarea
          id={inputId}
          className="persona-identity-field__input"
          value={value}
          placeholder={placeholder}
          rows={1}
          required
          aria-label={label}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
        <PersonaPresetPicker label={label} value={value} options={options} onSelect={onChange} />
      </span>
      {matchingOptions.length ? (
        <span className="persona-field-suggestions" role="group" aria-label={suggestionsLabel}>
          {matchingOptions.map((option) => (
            <Button key={option} type="button" variant="outline" size="sm" onClick={() => onChange(option)}>
              {option}
            </Button>
          ))}
        </span>
      ) : null}
      {error ? <span className="persona-identity-field__error" role="alert">{error}</span> : null}
    </span>
  )
}

export const PERSONA_FORM_WIZARD_STEPS = [
  {
    id: 'identity',
    labelKey: 'form.wizardStepIdentity',
    titleKey: 'form.wizardIdentityTitle',
    leadKey: 'form.wizardIdentityLead',
  },
  {
    id: 'business',
    labelKey: 'form.wizardStepBusiness',
    titleKey: 'form.wizardBusinessTitle',
    leadKey: 'form.wizardBusinessLead',
  },
  {
    id: 'edge',
    labelKey: 'form.wizardStepEdge',
    titleKey: 'form.wizardEdgeTitle',
    leadKey: 'form.wizardEdgeLead',
  },
] as const

const CORE_FIELDS: FieldDef[] = [
  {
    key: 'primaryBusiness',
    labelKey: 'form.heroLabel',
    placeholderKey: 'form.heroPlaceholder',
    multiline: true,
    required: true,
    variant: 'hero',
    section: 'core',
  },
  {
    key: 'targetClients',
    labelKey: 'form.targetClients',
    placeholderKey: 'form.targetClientsPlaceholder',
    required: true,
    section: 'core',
  },
]

const OPTIONAL_FIELDS: FieldDef[] = [
  {
    key: 'clientPainPoints',
    labelKey: 'form.clientPainPoints',
    placeholderKey: 'form.clientPainPointsPlaceholder',
    multiline: true,
    section: 'optional',
  },
  {
    key: 'desiredImage',
    labelKey: 'form.desiredImage',
    placeholderKey: 'form.desiredImagePlaceholder',
    section: 'optional',
  },
  {
    key: 'additionalInfo',
    labelKey: 'form.additionalInfo',
    placeholderKey: 'form.additionalInfoPlaceholder',
    multiline: true,
    section: 'optional',
  },
]

export function ProfileFormView({
  isConfigured,
  initialData,
  onSubmit,
  onFormChange,
  onTryExample,
  submitBusy,
  editorMode = false,
  onSaveDraft,
  savingDraft = false,
  onActiveStepChange,
  onToggleCollapse,
  canCollapse = true,
}: Props) {
  const { t } = useTranslation('persona')
  const [formData, setFormData] = useState<UserProfileFormData>(initialData)
  const [activeStep, setActiveStep] = useState(0)
  const [errors, setErrors] = useState<Partial<Record<PersonaFieldKey, string>>>({})
  const [revisions, setRevisions] = useState<Partial<Record<PersonaFieldKey, FieldRevision>>>({})
  const [polishErrors, setPolishErrors] = useState<Partial<Record<PersonaFieldKey, string>>>({})
  const [polishingField, setPolishingField] = useState<PersonaFieldKey | null>(null)
  const [tuningField, setTuningField] = useState<PersonaFieldKey | null>(null)
  const [streamingByField, setStreamingByField] = useState<Partial<Record<PersonaFieldKey, string>>>({})
  const abortRef = useRef<AbortController | null>(null)
  const { items: attachmentItems, setItems: setAttachmentItems, clear: clearAttachments } =
    useChatPromptAttachments()

  const initialSnapshot = useRef(JSON.stringify(initialData))
  useEffect(() => {
    const nextSnapshot = JSON.stringify(initialData)
    if (nextSnapshot === initialSnapshot.current) return
    initialSnapshot.current = nextSnapshot
    setFormData(initialData)
  }, [initialData])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    onActiveStepChange?.(activeStep)
  }, [activeStep, onActiveStepChange])

  const fieldLabels = useMemo(
    () => ({
      tuneConcise: t('form.tuneConcise'),
      tuneSpecific: t('form.tuneSpecific'),
      tuneWarm: t('form.tuneWarm'),
    }),
    [t],
  )
  const polishLabels = useMemo(
    () => ({
      trigger: t('form.optimizeField'),
      context: t('form.aiPopoverContext'),
      promptPlaceholder: t('form.aiPopoverPromptPlaceholder'),
      apply: t('form.adoptSuggestion'),
      dismiss: t('form.dismissRevision'),
      loading: t('form.aiPopoverLoading'),
      send: t('form.aiPopoverSend'),
      focusHint: t('form.aiPopoverFocusHint'),
      result: t('form.aiPopoverResult'),
    }),
    [t],
  )

  function patchFormData(patch: UserProfileFormData) {
    setFormData(patch)
    onFormChange?.(patch)
  }

  function setFieldValue(key: PersonaFieldKey, value: string, clearRevision = true) {
    patchFormData({ ...formData, [key]: value })
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
    if (clearRevision && revisions[key]) {
      setRevisions((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function exampleFormData(): UserProfileFormData {
    return {
      industry: t('example.industry'),
      role: t('example.role'),
      primaryBusiness: t('example.primaryBusiness'),
      targetClients: t('example.targetClients'),
      clientPainPoints: t('example.clientPainPoints'),
      desiredImage: t('example.desiredImage'),
      additionalInfo: t('example.additionalInfo'),
    }
  }

  function applyTryExample() {
    const next = exampleFormData()
    patchFormData(next)
    setRevisions({})
    setPolishErrors({})
    setErrors({})
    onTryExample?.(next)
  }

  function validateStep(step: number) {
    const errs: Partial<Record<PersonaFieldKey, string>> = {}
    if (step === 0) {
      if (!formData.industry.trim()) errs.industry = t('form.industryRequired')
      if (!formData.role.trim()) errs.role = t('form.roleRequired')
    } else if (step === 1) {
      if (!formData.primaryBusiness.trim()) errs.primaryBusiness = t('form.primaryBusinessRequired')
      if (!formData.targetClients?.trim()) errs.targetClients = t('form.targetClientsRequired')
    }
    setErrors((previous) => ({ ...previous, ...errs }))
    return Object.keys(errs).length === 0
  }

  function goToStep(targetStep: number) {
    if (targetStep <= activeStep) {
      setActiveStep(targetStep)
      return
    }
    for (let step = activeStep; step < targetStep; step += 1) {
      if (!validateStep(step)) return
    }
    setActiveStep(targetStep)
  }

  function validateCore() {
    const errs: Partial<Record<PersonaFieldKey, string>> = {}
    if (!formData.industry.trim()) errs.industry = t('form.industryRequired')
    if (!formData.role.trim()) errs.role = t('form.roleRequired')
    if (!formData.primaryBusiness.trim()) errs.primaryBusiness = t('form.primaryBusinessRequired')
    if (!formData.targetClients?.trim()) errs.targetClients = t('form.targetClientsRequired')
    setErrors(errs)
    if (errs.industry || errs.role) setActiveStep(0)
    else if (errs.primaryBusiness || errs.targetClients) setActiveStep(1)
    return Object.keys(errs).length === 0
  }

  function submitFinalStep() {
    if (activeStep !== PERSONA_FORM_WIZARD_STEPS.length - 1 || !validateCore()) return
    onSubmit(formData, attachmentItems)
    clearAttachments()
  }

  async function runPolish(field: PersonaFieldKey, instruction?: string) {
    setPolishErrors((prev) => ({ ...prev, [field]: undefined }))
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPolishingField(field)
    if (instruction) setTuningField(field)
    setStreamingByField((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    try {
      const original = formData[field] ?? ''
      const next = await polishUserProfileField({
        field,
        value: original,
        form: formData,
        instruction,
        signal: controller.signal,
        onPartial: (text) => setStreamingByField((prev) => ({ ...prev, [field]: text })),
      })
      setRevisions((prev) => ({ ...prev, [field]: { original, suggestion: next } }))
    } catch (e) {
      if (controller.signal.aborted) return
      setPolishErrors((prev) => ({
        ...prev,
        [field]: e instanceof Error ? e.message : t('form.aiAssistError'),
      }))
    } finally {
      if (abortRef.current === controller) {
        setPolishingField(null)
        setTuningField(null)
        setStreamingByField((prev) => {
          const next = { ...prev }
          delete next[field]
          return next
        })
      }
    }
  }

  function adoptSuggestion(field: PersonaFieldKey) {
    const text = revisions[field]?.suggestion.trim()
    if (!text) return
    setFieldValue(field, text, true)
  }

  function dismissRevision(field: PersonaFieldKey) {
    setRevisions((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setPolishErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const fieldsDisabled = Boolean(polishingField) || submitBusy

  function optionList(key: string): string[] {
    return t(`form.${key}`, { returnObjects: true }) as string[]
  }

  function renderField(def: FieldDef) {
    const value = formData[def.key] ?? ''
    const fieldLabel = t(def.labelKey)
    return (
      <ProfileFormFieldCard
        key={def.key}
        fieldKey={def.key}
        label={fieldLabel}
        placeholder={t(def.placeholderKey)}
        value={value}
        options={
          def.key === 'primaryBusiness' ? optionList('primaryBusinessOptions')
            : def.key === 'targetClients' ? optionList('targetClientsOptions')
              : def.key === 'clientPainPoints' ? optionList('clientPainPointsOptions')
                : def.key === 'desiredImage' ? optionList('desiredImageOptions')
                  : undefined
        }
        suggestionsLabel={t('form.suggestionsLabel', { field: fieldLabel })}
        required={def.required}
        multiline={def.multiline}
        variant={def.variant}
        disabled={fieldsDisabled}
        invalid={Boolean(errors[def.key])}
        error={errors[def.key]}
        revision={revisions[def.key] ?? null}
        streamingSuggestion={streamingByField[def.key]}
        polishing={polishingField === def.key}
        tuning={tuningField === def.key}
        polishError={polishErrors[def.key]}
        labels={fieldLabels}
        popoverLabels={polishLabels}
        onChange={(next) => setFieldValue(def.key, next)}
        onPolish={() => void runPolish(def.key)}
        onTune={(instruction) => void runPolish(def.key, instruction)}
        onAdopt={() => adoptSuggestion(def.key)}
        onDismissRevision={() => dismissRevision(def.key)}
      />
    )
  }

  const currentStep = PERSONA_FORM_WIZARD_STEPS[activeStep]
  const stepOptionalDefs = OPTIONAL_FIELDS

  function renderIdentityField(fieldKey: 'industry' | 'role', labelKey: string, placeholderKey: string) {
    const fieldLabel = t(labelKey)
    return (
      <IdentitySentenceField
        key={fieldKey}
        fieldKey={fieldKey}
        label={fieldLabel}
        placeholder={t(placeholderKey)}
        value={formData[fieldKey]}
        options={optionList(fieldKey === 'industry' ? 'industryOptions' : 'roleOptions')}
        suggestionsLabel={t('form.suggestionsLabel', { field: fieldLabel })}
        error={errors[fieldKey]}
        onChange={(value) => setFieldValue(fieldKey, value)}
      />
    )
  }

  return (
    <FormSheet className="persona-form-sheet">
      <Card className="persona-form-card w-full">
        <form
          className="persona-form-card__form"
          onSubmit={(e) => e.preventDefault()}
        >
          <CardHeader className="persona-form-card__header">
            <div className="persona-form-card__header-row">
              <div className="persona-form-card__stepper-group">
                {onToggleCollapse ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="persona-form-card__collapse"
                    disabled={!canCollapse}
                    aria-label={t('form.collapse')}
                    onClick={onToggleCollapse}
                  >
                    <PanelRightCloseIcon aria-hidden="true" />
                  </Button>
                ) : null}
                <nav className="persona-form-stepper" aria-label={t('form.wizardAria')}>
                  {PERSONA_FORM_WIZARD_STEPS.map((step, index) => (
                    <Fragment key={step.id}>
                      <button
                        type="button"
                        className={index === activeStep ? 'is-current' : index < activeStep ? 'is-complete' : ''}
                        aria-current={index === activeStep ? 'step' : undefined}
                        onClick={() => goToStep(index)}
                      >
                        <span className="persona-form-stepper__number">{index + 1}</span>
                        <span>{t(step.labelKey)}</span>
                      </button>
                      {index < PERSONA_FORM_WIZARD_STEPS.length - 1 ? (
                        <span
                          className={`persona-form-stepper__connector${index < activeStep ? ' is-complete' : ''}`}
                          aria-hidden="true"
                        />
                      ) : null}
                    </Fragment>
                  ))}
                </nav>
              </div>
            </div>
          </CardHeader>
          <ScrollArea className="persona-form-card__scroll">
            <CardContent className="px-6 pt-5 pb-6 sm:px-6">
            <section className={`persona-form-step${activeStep === 2 ? ' persona-form-step--edge' : ''}`} aria-live="polite">
              <div className="persona-form-step__heading">
                <h3>{t(currentStep.titleKey)}</h3>
                <p>{t(currentStep.leadKey)}</p>
              </div>

              {activeStep === 0 ? (
                <div className="persona-form-core persona-form-step--identity">
                  <p className="persona-identity-sentence">
                    <span>{t('form.identitySentenceStart')}</span>
                    {renderIdentityField('industry', 'form.industryShort', 'form.industryPlaceholder')}
                    <span>{t('form.identitySentenceMiddle')}</span>
                    {renderIdentityField('role', 'form.roleShort', 'form.rolePlaceholder')}
                    <span>{t('form.identitySentenceEnd')}</span>
                  </p>
                  <p className="persona-form-core__hint">{t('form.identitySentenceHint')}</p>
                </div>
              ) : null}

              {activeStep === 1 ? (
                <div className="persona-form-core">
                  {CORE_FIELDS.map(renderField)}
                </div>
              ) : null}

              {activeStep === 2 ? (
                <div className="persona-form-core">
                  <details className="persona-form-extra" open>
                    <summary className="persona-form-extra__summary">
                      <span>{t('form.sectionOptional')}</span>
                      {stepOptionalDefs.some((field) => (formData[field.key] ?? '').trim()) || attachmentItems.length > 0 ? (
                        <span className="persona-form-extra__badge">
                          {stepOptionalDefs.filter((field) => (formData[field.key] ?? '').trim()).length + attachmentItems.length}
                        </span>
                      ) : null}
                      <ChevronDownIcon className="persona-form-extra__chevron" aria-hidden />
                    </summary>
                    <div className="persona-form-extra__body">
                      {stepOptionalDefs.filter((field) => field.key !== 'additionalInfo').map(renderField)}
                      <div className="persona-form-extra__combined">
                        {stepOptionalDefs.filter((field) => field.key === 'additionalInfo').map(renderField)}
                        <div className="persona-form-extra__attachments">
                          <p>{t('form.attachmentHint')}</p>
                          <ChatPromptAttachments
                            disabled={fieldsDisabled}
                            items={attachmentItems}
                            onChange={setAttachmentItems}
                          />
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              ) : null}
            </section>
            </CardContent>
          </ScrollArea>

          <CardFooter className="persona-form-card__footer shrink-0 flex-wrap gap-2">
            {!editorMode ? (
              <Button type="button" variant="ghost" size="sm" disabled={fieldsDisabled} onClick={applyTryExample}>
                {t('form.tryExample')}
              </Button>
            ) : null}
            <div className="persona-form-card__actions-end">
              {activeStep > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setActiveStep((step) => step - 1)}>
                  {t('form.back')}
                </Button>
              ) : null}
              {onSaveDraft && activeStep === PERSONA_FORM_WIZARD_STEPS.length - 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingDraft || fieldsDisabled}
                  onClick={() => {
                    if (validateCore()) onSaveDraft(formData)
                  }}
                >
                  {savingDraft ? t('form.savingDraft') : t('form.savePersona')}
                </Button>
              ) : null}
              {activeStep < PERSONA_FORM_WIZARD_STEPS.length - 1 ? (
                <Button
                  key="wizard-advance"
                  type="button"
                  size="sm"
                  className="min-w-[7rem] gap-2"
                  disabled={fieldsDisabled}
                  onClick={(event) => {
                    event.preventDefault()
                    if (validateStep(activeStep)) {
                      setActiveStep((step) => Math.min(PERSONA_FORM_WIZARD_STEPS.length - 1, step + 1))
                    }
                  }}
                >
                  {t('form.next')}
                  <ArrowRightIcon className="size-4" />
                </Button>
              ) : (
                <Button
                  key="wizard-final-action"
                  type="button"
                  size="sm"
                  className="min-w-[7rem] gap-2"
                  disabled={submitBusy || fieldsDisabled}
                  onClick={submitFinalStep}
                >
                  {submitBusy
                    ? t('form.submitBusy')
                    : editorMode
                      ? t('form.updateProfile')
                      : isConfigured
                        ? t('form.submitTune')
                        : t('form.submitGenerate')}
                  <ArrowRightIcon className="size-4" />
                </Button>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </FormSheet>
  )
}
