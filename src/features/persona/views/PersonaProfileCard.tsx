import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@no996/ui/badge'
import { Button } from '@no996/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@no996/ui/card'
import { ScrollArea } from '@no996/ui/scroll-area'
import { ChevronDownIcon, EyeIcon, PanelLeftCloseIcon, PencilIcon } from 'lucide-react'
import type { QuestionnairePreviewField, UserProfileFormData } from '../../../services/persona'
import { ProfileStructuredPanel } from './ProfileStructuredEditor'
import { ProfileStreamingPanel } from './ProfileStreamingPanel'

type ProfileContentMode = 'edit' | 'preview'

type Props = {
  formData: UserProfileFormData
  /** 左侧字段列表；不传时回退到简易 7 字段 */
  previewFields?: QuestionnairePreviewField[]
  markdown?: string
  isDefault: boolean
  saving?: boolean
  generating?: boolean
  livePartialMarkdown?: string
  progressMetrics?: { filled: number; total: number }
  summaryTitle?: string
  summaryTag?: string
  stepHint?: string
  /** 仅在「查看档案」、创作区收起时允许档案内编辑/预览切换 */
  archiveEditEnabled?: boolean
  onSetDefault?: () => void
  onTogglePreview?: () => void
  collapseDisabled?: boolean
  onSaveProfile?: (markdown: string) => Promise<void>
  onFormFieldChange?: (key: keyof UserProfileFormData, value: string) => void
}

