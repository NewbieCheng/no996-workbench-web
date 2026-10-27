import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AIEditPopover } from '@no996/ui/ai-edit-popover'
import { Textarea } from '@no996/ui/textarea'
import type { UserProfileFormData } from '../../../services/persona'
import { polishProfileDocField } from '../agent/form-assist'
import {
  formKeyForProfileLabel,
  isParseUsable,
  parseProfileMarkdown,
  updateProfileFieldMarkdown,
} from '../lib/profile-fields'
import { ProfileStructuredDoc } from './ProfileStructuredDoc'

type FieldRevision = { original: string; suggestion: string }

type FieldRef = {
  sectionTitle: string
  fieldLabel: string
}

function fieldId(ref: FieldRef) {
  return `${ref.sectionTitle}::${ref.fieldLabel}`
}

type Props = {
  markdown: string
  formData: UserProfileFormData
  onMarkdownChange: (markdown: string) => void
  onFormFieldChange?: (key: keyof UserProfileFormData, value: string) => void
}

export function ProfileStructuredEditor({ markdown, formData, onMarkdownChange, onFormFieldChange }: Props) {
  const { t } = useTranslation('persona')
  const parsed = useMemo(() => parseProfileMarkdown(markdown), [markdown])
  const structured = isParseUsable(parsed)

  const [revisions, setRevisions] = useState<Record<string, FieldRevision>>({})
  const [polishErrors, setPolishErrors] = useState<Record<string, string>>({})
  const [polishingId, setPolishingId] = useState<string | null>(null)
  const [tuningId, setTuningId] = useState<string | null>(null)
  const [streamingByField, setStreamingByField] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const popoverLabels = useMemo(
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

  const quickPrompts = useMemo(
    () => [
      { label: t('form.tuneConcise'), instruction: t('form.tuneConcise') },
      { label: t('form.tuneSpecific'), instruction: t('form.tuneSpecific') },
      { label: t('form.tuneWarm'), instruction: t('form.tuneWarm') },
    ],
    [t],
  )

  function updateField(ref: FieldRef, nextValue: string) {
    onMarkdownChange(updateProfileFieldMarkdown(markdown, ref.sectionTitle, ref.fieldLabel, nextValue))
    const key = formKeyForProfileLabel(ref.fieldLabel)
    if (key) onFormFieldChange?.(key, nextValue)
    setRevisions((prev) => {
      const id = fieldId(ref)
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function runPolish(ref: FieldRef, value: string, instruction?: string) {
    const id = fieldId(ref)
    setPolishErrors((prev) => ({ ...prev, [id]: undefined }))
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPolishingId(id)
    if (instruction) setTuningId(id)
    setStreamingByField((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    try {
      const original = value
      const next = await polishProfileDocField({
        fieldLabel: ref.fieldLabel,
        value: original,
        form: formData,
        instruction,
        signal: controller.signal,
        onPartial: (text) => setStreamingByField((prev) => ({ ...prev, [id]: text })),
      })
      setRevisions((prev) => ({ ...prev, [id]: { original, suggestion: next } }))
    } catch (e) {
      if (controller.signal.aborted) return
      setPolishErrors((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : t('form.aiAssistError'),
      }))
    } finally {
      setPolishingId(null)
      setTuningId(null)
      setStreamingByField((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  if (!structured || !parsed) {
    return (
      <Textarea
        className="persona-profile-card__raw-editor"
        value={markdown}
        rows={12}
        aria-label={t('preview.generated')}
        onChange={(e) => onMarkdownChange(e.target.value)}
      />
    )
  }

  return (
    <article className="brain-profile-doc brain-profile-doc--editing">
      {parsed.sections.map((section, sectionIdx) => (
        <section
          key={section.title}
          className={`brain-profile-doc__section${sectionIdx === 0 ? ' brain-profile-doc__section--first' : ''}`}
        >
          <h3 className="brain-profile-doc__section-title">{section.title}</h3>
          <div className="brain-profile-doc__fields">
            {section.fields.map((field, idx) => {
              const ref: FieldRef = { sectionTitle: section.title, fieldLabel: field.label }
              const id = fieldId(ref)
              const revision = revisions[id]
              const busy = polishingId === id || tuningId === id
              return (
                <div key={`${field.label}-${idx}`} className="brain-profile-field brain-profile-field--editing">
                  <div className="brain-profile-field__label-row">
                    <span className="brain-profile-field__label">{field.label}</span>
                    <AIEditPopover
                      className="ai-edit-popover--profile brain-profile-field__ai-trigger"
                      popoverClassName="ai-edit-popover--profile-field"
                      popoverSide="bottom"
                      popoverAlign="end"
                      fieldLabel={field.label}
                      value={field.value}
                      result={revision?.suggestion}
                      streamingResult={busy ? streamingByField[id] : undefined}
                      busy={busy}
                      error={polishErrors[id]}
                      quickPrompts={quickPrompts}
                      labels={popoverLabels}
                      onGenerate={(instruction) => void runPolish(ref, field.value, instruction || undefined)}
                      onApply={() => {
                        if (revision) updateField(ref, revision.suggestion)
                      }}
                      onDismiss={() => {
                        setRevisions((prev) => {
                          const next = { ...prev }
                          delete next[id]
                          return next
                        })
                      }}
                    />
                  </div>
                  <Textarea
                    className="brain-profile-field__input"
                    value={field.value}
                    rows={Math.min(6, Math.max(2, Math.ceil(field.value.length / 42)))}
                    aria-label={field.label}
                    onChange={(e) => updateField(ref, e.target.value)}
                  />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </article>
  )
}

// Read-only wrapper keeps export surface small for the card.
export function ProfileStructuredPanel({
  editing,
  markdown,
  formData,
  onMarkdownChange,
  onFormFieldChange,
}: {
  editing: boolean
  markdown: string
  formData: UserProfileFormData
  onMarkdownChange?: (markdown: string) => void
  onFormFieldChange?: (key: keyof UserProfileFormData, value: string) => void
}) {
  if (!editing || !onMarkdownChange) {
    return <ProfileStructuredDoc markdown={markdown} />
  }
  return (
    <ProfileStructuredEditor
      markdown={markdown}
      formData={formData}
      onMarkdownChange={onMarkdownChange}
      onFormFieldChange={onFormFieldChange}
    />
  )
}
