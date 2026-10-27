import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataColumn } from '@no996/ui/data-table'
import { IconActionButton } from '@no996/ui/IconActionButton'
import { Copy, Download, History, Trash2 } from 'lucide-react'
import type { VoiceTtsPayload, WorkbenchTaskRecord } from '../../../services/workbench-tasks'
import { copyVoiceUpstreamUrl, VOICE_UPSTREAM_LINK_TIP } from '../../../lib/voice-upstream-link'
import { downloadUrl } from '../../../services/browser'
import { formatTaskTimeShort } from '../../tasks/task-time'
import { formatMmSs, estimateSpeechSeconds, resolveInstructionPillLabel } from '../voice-constants'
import { JobAudio } from './GenerationList'
import { voiceTaskStatusLabel } from '../voice-i18n'

type Props = {
  items: WorkbenchTaskRecord[]
  onRemove: (id: string) => void
  getPlaybackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getDownloadUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getEmbedFallbackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVoicePayload: (task: WorkbenchTaskRecord) => Promise<VoiceTtsPayload | null>
  emptyHint?: string
}

const MANUSCRIPT_TABLE_CHARS = 48

function truncateManuscript(text: string, max = MANUSCRIPT_TABLE_CHARS): string {
  const trimmed = text.trim()
  if (!trimmed) return '—'
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

function VoiceManuscriptCell({
  task,
  getVoicePayload,
}: {
  task: WorkbenchTaskRecord
  getVoicePayload: (task: WorkbenchTaskRecord) => Promise<VoiceTtsPayload | null>
}) {
  const [fullText, setFullText] = useState(task.title)

  useEffect(() => {
    void getVoicePayload(task).then((payload) => {
      setFullText(payload?.textPreview ?? payload?.text ?? task.title)
    })
  }, [task, getVoicePayload])

  const display = truncateManuscript(fullText)

  return (
    <span className="voice-history-table__manuscript" title={fullText.trim() || undefined}>
      {display}
    </span>
  )
}

function VoiceHistoryMeta({ task, getVoicePayload }: {
  task: WorkbenchTaskRecord
  getVoicePayload: (task: WorkbenchTaskRecord) => Promise<VoiceTtsPayload | null>
}) {
  const { t } = useTranslation('voice')
  const [payload, setPayload] = useState<VoiceTtsPayload | null>(null)
  useEffect(() => {
    void getVoicePayload(task).then(setPayload)
  }, [task, getVoicePayload])

  const text = payload?.text ?? task.title
  const rate = payload?.rate ?? 1
  const voiceLabel = payload?.voiceLabel ?? task.subtitle ?? ''
  const dur = task.meta?.totalDuration
    ? Number(task.meta.totalDuration)
    : estimateSpeechSeconds(text.length, rate)
  const isAdvanced = task.kind === 'voice_dub_advanced'

  const line = isAdvanced
    ? [
        voiceLabel,
        task.meta?.segmentsCount
          ? t('history.segments', { count: task.meta.segmentsCount })
          : null,
        formatMmSs(dur),
      ]
        .filter(Boolean)
        .join(' · ')
    : [
        voiceLabel,
        payload?.instruction?.trim()
          ? t('history.tone', { label: resolveInstructionPillLabel(payload.instruction) })
          : null,
        t('history.rate', { rate: rate.toFixed(1) }),
        formatMmSs(dur),
      ]
        .filter(Boolean)
        .join(' · ')

  return <span className="text-muted-foreground text-xs">{line || '—'}</span>
}

function VoiceHistoryActions({
  task,
  getDownloadUrl,
  getPlaybackUrl,
  getVoicePayload,
  onRemove,
}: {
  task: WorkbenchTaskRecord
  getDownloadUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getPlaybackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVoicePayload: (task: WorkbenchTaskRecord) => Promise<VoiceTtsPayload | null>
  onRemove: (id: string) => void
}) {
  const { t: tw } = useTranslation('workbench')
  const { t } = useTranslation('voice')
  const [href, setHref] = useState('')
  const [upstream, setUpstream] = useState('')
  const [playbackUrl, setPlaybackUrl] = useState('')

  useEffect(() => {
    if (task.status !== 'succeeded') {
      setHref('')
      setUpstream('')
      setPlaybackUrl('')
      return
    }
    void getDownloadUrl(task).then(setHref)
    void getVoicePayload(task).then((p) => setUpstream(p?.upstreamAudioUrl?.trim() ?? ''))
    void getPlaybackUrl(task).then(setPlaybackUrl)
  }, [task, getDownloadUrl, getPlaybackUrl, getVoicePayload])

  const showUpstream = Boolean(upstream && upstream !== playbackUrl)

  return (
    <div className="flex gap-1">
      {task.status === 'succeeded' && href ? (
        <IconActionButton
          icon={<Download className="size-3.5" />}
          label={t('history.download')}
          onClick={() => downloadUrl(href, `voice-${task.id.slice(0, 8)}.wav`)}
        />
      ) : null}
      {showUpstream ? (
        <IconActionButton
          icon={<Copy className="size-3.5" />}
          label={VOICE_UPSTREAM_LINK_TIP}
          onClick={() => void copyVoiceUpstreamUrl(upstream)}
        />
      ) : null}
      <IconActionButton
        icon={<Trash2 className="size-3.5" />}
        label={tw('taskDrawerDelete')}
        variant="danger"
        onClick={() => onRemove(task.id)}
      />
    </div>
  )
}

export function VoiceGenerationHistoryTable({
  items,
  onRemove,
  getPlaybackUrl,
  getDownloadUrl,
  getEmbedFallbackUrl,
  getVoicePayload,
  emptyHint,
}: Props) {
  const { t } = useTranslation('voice')
  const resolvedEmpty = emptyHint ?? t('history.empty')
  const columns = useMemo((): DataColumn<WorkbenchTaskRecord>[] => [
    {
      title: t('history.table.preview'),
      key: 'preview',
      width: 236,
      render: (_, task) => (
        <JobAudio
          task={task}
          getPlaybackUrl={getPlaybackUrl}
          getEmbedFallbackUrl={getEmbedFallbackUrl}
        />
      ),
    },
    {
      title: t('history.table.manuscript'),
      dataIndex: 'title',
      key: 'title',
      width: 280,
      ellipsis: true,
      sortable: true,
      render: (_, task) => (
        <VoiceManuscriptCell task={task} getVoicePayload={getVoicePayload} />
      ),
    },
    {
      title: t('history.table.kind'),
      key: 'kind',
      width: 96,
      render: (_, task) =>
        task.kind === 'voice_dub_advanced' ? t('history.kindAdvanced') : t('history.kindDirect'),
    },
    {
      title: t('history.table.params'),
      key: 'meta',
      ellipsis: true,
      render: (_, task) => (
        <VoiceHistoryMeta task={task} getVoicePayload={getVoicePayload} />
      ),
    },
    {
      title: t('history.table.status'),
      key: 'status',
      dataIndex: 'status',
      width: 88,
      sortable: true,
      render: (_, task) => (
        <span className="wb-task-records__status" data-status={task.status}>
          {voiceTaskStatusLabel(t, task.status)}
        </span>
      ),
    },
    {
      title: t('history.table.time'),
      key: 'time',
      dataIndex: 'createdAt',
      width: 120,
      sortable: true,
      render: (_, task) => (
        <time dateTime={new Date(task.createdAt).toISOString()} className="wb-task-records__field-time">
          {formatTaskTimeShort(task.createdAt)}
        </time>
      ),
    },
    {
      title: t('history.table.actions'),
      key: 'actions',
      isActions: true,
      width: 108,
      render: (_, task) => (
        <VoiceHistoryActions
          task={task}
          getDownloadUrl={getDownloadUrl}
          getPlaybackUrl={getPlaybackUrl}
          getVoicePayload={getVoicePayload}
          onRemove={onRemove}
        />
      ),
    },
  ], [getDownloadUrl, getEmbedFallbackUrl, getPlaybackUrl, getVoicePayload, onRemove, t])

  if (!items.length) {
    return (
      <div className="voice-empty wb-task-records__empty-state" role="status">
        <span className="wb-task-records__empty-icon" aria-hidden="true"><History size={19} /></span>
        <p>{resolvedEmpty}</p>
      </div>
    )
  }

  return (
    <DataTable
      rowKey="id"
      columns={columns}
      dataSource={items}
      resizable
      reorderable
      defaultSort={{ key: 'time', direction: 'desc' }}
    />
  )
}
