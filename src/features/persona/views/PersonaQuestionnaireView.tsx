import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@no996/ui/field'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import {
  AttachmentUploader,
  createAttachmentDrafts,
  releaseAttachmentDrafts,
  type AttachmentUploaderItem,
} from '@no996/ui/attachment-uploader'
import { InputWizard } from '../../../components/agent/InputWizard'
import { PersonaQuestionnaireField } from './PersonaQuestionnaireField'
import {
  PersonaQuestionnaireMultiSelect,
  PersonaQuestionnaireSingleSelect,
} from './PersonaQuestionnaireChoices'
import {
  missingRequiredQuestionnaireKeys,
  normalizeQuestionnaire,
  syncLegacyProjection,
} from '../../../services/persona/questionnaire'
import type {
  AccountGoal,
  CitePermission,
  PaidClientStatus,
  PersonaFormData,
  PersonaQuestionnaire,
  ShareWillingness,
} from '../../../services/persona/types'

export const QUESTIONNAIRE_STEPS = [
  { id: 'identity', labelKey: 'questionnaire.stepIdentity' },
  { id: 'audience', labelKey: 'questionnaire.stepAudience' },
  { id: 'method', labelKey: 'questionnaire.stepMethod' },
  { id: 'account', labelKey: 'questionnaire.stepAccount' },
] as const

const DOC_ACCEPT = '.pdf,.doc,.docx,.md,.txt'
const ACCOUNT_GOAL_IDS: AccountGoal[] = ['consult', 'service', 'product', 'influence', 'other']

type AttachmentSlot = 'resume' | 'cases' | 'proof' | 'products'

type Props = {
  initialData: PersonaFormData
  initialStep?: number
  submitBusy?: boolean
  onFormChange?: (data: PersonaQuestionnaire) => void
  onSaveDraft: (data: PersonaQuestionnaire) => void
  onSubmit: (data: PersonaQuestionnaire, attachments: AttachmentUploaderItem[]) => void
  onStepChange?: (step: number) => void
  canCollapse?: boolean
  onCollapse?: () => void
}

function OptionalBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="persona-q-optional" open>
      <summary className="persona-q-optional__summary">
        <span className="persona-q-optional__summary-label">{title}</span>
        <ChevronDownIcon className="persona-q-optional__chevron" aria-hidden="true" />
      </summary>
      <div className="persona-q-optional__body">{children}</div>
    </details>
  )
}