export function PersonaProfileCard({
  formData,
  previewFields,
  markdown = '',
  isDefault,
  saving = false,
  generating = false,
  livePartialMarkdown = '',
  progressMetrics,
  summaryTitle,
  summaryTag,
  stepHint,
  archiveEditEnabled = false,
  onSetDefault,
  onTogglePreview,
  collapseDisabled = false,
  onSaveProfile,
  onFormFieldChange,
}: Props) {
  const { t } = useTranslation('persona')
  const [contentMode, setContentMode] = useState<ProfileContentMode>('edit')
  const [draftMarkdown, setDraftMarkdown] = useState(markdown)

  useEffect(() => {
    setDraftMarkdown(markdown)
  }, [markdown])

  useEffect(() => {
    setContentMode('preview')
  }, [archiveEditEnabled, markdown])

  const fields = useMemo((): QuestionnairePreviewField[] => {
    if (previewFields) return previewFields
    return [
      { id: 'industry', label: t('preview.industry'), value: formData.industry },
      { id: 'role', label: t('preview.role'), value: formData.role },
      { id: 'primaryBusiness', label: t('preview.primaryBusiness'), value: formData.primaryBusiness },
      { id: 'targetClients', label: t('preview.targetClients'), value: formData.targetClients ?? '' },
      { id: 'clientPainPoints', label: t('preview.clientPainPoints'), value: formData.clientPainPoints ?? '' },
      { id: 'desiredImage', label: t('preview.desiredImage'), value: formData.desiredImage ?? '' },
      { id: 'additionalInfo', label: t('preview.additionalInfo'), value: formData.additionalInfo ?? '' },
    ]
  }, [formData, previewFields, t])
  const filled = progressMetrics?.filled ?? fields.filter((field) => Boolean(field.value?.trim())).length
  const progressTotal = progressMetrics?.total ?? fields.length
  const progressLabel = t('preview.progress', { filled, total: progressTotal })
  const displayRole = summaryTitle?.trim() || formData.role.trim() || t('preview.rolePlaceholder')
  const displayIndustry = summaryTag?.trim() || formData.industry.trim() || t('preview.industryPlaceholder')
  const editing = archiveEditEnabled && contentMode === 'edit'
  const displayMarkdown = archiveEditEnabled ? draftMarkdown : markdown

  async function saveEdit() {
    if (!onSaveProfile) return
    await onSaveProfile(draftMarkdown)
    setContentMode('preview')
  }

  function toggleContentMode() {
    setContentMode((mode) => (mode === 'edit' ? 'preview' : 'edit'))
  }

  return (
    <Card className="persona-profile-card">
      <CardHeader className="persona-profile-card__header">
        <div className="persona-profile-card__eyebrow">
          {onTogglePreview ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="persona-profile-card__collapse"
              disabled={collapseDisabled}
              aria-label={t('preview.collapse')}
              onClick={onTogglePreview}
            >
              <PanelLeftCloseIcon aria-hidden="true" />
            </Button>
          ) : null}
          <span className="persona-profile-card__heading">{t('preview.title')}</span>
          <div className="persona-profile-card__header-actions">
            {isDefault ? <Badge variant="secondary">{t('preview.defaultBadge')}</Badge> : null}
            {archiveEditEnabled && !generating && markdown.trim() ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={contentMode === 'edit'}
                onClick={toggleContentMode}
              >
                {contentMode === 'edit' ? (
                  <>
                    <EyeIcon aria-hidden="true" />
                    {t('preview.viewMode')}
                  </>
                ) : (
                  <>
                    <PencilIcon aria-hidden="true" />
                    {t('preview.editProfile')}
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <ScrollArea className="persona-profile-card__scroll-area">
        <CardContent className="persona-profile-card__content">
        {isDefault ? (
          <details className="persona-profile-card__summary" open>
            <summary
              className="persona-profile-card__summary-toggle"
              aria-label={progressLabel}
            >
              <div className="persona-profile-card__summary-leading">
                <p className="persona-profile-card__summary-title">
                  <strong>{displayRole}</strong>
                </p>
                <div className="persona-profile-card__summary-meta">
                  <span className="persona-profile-card__summary-tag">
                    {displayIndustry}
                  </span>
                  <span className="persona-profile-card__summary-divider" aria-hidden="true" />
                  <span
                    className="persona-profile-card__summary-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progressTotal}
                    aria-valuenow={filled}
                  >
                    {progressLabel}
                  </span>
                </div>
              </div>
              <span className="persona-profile-card__summary-chevron-wrap">
                <ChevronDownIcon className="persona-profile-card__summary-chevron" aria-hidden="true" />
              </span>
            </summary>
            <div className="persona-profile-card__summary-panel">
              <div className="persona-profile-card__summary-panel-inner">
                <p className="persona-profile-card__default-hint">{t('preview.defaultUsage')}</p>
              </div>
            </div>
          </details>
        ) : (
          <div
            className="persona-profile-card__summary persona-profile-card__summary--static"
            role="group"
            aria-label={progressLabel}
          >
            <div className="persona-profile-card__summary-leading">
              <p className="persona-profile-card__summary-title">
                <strong>{displayRole}</strong>
              </p>
              <div className="persona-profile-card__summary-meta">
                <span className="persona-profile-card__summary-tag">
                  {displayIndustry}
                </span>
                <span className="persona-profile-card__summary-divider" aria-hidden="true" />
                <span
                  className="persona-profile-card__summary-progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progressTotal}
                  aria-valuenow={filled}
                >
                  {progressLabel}
                </span>
              </div>
            </div>
          </div>
        )}

        {stepHint ? (
          <p className="persona-profile-card__step-hint">{t('preview.stepHint', { step: stepHint })}</p>
        ) : null}

        {generating ? (
          <div className="persona-profile-card__output">
            <div className="persona-profile-card__output-head">
              <div className="persona-profile-card__output-label">{t('preview.generated')}</div>
            </div>
            <ProfileStreamingPanel
              kind="user"
              partialMarkdown={livePartialMarkdown}
              generating={generating}
            />
          </div>
        ) : displayMarkdown.trim() ? (
          <div className="persona-profile-card__output">
            <div className="persona-profile-card__output-label">{t('preview.generated')}</div>
            <ProfileStructuredPanel
              editing={editing}
              markdown={displayMarkdown}
              formData={formData}
              onMarkdownChange={editing ? setDraftMarkdown : undefined}
              onFormFieldChange={editing ? onFormFieldChange : undefined}
            />
          </div>
        ) : (
          <dl className="persona-profile-card__fields">
            {fields.map((field) => (
              <div key={field.id} className="persona-profile-card__field">
                <dt>{field.label}</dt>
                <dd>{field.value?.trim() || <span>{t('preview.waiting')}</span>}</dd>
              </div>
            ))}
          </dl>
        )}
        </CardContent>
      </ScrollArea>
      {!generating && ((editing && onSaveProfile) || onSetDefault) ? (
        <CardFooter className="persona-profile-card__footer">
          {editing && onSaveProfile ? (
            <Button type="button" size="sm" disabled={saving} onClick={() => void saveEdit()}>
              {saving ? t('preview.savingProfile') : t('preview.saveProfile')}
            </Button>
          ) : !isDefault && onSetDefault ? (
            <Button type="button" variant="outline" size="sm" onClick={onSetDefault}>
              {t('recordsSetDefault')}
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}
