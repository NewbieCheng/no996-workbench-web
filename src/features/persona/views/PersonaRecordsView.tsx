import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@no996/ui/badge'
import { Button } from '@no996/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@no996/ui/card'
import { DataTable, type DataColumn } from '@no996/ui/data-table'
import { IconActionButton } from '@no996/ui/IconActionButton'
import { Input } from '@no996/ui/input'
import { CheckIcon, EyeIcon, PencilIcon, StarIcon, XIcon } from 'lucide-react'
import { PACKAGING_LABELS } from '../lib/account-card'
import { normalizeQuestionnaire } from '../../../services/persona/questionnaire'
import type { PersonaRecord } from '../../../services/persona'
import type { PersonaRecordsLayout } from './PersonaRecordsToolbar'

type Props = {
  records: PersonaRecord[]
  layout: PersonaRecordsLayout
  loading?: boolean
  onOpen: (record: PersonaRecord) => void
  onSetDefault: (record: PersonaRecord) => void
  onCreate: () => void
  onRename: (record: PersonaRecord, name: string) => Promise<void>
}

function displaySummary(record: PersonaRecord, fallback: string): string {
  const summary = record.summary?.trim()
  if (summary && !/^user\s+profile$/i.test(summary)) return summary
  const form = normalizeQuestionnaire(record.formData)
  return form.role.trim() || form.industry.trim() || fallback
}

function displayName(record: PersonaRecord): string {
  const q = normalizeQuestionnaire(record.formData)
  return q.publicName.trim() || record.name
}

export function PersonaRecordsView({
  records,
  layout,
  loading = false,
  onOpen,
  onSetDefault,
  onCreate,
  onRename,
}: Props) {
  const { t } = useTranslation('persona')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [savingName, setSavingName] = useState(false)

  function beginRename(record: PersonaRecord) {
    setEditingId(record.id)
    setDraftName(record.name)
    setRenameError('')
  }

  async function saveName(record: PersonaRecord) {
    const name = draftName.trim()
    if (!name) {
      setRenameError(t('recordsNameRequired'))
      return
    }
    setSavingName(true)
    setRenameError('')
    try {
      await onRename(record, name)
      setEditingId(null)
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : t('recordsRenameFailed'))
    } finally {
      setSavingName(false)
    }
  }

  function renderRecordActions(record: PersonaRecord) {
    const editing = editingId === record.id
    if (editing) {
      return (
        <div className="flex gap-1">
          <IconActionButton
            icon={<CheckIcon className="size-3.5" />}
            label={t('recordsSaveName')}
            variant="primary"
            disabled={savingName}
            onClick={() => void saveName(record)}
          />
          <IconActionButton
            icon={<XIcon className="size-3.5" />}
            label={t('cancel')}
            disabled={savingName}
            onClick={() => {
              setEditingId(null)
              setRenameError('')
            }}
          />
        </div>
      )
    }
    return (
      <div className="flex gap-1">
        <IconActionButton
          icon={<EyeIcon className="size-3.5" />}
          label={t('recordsOpen')}
          onClick={() => onOpen(record)}
        />
        {!record.isActive ? (
          <IconActionButton
            icon={<StarIcon className="size-3.5" />}
            label={t('recordsSetDefault')}
            variant="primary"
            onClick={() => onSetDefault(record)}
          />
        ) : null}
        <IconActionButton
          icon={<PencilIcon className="size-3.5" />}
          label={t('recordsRename')}
          onClick={() => beginRename(record)}
        />
      </div>
    )
  }

  const columns = useMemo((): DataColumn<PersonaRecord>[] => {
    return [
      {
        title: t('recordsColUpdated'),
        dataIndex: 'updatedAt',
        width: 120,
        sortable: true,
        render: (value) => new Date(String(value)).toLocaleDateString(),
      },
      {
        title: t('recordsColName'),
        dataIndex: 'name',
        ellipsis: true,
        sortable: true,
        render: (_, record) => {
          if (editingId === record.id) {
            return (
              <div className="persona-records__name-edit">
                <Input
                  autoFocus
                  value={draftName}
                  aria-label={t('recordsRenameAria')}
                  disabled={savingName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void saveName(record)
                    } else if (e.key === 'Escape') {
                      setEditingId(null)
                      setRenameError('')
                    }
                  }}
                />
                {renameError ? (
                  <p className="persona-records__rename-error" role="alert">{renameError}</p>
                ) : null}
              </div>
            )
          }
          return (
            <span className="persona-records__name-cell">
              <span className="truncate">{record.name}</span>
              {record.isActive ? (
                <Badge variant="secondary" className="shrink-0">{t('recordsDefault')}</Badge>
              ) : null}
            </span>
          )
        },
      },
      {
        title: t('recordsColPositioning'),
        key: 'summary',
        width: 220,
        ellipsis: true,
        render: (_, record) => displaySummary(record, t('recordsNoSummary')),
      },
      {
        title: t('recordsColPackaging'),
        key: 'packaging',
        width: 120,
        ellipsis: true,
        render: (_, record) =>
          record.selectedPackaging ? PACKAGING_LABELS[record.selectedPackaging] : '—',
      },
      {
        title: t('recordsColActions'),
        key: 'actions',
        isActions: true,
        width: 132,
        render: (_, record) => renderRecordActions(record),
      },
    ]
  }, [draftName, editingId, onOpen, onSetDefault, renameError, savingName, t])

  const renderRecordCard = (record: PersonaRecord) => {
    const editing = editingId === record.id

    return (
      <Card key={record.id} className="persona-record-card">
        <CardHeader className="persona-record-card__header">
          <div className="persona-record-card__badges">
            {record.isActive ? <Badge>{t('recordsDefault')}</Badge> : null}
            <span>{new Date(record.updatedAt).toLocaleDateString()}</span>
          </div>
          <div className="persona-record-card__title-row">
            {editing ? (
              <Input
                autoFocus
                value={draftName}
                aria-label={t('recordsRenameAria')}
                disabled={savingName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void saveName(record)
                  } else if (e.key === 'Escape') {
                    setEditingId(null)
                    setRenameError('')
                  }
                }}
              />
            ) : (
              <CardTitle>{displayName(record)}</CardTitle>
            )}
            <div className="persona-record-card__header-actions">{renderRecordActions(record)}</div>
          </div>
          {editing && renameError ? (
            <p className="persona-record-card__rename-actions" role="alert">{renameError}</p>
          ) : null}
        </CardHeader>
        <CardContent className="persona-record-card__content">
          <div><span>{t('recordsColPositioning')}</span><strong>{displaySummary(record, t('recordsNoSummary'))}</strong></div>
          <div>
            <span>{t('recordsColPackaging')}</span>
            <strong>{record.selectedPackaging ? PACKAGING_LABELS[record.selectedPackaging] : '—'}</strong>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="persona-records" aria-label={t('recordsTitle')}>
      {loading ? <p className="persona-records__empty">{t('recordsLoading')}</p> : null}
      {!loading && records.length === 0 ? (
        <div className="persona-records__empty-state">
          <p>{t('recordsEmpty')}</p>
          <Button type="button" onClick={onCreate}>{t('recordsCreate')}</Button>
        </div>
      ) : null}

      {!loading && records.length > 0 && layout === 'cards' ? (
        <div className="persona-records__grid">{records.map(renderRecordCard)}</div>
      ) : null}

      {!loading && records.length > 0 && layout === 'list' ? (
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={records}
          emptyText={t('recordsEmpty')}
          resizable
          reorderable
          defaultSort={{ key: 'updatedAt', direction: 'desc' }}
        />
      ) : null}
    </section>
  )
}
