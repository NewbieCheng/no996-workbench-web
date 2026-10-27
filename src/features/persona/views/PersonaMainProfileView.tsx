import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@no996/ui/badge'
import { Button } from '@no996/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@no996/ui/card'
import { Textarea } from '@no996/ui/textarea'
import {
  PACKAGING_LABELS,
  POSITIONING_LABELS,
  fieldValue,
  moduleFields,
  parseMainProfile,
  patchMainProfileModule,
  type AccountCardModuleId,
} from '../lib/account-card'
import type { PackagingId, PositioningId } from '../../../services/persona/types'

type Props = {
  markdown: string
  isDefault: boolean
  lastSavedAt?: string
  usedMock?: boolean
  saving?: boolean
  onSaveModule: (markdown: string) => Promise<void>
  onChangeCombo?: () => void
  onEditQuestionnaire?: () => void
  onSetDefault?: () => void
  legacyContent?: string
}

const MODULES: AccountCardModuleId[] = ['advantages', 'audience', 'positioning', 'packaging', 'redlines']

function downloadMarkdown(markdown: string, name: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name || 'persona-profile'}.md`
  link.click()
  URL.revokeObjectURL(url)
}

export function PersonaMainProfileView({
  markdown,
  isDefault,
  lastSavedAt,
  usedMock,
  saving,
  onSaveModule,
  onChangeCombo,
  onEditQuestionnaire,
  onSetDefault,
  legacyContent,
}: Props) {
  const { t } = useTranslation('persona')
  const parsed = useMemo(() => parseMainProfile(markdown), [markdown])
  const [editing, setEditing] = useState<AccountCardModuleId | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [editingLegacy, setEditingLegacy] = useState(false)
  const [legacyDraft, setLegacyDraft] = useState('')

  const positioningId = parsed?.positioningId
  const packagingId = parsed?.packagingId

  function beginEdit(id: AccountCardModuleId) {
    const block = parsed?.[id]
    const next: Record<string, string> = {}
    for (const label of moduleFields(id)) {
      next[label] = fieldValue(block, label)
    }
    setDraft(next)
    setEditing(id)
  }

  async function saveEdit() {
    if (!editing) return
    const fields = moduleFields(editing).map((label) => ({
      label,
      value: (draft[label] ?? '').trim() || '待补充',
    }))
    const next = patchMainProfileModule(markdown, editing, fields)
    try {
      await onSaveModule(next)
      setEditing(null)
    } catch {
      // The page displays the save error; keep the draft available for retry.
    }
  }

  async function copyAll() {
    await navigator.clipboard.writeText(markdown)
  }

  if (!parsed && markdown.trim()) {
    return (
      <article className="persona-main-profile">
        <header className="persona-main-profile__head">
          <div><h2>{t('legacyProfileTitle')}</h2><p>{t('legacyProfileDescription')}</p></div>
          <div className="persona-main-profile__status">
            <Badge variant="secondary">{t('profile.saved')}</Badge>
            {isDefault ? <Badge>{t('preview.defaultBadge')}</Badge> : null}
          </div>
        </header>
        <div className="persona-main-profile__actions">
          <Button type="button" variant="outline" onClick={() => void copyAll()}>{t('profile.copy')}</Button>
          <Button type="button" variant="outline" onClick={() => downloadMarkdown(markdown, t('profile.exportName'))}>{t('profile.export')}</Button>
          {onSetDefault && !isDefault ? <Button type="button" variant="outline" onClick={onSetDefault}>{t('recordsSetDefault')}</Button> : null}
          {onEditQuestionnaire && !editingLegacy ? <Button type="button" variant="ghost" disabled={editing !== null || saving} onClick={onEditQuestionnaire}>{t('select.editQuestionnaire')}</Button> : null}
          {!editingLegacy ? <Button type="button" variant="outline" onClick={() => { setLegacyDraft(markdown); setEditingLegacy(true) }}>{t('preview.editProfile')}</Button> : null}
        </div>
        {editingLegacy ? (
          <div>
            <Textarea rows={18} value={legacyDraft} onChange={(event) => setLegacyDraft(event.target.value)} aria-label={t('preview.generated')} />
            <div className="persona-main-module__edit-actions">
              <Button type="button" variant="outline" onClick={() => setEditingLegacy(false)}>{t('cancel')}</Button>
              <Button type="button" disabled={saving} onClick={() => void onSaveModule(legacyDraft).then(() => setEditingLegacy(false)).catch(() => {})}>{saving ? t('profile.saving') : t('profile.saveModule')}</Button>
            </div>
          </div>
        ) : <pre className="prompt-preview brain-profile-doc" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{markdown}</pre>}
      </article>
    )
  }
  if (!parsed) return <p className="persona-profile-empty">{t('recordsNoContent')}</p>

  return (
    <article className="persona-main-profile">
      <header className="persona-main-profile__head">
        <div>
          <h2>{t('profile.title')}</h2>
          <p>
            {t('profile.mainPositioning', {
              plan: positioningId ? `方案 ${positioningId}｜${POSITIONING_LABELS[positioningId as PositioningId]}` : '—',
            })}
            <span aria-hidden="true"> · </span>
            {t('profile.mainPackaging', {
              style: packagingId ? PACKAGING_LABELS[packagingId as PackagingId] : '—',
            })}
          </p>
        </div>
        <div className="persona-main-profile__status">
          <Badge variant="secondary">{t('profile.saved')}</Badge>
          {isDefault ? <Badge>{t('preview.defaultBadge')}</Badge> : null}
          {usedMock ? <Badge variant="outline">{t('profile.demo')}</Badge> : null}
        </div>
      </header>

      <div className="persona-main-profile__actions">
        <Button type="button" variant="outline" onClick={() => void copyAll()}>
          {t('profile.copy')}
        </Button>
        <Button type="button" variant="outline" onClick={() => downloadMarkdown(markdown, t('profile.exportName'))}>
          {t('profile.export')}
        </Button>
        {onSetDefault && !isDefault ? (
          <Button type="button" variant="outline" onClick={onSetDefault}>
            {t('recordsSetDefault')}
          </Button>
        ) : null}
        {onEditQuestionnaire ? (
          <Button type="button" variant="ghost" disabled={editing !== null || saving} onClick={onEditQuestionnaire}>
            {t('select.editQuestionnaire')}
          </Button>
        ) : null}
      </div>

      {MODULES.map((id) => {
        const block = parsed[id]
        const title =
          id === 'advantages'
            ? t('select.advantages')
            : id === 'audience'
              ? t('select.audience')
              : id === 'positioning'
                ? block.title
                : id === 'packaging'
                  ? block.title
                  : t('select.redlines')
        const isEditing = editing === id
        return (
          <Card key={id} className="persona-main-module">
            <CardHeader className="persona-main-module__head">
              <CardTitle>{title}</CardTitle>
              {isEditing ? (
                <span>{t('profile.editing')}</span>
              ) : (
                <Button type="button" variant="ghost" size="sm" disabled={editing !== null || saving} onClick={() => beginEdit(id)}>
                  {t('profile.editModule')}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="persona-main-module__edit">
                  {moduleFields(id).map((label) => (
                    <label key={label}>
                      <span>{label}</span>
                      <Textarea
                        rows={3}
                        value={draft[label] ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...prev, [label]: e.target.value }))}
                      />
                    </label>
                  ))}
                  <div className="persona-main-module__edit-actions">
                    <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>
                      {t('cancel')}
                    </Button>
                    <Button type="button" disabled={saving} onClick={() => void saveEdit()}>
                      {saving ? t('profile.saving') : t('profile.saveModule')}
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="persona-select-fields">
                  {[...moduleFields(id).map((label) => ({ label, value: fieldValue(block, label) })), ...block.fields.filter((field) => !moduleFields(id).some((label) => label === field.label))].map((field) => (
                    <div key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>{field.value || t('profile.pending', { defaultValue: '待补充' })}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        )
      })}

      {legacyContent && (
        <div className="persona-main-module">
          <p>{t('legacyMigrationNotice')}</p>
          <details>
            <summary>{t('legacyOriginal')}</summary>
            <Button type="button" variant="outline" onClick={() => downloadMarkdown(legacyContent, 'original-persona-profile')}>{t('profile.export')}</Button>
            <pre className="prompt-preview brain-profile-doc" style={{ whiteSpace: 'pre-wrap' }}>{legacyContent}</pre>
          </details>
        </div>
      )}
      <footer className="persona-main-profile__foot">
        <span>
          {t('profile.lastSaved')}: {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : '—'}
        </span>
        {onChangeCombo && <Button type="button" variant="outline" disabled={editing !== null || saving} onClick={onChangeCombo}>
          {t('profile.changeCombo')}
        </Button>}
      </footer>
    </article>
  )
}