function Question({
  id,
  required,
  label,
  hint,
  error,
  children,
}: {
  id: string
  required?: boolean
  label: string
  hint: string
  error?: string
  children: ReactNode
}) {
  return (
    <Field data-invalid={Boolean(error)} className="persona-q-field">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <FieldDescription>{hint}</FieldDescription>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

export function PersonaQuestionnaireView({
  initialData,
  initialStep = 0,
  submitBusy,
  onFormChange,
  onSaveDraft,
  onSubmit,
  onStepChange,
  canCollapse,
  onCollapse,
}: Props) {
  const { t } = useTranslation('persona')
  const [form, setForm] = useState<PersonaQuestionnaire>(() => normalizeQuestionnaire(initialData))
  const [active, setActive] = useState(Math.min(Math.max(initialStep, 0), 3))
  const [errors, setErrors] = useState<Partial<Record<keyof PersonaQuestionnaire, string>>>({})
  const [attachments, setAttachments] = useState<Record<AttachmentSlot, AttachmentUploaderItem[]>>({
    resume: [],
    cases: [],
    proof: [],
    products: [],
  })

  useEffect(() => {
    setForm(normalizeQuestionnaire(initialData))
  }, [initialData])

  useEffect(() => {
    setActive(Math.min(Math.max(initialStep, 0), QUESTIONNAIRE_STEPS.length - 1))
  }, [initialStep])

  useEffect(() => {
    onStepChange?.(active)
  }, [active, onStepChange])

  function handleStepChange(step: number) {
    setActive(step)
  }

  function applyTryExample() {
    if (!import.meta.env.DEV) return
    void import('../dev/dev-fixtures.ts').then(({ DEV_QUESTIONNAIRE_FIXTURE }) => {
      const next = normalizeQuestionnaire(DEV_QUESTIONNAIRE_FIXTURE)
      setForm(next)
      onFormChange?.(next)
    })
  }

  function patch<K extends keyof PersonaQuestionnaire>(key: K, value: PersonaQuestionnaire[K]) {
    setForm((prev) => {
      const next = syncLegacyProjection({ ...prev, [key]: value })
      onFormChange?.(next)
      return next
    })
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function bindSlot(slot: AttachmentSlot) {
    return {
      items: attachments[slot],
      onAdd: (files: File[]) => {
        const drafts = createAttachmentDrafts(files).map((draft) => ({
          ...draft,
          status: 'ready' as const,
          progress: draft.size,
        }))
        setAttachments((prev) => ({ ...prev, [slot]: [...prev[slot], ...drafts] }))
      },
      onRemove: (id: string) => {
        const removed = attachments[slot].find((item) => item.id === id)
        if (removed) releaseAttachmentDrafts([removed])
        setAttachments((prev) => ({ ...prev, [slot]: prev[slot].filter((item) => item.id !== id) }))
      },
    }
  }

  const steps = useMemo(
    () => QUESTIONNAIRE_STEPS.map((step) => ({ id: step.id, label: t(step.labelKey) })),
    [t],
  )

  function validateAll(): boolean {
    const missing = missingRequiredQuestionnaireKeys(form)
    if (!missing.length) {
      setErrors({})
      return true
    }
    const next: Partial<Record<keyof PersonaQuestionnaire, string>> = {}
    for (const key of missing) next[key] = t('questionnaire.required')
    setErrors(next)
    const first = missing[0]
    if (['publicName', 'occupation', 'workExperience', 'strengths', 'cases'].includes(first)) setActive(0)
    else if (['audiences', 'clientSituations', 'paidStatus', 'products', 'delivery', 'accountGoals'].includes(first)) setActive(1)
    else setActive(3)
    return false
  }

  function toggleGoal(id: AccountGoal, checked: boolean) {
    const current = form.accountGoals
    patch(
      'accountGoals',
      checked ? [...current, id] : current.filter((item) => item !== id),
    )
  }

  const uploader = (slot: AttachmentSlot, label: string) => {
    const bound = bindSlot(slot)
    return (
      <AttachmentUploader
        kind="doc"
        accept={DOC_ACCEPT}
        layout="list"
        items={bound.items}
        onAdd={bound.onAdd}
        onRemove={bound.onRemove}
        maxCount={4}
        addLabel={label}
        emptyTitle={label}
        emptyDescription={t('questionnaire.uploadHint')}
      />
    )
  }

  return (
    <InputWizard
      steps={steps}
      active={active}
      onStepChange={handleStepChange}
      goLabel={t('questionnaire.submit')}
      busyLabel={t('form.submitBusy')}
      busy={submitBusy}
      goDisabled={submitBusy}
      goOnLastStepOnly
      onGo={() => {
        if (!validateAll()) return
        onSubmit(form, [...attachments.resume, ...attachments.cases, ...attachments.proof, ...attachments.products])
      }}
      backLabel={t('form.back')}
      nextLabel={t('form.next')}
      ariaLabel={t('questionnaire.wizardAria')}
      footerLeadingSlot={
        <div className="persona-q-foot-toolbar">
          {canCollapse && onCollapse ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCollapse}>
              {t('form.collapse')}
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => onSaveDraft(form)}>
            {t('questionnaire.saveDraft')}
          </Button>
          {import.meta.env.DEV ? (
            <Button type="button" variant="ghost" size="sm" onClick={applyTryExample}>
              {t('questionnaire.tryExample')}
            </Button>
          ) : null}
        </div>
      }
    >
      {active === 0 ? (
        <div className="persona-q-page">
          <h3>{t('questionnaire.page1Title')}</h3>
          <Question id="q1" required label={t('questionnaire.q1')} hint={t('questionnaire.q1Hint')} error={errors.publicName}>
            <Input id="q1" value={form.publicName} onChange={(e) => patch('publicName', e.target.value)} />
          </Question>
          <Question id="q2" required label={t('questionnaire.q2')} hint={t('questionnaire.q2Hint')} error={errors.occupation}>
            <PersonaQuestionnaireField
              inputId="q2"
              field="occupation"
              label={t('questionnaire.q2')}
              value={form.occupation}
              form={form}
              multiline
              rows={4}
              disabled={submitBusy}
              onChange={(value) => patch('occupation', value)}
            />
          </Question>
          <Question id="q4" required label={t('questionnaire.q4')} hint={t('questionnaire.q4Hint')} error={errors.workExperience}>
            <PersonaQuestionnaireField
              inputId="q4"
              field="workExperience"
              label={t('questionnaire.q4')}
              value={form.workExperience}
              form={form}
              multiline
              rows={5}
              disabled={submitBusy}
              onChange={(value) => patch('workExperience', value)}
            />
            {uploader('resume', t('questionnaire.uploadResume'))}
          </Question>
          <Question id="q5" required label={t('questionnaire.q5')} hint={t('questionnaire.q5Hint')} error={errors.strengths}>
            <PersonaQuestionnaireField
              inputId="q5"
              field="strengths"
              label={t('questionnaire.q5')}
              value={form.strengths}
              form={form}
              multiline
              rows={4}
              disabled={submitBusy}
              onChange={(value) => patch('strengths', value)}
            />
          </Question>
          <Question id="q6" required label={t('questionnaire.q6')} hint={t('questionnaire.q6Hint')} error={errors.cases}>
            <PersonaQuestionnaireField
              inputId="q6"
              field="cases"
              label={t('questionnaire.q6')}
              value={form.cases}
              form={form}
              multiline
              rows={5}
              disabled={submitBusy}
              onChange={(value) => patch('cases', value)}
            />
            {uploader('cases', t('questionnaire.uploadCases'))}
          </Question>
          <OptionalBlock title={t('questionnaire.optionalSection')}>
            <Question id="q3" label={t('questionnaire.q3')} hint={t('questionnaire.q3Hint')}>
              <Textarea id="q3" rows={3} value={form.education} onChange={(e) => patch('education', e.target.value)} />
            </Question>
            <Question id="q7" label={t('questionnaire.q7')} hint={t('questionnaire.q7Hint')}>
              <Textarea id="q7" rows={3} value={form.results} onChange={(e) => patch('results', e.target.value)} />
            </Question>
            <Question id="q8" label={t('questionnaire.q8')} hint={t('questionnaire.q8Hint')}>
              {uploader('proof', t('questionnaire.uploadProof'))}
              <Textarea id="q8" rows={3} value={form.proofNotes} onChange={(e) => patch('proofNotes', e.target.value)} />
              <PersonaQuestionnaireSingleSelect
                value={form.citePermission}
                placeholder={t('questionnaire.selectPlaceholder')}
                aria-label={t('questionnaire.q8')}
                options={(['public', 'anonymous', 'private'] as CitePermission[]).map((value) => ({
                  value,
                  label: t(`questionnaire.cite.${value}`),
                }))}
                onChange={(value) => patch('citePermission', value)}
              />
            </Question>
            <Question id="q9" label={t('questionnaire.q9')} hint={t('questionnaire.q9Hint')}>
              <Textarea id="q9" rows={3} value={form.reputation} onChange={(e) => patch('reputation', e.target.value)} />
            </Question>
          </OptionalBlock>
        </div>
      ) : null}

      {active === 1 ? (
        <div className="persona-q-page">
          <h3>{t('questionnaire.page2Title')}</h3>
          <Question id="q10" required label={t('questionnaire.q10')} hint={t('questionnaire.q10Hint')} error={errors.audiences}>
            <PersonaQuestionnaireField
              inputId="q10"
              field="audiences"
              label={t('questionnaire.q10')}
              value={form.audiences}
              form={form}
              multiline
              rows={4}
              disabled={submitBusy}
              onChange={(value) => patch('audiences', value)}
            />
          </Question>
          <Question id="q11" required label={t('questionnaire.q11')} hint={t('questionnaire.q11Hint')} error={errors.clientSituations}>
            <Textarea id="q11" rows={4} value={form.clientSituations} onChange={(e) => patch('clientSituations', e.target.value)} />
          </Question>
          <Question id="q12" required label={t('questionnaire.q12')} hint={t('questionnaire.q12Hint')} error={errors.paidStatus}>
            <PersonaQuestionnaireSingleSelect
              value={form.paidStatus}
              placeholder={t('questionnaire.selectPlaceholder')}
              aria-label={t('questionnaire.q12')}
              options={(['yes', 'none', 'unsure'] as PaidClientStatus[]).map((value) => ({
                value,
                label: t(`questionnaire.paid.${value}`),
              }))}
              onChange={(value) => patch('paidStatus', value)}
            />
          </Question>
          <Question id="q13" required label={t('questionnaire.q13')} hint={t('questionnaire.q13Hint')} error={errors.products}>
            <PersonaQuestionnaireField
              inputId="q13"
              field="products"
              label={t('questionnaire.q13')}
              value={form.products}
              form={form}
              multiline
              rows={4}
              disabled={submitBusy}
              onChange={(value) => patch('products', value)}
            />
            {uploader('products', t('questionnaire.uploadProducts'))}
          </Question>
          <Question id="q14" required label={t('questionnaire.q14')} hint={t('questionnaire.q14Hint')} error={errors.delivery}>
            <PersonaQuestionnaireField
              inputId="q14"
              field="delivery"
              label={t('questionnaire.q14')}
              value={form.delivery}
              form={form}
              multiline
              rows={4}
              disabled={submitBusy}
              onChange={(value) => patch('delivery', value)}
            />
          </Question>
          <Question id="q15" required label={t('questionnaire.q15')} hint={t('questionnaire.q15Hint')} error={errors.accountGoals}>
            <PersonaQuestionnaireMultiSelect
              values={form.accountGoals}
              placeholder={t('questionnaire.multiSelectPlaceholder')}
              aria-label={t('questionnaire.q15')}
              options={ACCOUNT_GOAL_IDS.map((id) => ({
                value: id,
                label: t(`questionnaire.goal.${id}`),
              }))}
              onToggle={toggleGoal}
              disabled={submitBusy}
            />
          </Question>
          <OptionalBlock title={t('questionnaire.optionalSection')}>
            <Question id="q12n" label={t('questionnaire.q12')} hint={t('questionnaire.q12Hint')}>
              <Textarea id="q12n" rows={3} value={form.paidNotes} onChange={(e) => patch('paidNotes', e.target.value)} />
            </Question>
            <Question id="q15n" label={t('questionnaire.q15')} hint={t('questionnaire.q15Hint')}>
              <Textarea id="q15n" rows={3} value={form.revenueNotes} onChange={(e) => patch('revenueNotes', e.target.value)} />
            </Question>
          </OptionalBlock>
        </div>
      ) : null}

      {active === 2 ? (
        <div className="persona-q-page">
          <h3>{t('questionnaire.page3Title')}</h3>
          <OptionalBlock title={t('questionnaire.optionalSection')}>
            <Question id="q16" label={t('questionnaire.q16')} hint={t('questionnaire.q16Hint')}>
              <Textarea id="q16" rows={4} value={form.methods} onChange={(e) => patch('methods', e.target.value)} />
            </Question>
            <Question id="q17" label={t('questionnaire.q17')} hint={t('questionnaire.q17Hint')}>
              <Textarea id="q17" rows={4} value={form.competitors} onChange={(e) => patch('competitors', e.target.value)} />
            </Question>
            <Question id="q18" label={t('questionnaire.q18')} hint={t('questionnaire.q18Hint')}>
              <PersonaQuestionnaireField
                inputId="q18"
                field="differentiation"
                label={t('questionnaire.q18')}
                value={form.differentiation}
                form={form}
                multiline
                rows={4}
                disabled={submitBusy}
                onChange={(value) => patch('differentiation', value)}
              />
            </Question>
          </OptionalBlock>
        </div>
      ) : null}

      {active === 3 ? (
        <div className="persona-q-page">
          <h3>{t('questionnaire.page4Title')}</h3>
          <Question id="q19" required label={t('questionnaire.q19')} hint={t('questionnaire.q19Hint')} error={errors.platforms}>
            <PersonaQuestionnaireField
              inputId="q19"
              field="platforms"
              label={t('questionnaire.q19')}
              value={form.platforms}
              form={form}
              multiline
              rows={4}
              disabled={submitBusy}
              onChange={(value) => patch('platforms', value)}
            />
          </Question>
          <Question id="q20" required label={t('questionnaire.q20')} hint={t('questionnaire.q20Hint')} error={errors.keyword1 || errors.keyword2 || errors.keyword3}>
            <div className="persona-q-keywords">
              <Input value={form.keyword1} onChange={(e) => patch('keyword1', e.target.value)} aria-label={t('questionnaire.keyword1')} />
              <Input value={form.keyword2} onChange={(e) => patch('keyword2', e.target.value)} aria-label={t('questionnaire.keyword2')} />
              <Input value={form.keyword3} onChange={(e) => patch('keyword3', e.target.value)} aria-label={t('questionnaire.keyword3')} />
            </div>
            <Textarea rows={2} value={form.keywordNotes} onChange={(e) => patch('keywordNotes', e.target.value)} />
          </Question>
          <Question id="q21" required label={t('questionnaire.q21')} hint={t('questionnaire.q21Hint')} error={errors.contentThemes}>
            <PersonaQuestionnaireField
              inputId="q21"
              field="contentThemes"
              label={t('questionnaire.q21')}
              value={form.contentThemes}
              form={form}
              multiline
              rows={4}
              disabled={submitBusy}
              onChange={(value) => patch('contentThemes', value)}
            />
          </Question>
          <Question id="q23" required label={t('questionnaire.q23')} hint={t('questionnaire.q23Hint')} error={errors.personaRedlines}>
            <Textarea id="q23" rows={3} value={form.personaRedlines} onChange={(e) => patch('personaRedlines', e.target.value)} />
          </Question>
          <Question id="q24" required label={t('questionnaire.q24')} hint={t('questionnaire.q24Hint')} error={errors.contentRedlines}>
            <Textarea id="q24" rows={3} value={form.contentRedlines} onChange={(e) => patch('contentRedlines', e.target.value)} />
          </Question>
          <Question id="q25" required label={t('questionnaire.q25')} hint={t('questionnaire.q25Hint')} error={errors.styleRedlines}>
            <Textarea id="q25" rows={3} value={form.styleRedlines} onChange={(e) => patch('styleRedlines', e.target.value)} />
          </Question>
          <OptionalBlock title={t('questionnaire.optionalSection')}>
            <Question id="q22" label={t('questionnaire.q22')} hint={t('questionnaire.q22Hint')}>
              <Textarea id="q22" rows={3} value={form.signatureStory} onChange={(e) => patch('signatureStory', e.target.value)} />
              <PersonaQuestionnaireSingleSelect
                value={form.shareWillingness}
                placeholder={t('questionnaire.selectPlaceholder')}
                aria-label={t('questionnaire.q22')}
                options={(['public', 'private', 'unsure'] as ShareWillingness[]).map((value) => ({
                  value,
                  label: t(`questionnaire.share.${value}`),
                }))}
                onChange={(value) => patch('shareWillingness', value)}
              />
            </Question>
          </OptionalBlock>
        </div>
      ) : null}
    </InputWizard>
  )
}
