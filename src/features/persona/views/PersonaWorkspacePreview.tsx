import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@no996/ui/card'
import { Button } from '@no996/ui/button'
import {
  ListOrderedIcon,
  PanelLeftCloseIcon,
} from 'lucide-react'
import {
  PACKAGING_IDS,
  PACKAGING_LABELS,
  POSITIONING_IDS,
  POSITIONING_LABELS,
  fieldValue,
  parseAccountCard,
  parseMainProfile,
  type AccountCardModuleId,
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
          <CardTitle>{t('select.title', { defaultValue: '定位方案与包装' })}</CardTitle>
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
        <CardTitle>{t('preview.accountCardTitle', { defaultValue: '候选方案对比' })}</CardTitle>
      </CardHeader>
      <CardContent className="persona-workspace-preview-card__body">
        <p className="persona-workspace-preview-card__lead">{t('select.lead', { defaultValue: '已生成 3 组定位方案与包装建议' })}</p>
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

const TOC_MODULES: Array<{ id: AccountCardModuleId; num: string; label: string }> = [
  { id: 'advantages', num: '01', label: '人物优势' },
  { id: 'audience', num: '02', label: '目标人群与需求' },
  { id: 'positioning', num: '03', label: '人设定位方案' },
  { id: 'packaging', num: '04', label: '账号包装建议' },
  { id: 'redlines', num: '05', label: '表达红线规范' },
]

/** 档案模式下的专属左侧目录导航锚点轨 */
function MainProfileTocNav({
  markdown,
  onToggleCollapse,
  collapseDisabled,
}: {
  markdown: string
  onToggleCollapse?: () => void
  collapseDisabled?: boolean
}) {
  const { t } = useTranslation('persona')
  const parsed = useMemo(() => parseMainProfile(markdown), [markdown])
  const [activeSection, setActiveSection] = useState<string>('advantages')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('persona-module-', '')
            if (id) setActiveSection(id)
          }
        }
      },
      { rootMargin: '-10% 0px -70% 0px' },
    )

    for (const item of TOC_MODULES) {
      const el = document.getElementById(`persona-module-${item.id}`)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [markdown])

  function scrollToSection(id: string) {
    const el = document.getElementById(`persona-module-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(id)
    }
  }

  const positioningId = parsed?.positioningId
  const packagingId = parsed?.packagingId

  return (
    <Card className="persona-toc-nav-card">
      <CardHeader className="persona-toc-nav-card__head">
        <div className="persona-toc-nav-card__title-row">
          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
            <ListOrderedIcon className="w-4 h-4 text-primary" />
            <span>档案目录导航</span>
          </div>
          {onToggleCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={collapseDisabled}
              aria-label={t('preview.collapse', { defaultValue: '收起侧边栏' })}
              onClick={onToggleCollapse}
              className="persona-toc-nav-card__collapse"
            >
              <PanelLeftCloseIcon className="w-4 h-4 text-muted-foreground" />
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          点击章节快速跳转定位并查阅或编辑详情
        </p>
      </CardHeader>

      <CardContent className="persona-toc-nav-card__body">
        {/* 核心定位与包装微概览 */}
        {(positioningId || packagingId) && (
          <div className="persona-toc-overview">
            {positioningId && (
              <div className="persona-toc-overview__item">
                <span className="persona-toc-overview__label">主方案</span>
                <span className="persona-toc-overview__val">
                  方案 {positioningId} · {POSITIONING_LABELS[positioningId as PositioningId]}
                </span>
              </div>
            )}
            {packagingId && (
              <div className="persona-toc-overview__item">
                <span className="persona-toc-overview__label">主包装</span>
                <span className="persona-toc-overview__val">
                  {PACKAGING_LABELS[packagingId as PackagingId]}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 锚点导航列表 */}
        <nav className="persona-toc-list" aria-label="人设文档目录">
          {TOC_MODULES.map((item) => {
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`persona-toc-item${isActive ? ' is-active' : ''}`}
                onClick={() => scrollToSection(item.id)}
              >
                <span className="persona-toc-item__num">{item.num}</span>
                <span className="persona-toc-item__label">{item.label}</span>
              </button>
            )
          })}
        </nav>
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
    return (
      <MainProfileTocNav
        markdown={profileMarkdown}
        onToggleCollapse={onToggleCollapse}
        collapseDisabled={collapseDisabled}
      />
    )
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
