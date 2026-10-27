import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@no996/ui/card'
import {
  PACKAGING_IDS,
  PACKAGING_LABELS,
  POSITIONING_IDS,
  POSITIONING_LABELS,
  fieldValue,
  parseAccountCard,
  parseMainProfile,
} from '../lib/account-card'
import {
  REQUIRED_QUESTIONNAIRE_KEYS,
  projectLegacyUserForm,
} from '../../../services/persona/questionnaire'
import type { PersonaQuestionnaire } from '../../../services/persona'
import type { PackagingId, PositioningId } from '../../../services/persona/types'
import { PersonaProfileCard } from './PersonaProfileCard'
import { ProfileStreamingPanel } from './ProfileStreamingPanel'
import { QUESTIONNAIRE_STEPS } from './PersonaQuestionnaireView'

export type PersonaWorkPhase = 'questionnaire' | 'generating' | 'select' | 'profile'

type Props = {
  phase: PersonaWorkPhase
  questionnaire: PersonaQuestionnaire
  questionnaireStep?: number
  isDefault: boolean
  saving?: boolean
  generating?: boolean
  livePartialMarkdown?: string
  candidatesMarkdown?: string
  profileMarkdown?: string
  selectedPositioning?: PositioningId
  selectedPackaging?: PackagingId
  collapseDisabled?: boolean
  onToggleCollapse?: () => void
  onSetDefault?: () => void
}

function questionnaireProgress(form: PersonaQuestionnaire): { filled: number; total: number } {
  const total = REQUIRED_QUESTIONNAIRE_KEYS.length
  let filled = 0
  for (const key of REQUIRED_QUESTIONNAIRE_KEYS) {
    if (key === 'accountGoals') {
      if (form.accountGoals.length > 0) filled += 1
      continue
    }
    const value = form[key]
    if (typeof value === 'string' && value.trim()) filled += 1
  }
  return { filled, total }
}

function SelectPreview({
  markdown,
  positioning,
  packaging,
}: {
  markdown: string
  positioning?: PositioningId
  packaging?: PackagingId
}) {
  const { t } = useTranslation('persona')
  const parsed = useMemo(() => parseAccountCard(markdown), [markdown])

  if (!parsed) {
    return (
      <Card className="persona-workspace-preview-card">
        <CardHeader>
          <CardTitle>{t('select.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileStreamingPanel kind="user" partialMarkdown={markdown} generating={!parsed} />
        </CardContent>
      </Card>
    )
  }

  const posId = positioning
  const packId = packaging

  return (
    <Card className="persona-workspace-preview-card">
      <CardHeader>
        <CardTitle>{t('preview.accountCardTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="persona-workspace-preview-card__body">
        <p className="persona-workspace-preview-card__lead">{t('select.lead')}</p>
        <dl className="persona-workspace-preview-card__plans">
          {POSITIONING_IDS.map((id) => (
            <div
              key={id}
              className={`persona-workspace-preview-card__plan${posId === id ? ' is-active' : ''}`}
            >
              <dt>{t('select.plan', { id })} · {POSITIONING_LABELS[id]}</dt>
              <dd>{fieldValue(parsed.positioning[id], '一句话专业定位')}</dd>
            </div>
          ))}
        </dl>
        <dl className="persona-workspace-preview-card__plans">
          {PACKAGING_IDS.map((id) => (
            <div
              key={id}
              className={`persona-workspace-preview-card__plan${packId === id ? ' is-active' : ''}`}
            >
              <dt>{PACKAGING_LABELS[id]}</dt>
              <dd>{fieldValue(parsed.packaging[id], '账号简介')}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

function MainProfilePreview({ markdown }: { markdown: string }) {
  const { t } = useTranslation('persona')
  const parsed = useMemo(() => parseMainProfile(markdown), [markdown])

  if (!parsed && markdown.trim()) {
    return <Card className="persona-workspace-preview-card"><CardHeader><CardTitle>{t('legacyProfileTitle')}</CardTitle></CardHeader><CardContent><p>{t('legacyProfileDescription')}</p></CardContent></Card>
  }
  if (!parsed) {
    return <p className="persona-profile-empty">{t('recordsNoContent')}</p>
  }

  const positioningId = parsed.positioningId
  const packagingId = parsed.packagingId

  return (
    <Card className="persona-workspace-preview-card">
      <CardHeader>
        <CardTitle>{t('profile.title')}</CardTitle>
      </CardHeader>
      <CardContent className="persona-workspace-preview-card__body">
        <p className="persona-workspace-preview-card__lead">
          {positioningId
            ? `${t('select.plan', { id: positioningId })} · ${fieldValue(parsed.positioning, '一句话专业定位')}`
            : '—'}
        </p>
        <p className="persona-workspace-preview-card__meta">
          {packagingId ? PACKAGING_LABELS[packagingId as PackagingId] : '—'}
        </p>
        <ul className="persona-workspace-preview-card__modules">
          <li>{t('select.advantages')}</li>
          <li>{t('select.audience')}</li>
          <li>{parsed.positioning.title}</li>
          <li>{parsed.packaging.title}</li>
          <li>{t('select.redlines')}</li>
        </ul>
      </CardContent>
    </Card>
  )
}

export function PersonaWorkspacePreview({
  phase,
  questionnaire,
  questionnaireStep = 0,
  isDefault,
  saving,
  generating = false,
  livePartialMarkdown = '',
  candidatesMarkdown = '',
  profileMarkdown = '',
  selectedPositioning,
  selectedPackaging,
  collapseDisabled,
  onToggleCollapse,
  onSetDefault,
}: Props) {
  const { t } = useTranslation('persona')
  const legacyForm = useMemo(() => projectLegacyUserForm(questionnaire), [questionnaire])
  const progress = useMemo(() => questionnaireProgress(questionnaire), [questionnaire])
  const stepLabel = QUESTIONNAIRE_STEPS[Math.min(questionnaireStep, QUESTIONNAIRE_STEPS.length - 1)]

  if (phase === 'generating') {
    return (
      <PersonaProfileCard
        formData={legacyForm}
        markdown={candidatesMarkdown}
        isDefault={isDefault}
        saving={saving}
        generating={generating}
        livePartialMarkdown={livePartialMarkdown}
        progressMetrics={progress}
        summaryTitle={questionnaire.publicName.trim() || questionnaire.occupation.trim()}
        summaryTag={questionnaire.occupation.trim()}
        stepHint={stepLabel ? t(stepLabel.labelKey) : undefined}
        collapseDisabled={collapseDisabled}
        onTogglePreview={onToggleCollapse}
        onSetDefault={onSetDefault}
      />
    )
  }

  if (phase === 'select' && candidatesMarkdown.trim()) {
    return (
      <SelectPreview
        markdown={candidatesMarkdown}
        positioning={selectedPositioning}
        packaging={selectedPackaging}
      />
    )
  }

  if (phase === 'profile' && profileMarkdown.trim()) {
    return <MainProfilePreview markdown={profileMarkdown} />
  }

  return (
    <PersonaProfileCard
      formData={legacyForm}
      markdown={profileMarkdown}
      isDefault={isDefault}
      saving={saving}
      generating={generating}
      livePartialMarkdown={livePartialMarkdown}
      progressMetrics={progress}
      summaryTitle={questionnaire.publicName.trim() || legacyForm.role.trim()}
      summaryTag={questionnaire.occupation.trim() || legacyForm.industry.trim()}
      stepHint={stepLabel ? t(stepLabel.labelKey) : undefined}
      collapseDisabled={collapseDisabled}
      onTogglePreview={onToggleCollapse}
      onSetDefault={onSetDefault}
    />
  )
}
