import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Film,
  FileText,
  FolderOpen,
  Headphones,
  LoaderCircle,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX
} from 'lucide-react'
import { Button } from '@no996/ui/button'
import { ColumnDivider } from '@no996/ui/column-divider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { cn } from '@no996/ui/utils'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@no996/ui/dropdown-menu'
import {
  Field,
  Notice,
  Page,
  SelectField,
  WorkbenchPageChromeActions,
  WorkbenchToolPageHeaderTools
} from '../../components/WorkbenchUI'
import { WorkbenchPageViewTabs, type WorkbenchPageView } from '../../components/WorkbenchPageViewTabs'
import { WorkbenchPageHistoryPanel } from '../../components/WorkbenchPageHistoryPanel'
import { WorkbenchPageHistoryLayoutTabs } from '../../components/WorkbenchPageHistoryLayoutTabs'
import { WorkbenchTaskHistory } from '../tasks/WorkbenchTaskHistory'
import type { WorkbenchTaskRecordLayout } from '../tasks/WorkbenchTaskRecords'
import type { DigitalHumanRetalkPayload, VoiceTtsPayload, WorkbenchTaskRecord } from '../../services/workbench-tasks'
import type { RetalkTask } from '../../api/video-retalk'
import { useAuth } from '../../auth/AuthContext'
import { apiErrorMessage } from '../../api/client'
import { resolveMediaUrl } from '../../api/media'
import { demoPlatformVoices, isWorkbenchAiDemoMode } from '../../api/workbench-ai'
import { resolveTtsSynthesisConfig } from '../../api/models'
import { listVoices } from '../../api/voice-clone'
import { uploadLipsyncAsset } from '../../api/media-uploads'
import { useWorkbenchTaskActions } from '../../services/workbench-tasks'
import { toastError, toastInfo, toastSuccess, toastWarning } from '../../lib/toast'
import { downloadUrl } from '../../services/browser'
import { extractDocumentText } from '../../lib/chat-attachments/parse-document'
import { useBlobUrl } from '../ip-video/components/SubtitlePreview'
import { useDigitalHumanProject } from './useDigitalHumanProject'
import {
  activeDigitalHumanVersion,
  applyImportedAudioToSegment,
  clearSegmentImportedAudio,
  digitalHumanProjectHasBusyVersions,
  isDigitalHumanProjectShell,
  isDigitalHumanPortraitAuthorized,
  splitDigitalHumanScript,
  DIGITAL_HUMAN_SCRIPT_LIMIT,
  type DigitalHumanSegment,
  type DigitalHumanVersion
} from './lib/project-store'
import {
  readDigitalHumanMedia,
  validateDigitalHumanDuration,
  validateDigitalHumanFile,
  validatePublicMediaUrl
} from './lib/media'
import {
  formatRetalkProgress,
  retalkEstimatedTotalSeconds,
  retalkProgressPercent,
  retalkQueueHint,
  retalkStageCopy,
} from './lib/retalk-remote-progress'
import { AdvancedSourceSettingsDialog } from './AdvancedSourceSettingsDialog'
import {
  DigitalHumanDubModeMenu,
  DigitalHumanImportDubPanel,
  DigitalHumanVoiceFooterMenu,
} from './DigitalHumanDubSettingsControls'
import { DigitalHumanPersonaChipShell, digitalHumanPersonaChipButtonClass } from './DigitalHumanPersonaChip'
import { ScriptDubPreviewDock } from './ScriptDubPreviewDock'
import { DigitalHumanTimelineRail } from './DigitalHumanTimelineRail'
import { DIGITAL_HUMAN_CONTENT_MIN_WIDTH } from './content-width'
import {
  countScriptCharacters,
  resolveScriptDurationDisplay,
} from './lib/script-duration'
import { MonitorStudioVideoPlayer, type MonitorVideoToolbar } from './MonitorStudioVideoPlayer'
import { concatVideoBlobs, type ConcatSegmentItem } from './lib/video-concat'
import './digital-human.css'

/** 根据台词字数估算配音所需积分（1-100字 = 1积分，每超100字 +1积分） */
function estimateVoiceCredits(charCount: number): number {
  if (charCount <= 0) return 1
  return Math.max(1, Math.ceil(charCount / 100))
}

/** 根据口播实际时长（秒）估算数字人口型合成所需积分（约每2秒1积分，起步2积分） */
function estimateRetalkCredits(durationSeconds?: number): number {
  if (!durationSeconds || durationSeconds <= 0) return 4
  return Math.max(2, Math.round(durationSeconds * 0.5))
}

/** 影视级高保真音频试听播放组件（替代原生粗糙 HTML5 audio 控件） */
function StudioAudioPlayer({
  blob,
  url,
  label,
  voiceLabel,
  duration,
  className,
  endAction,
}: {
  blob?: Blob
  url?: string
  label: string
  voiceLabel?: string
  duration?: number
  className?: string
  endAction?: ReactNode
}) {
  const localUrl = useBlobUrl(blob)
  const src = localUrl || (url ? resolveMediaUrl(url) : '')
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(duration || 0)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    if (duration && Number.isFinite(duration) && duration > 0) {
      setTotalDuration(duration)
    }
  }, [duration])

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
  }, [src])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      void el.play().catch(() => setPlaying(false))
    }
  }

  const handleTimeUpdate = () => {
    const el = audioRef.current
    if (!el) return
    setCurrentTime(el.currentTime)
    if (el.duration && Number.isFinite(el.duration) && el.duration > 0 && !duration) {
      setTotalDuration(el.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current
    if (!el) return
    const target = Number(e.target.value)
    el.currentTime = target
    setCurrentTime(target)
  }

  const toggleMute = () => {
    const el = audioRef.current
    if (!el) return
    el.muted = !muted
    setMuted(!muted)
  }

  const formatSec = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return '00:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  if (!src) return null

  const progressPct = totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0

  return (
    <div className={cn('dh-studio-player', className)} aria-label={label}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={e => {
          const d = (e.target as HTMLAudioElement).duration
          if (d && Number.isFinite(d)) setTotalDuration(d)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(0)
        }}
      />

      {/* 播放/暂停大圆钮 */}
      <Button
        type="button"
        variant="default"
        size="sm"
        className="dh-studio-player__play-btn"
        onClick={togglePlay}
        title={playing ? '暂停播放' : '点击试听配音'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </Button>

      {/* 播放进度与波形指示 */}
      <div className="dh-studio-player__body">
        <div className="dh-studio-player__meta">
          <div className="flex items-center gap-1.5 min-w-0">
            <Volume2 size={13} className="text-primary flex-shrink-0" />
            <span className="dh-studio-player__title truncate">{voiceLabel || '口播录音'}</span>
            <span className="dh-studio-player__badge">已就绪</span>
          </div>
          <span className="dh-studio-player__time">
            {formatSec(currentTime)} / {formatSec(totalDuration)}
          </span>
        </div>

        <div className="dh-studio-player__track-wrap">
          {/* 仿真动态声波栏 */}
          <div className={cn('dh-studio-player__waves', playing && 'dh-studio-player__waves--active')}>
            <span style={{ height: '35%' }} />
            <span style={{ height: '65%' }} />
            <span style={{ height: '90%' }} />
            <span style={{ height: '50%' }} />
            <span style={{ height: '100%' }} />
            <span style={{ height: '75%' }} />
            <span style={{ height: '40%' }} />
            <span style={{ height: '85%' }} />
            <span style={{ height: '60%' }} />
            <span style={{ height: '95%' }} />
            <span style={{ height: '45%' }} />
            <span style={{ height: '70%' }} />
            <span style={{ height: '30%' }} />
            <span style={{ height: '80%' }} />
          </div>

          {/* 进度滑轨 */}
          <div className="dh-studio-player__slider-container">
            <div className="dh-studio-player__progress-fill" style={{ width: `${progressPct}%` }} />
            <input
              type="range"
              min={0}
              max={totalDuration || 1}
              step={0.05}
              value={currentTime}
              onChange={handleSeek}
              className="dh-studio-player__slider"
              aria-label="音频播放进度"
            />
          </div>
        </div>
      </div>

      {/* 静音按钮 */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="dh-studio-player__mute-btn"
        onClick={toggleMute}
        title={muted ? '取消静音' : '静音'}
      >
        {muted ? <VolumeX size={14} className="text-destructive" /> : <Volume2 size={14} />}
      </Button>
      {endAction}
    </div>
  )
}

function MediaPlayer({
  blob,
  url,
  sourceVideoUrl,
  kind,
  label,
  loop = false,
  videoToolbar,
  endAction,
}: {
  blob?: Blob
  url?: string
  sourceVideoUrl?: string
  kind: 'video' | 'audio'
  label: string
  loop?: boolean
  videoToolbar?: MonitorVideoToolbar
  endAction?: ReactNode
}) {
  const localUrl = useBlobUrl(blob)
  const src = url ? resolveMediaUrl(url) : ''
  const source = sourceVideoUrl ? resolveMediaUrl(sourceVideoUrl) : ''
  if (!src && !source && !localUrl) return null
  return kind === 'video' ? (
    <MonitorStudioVideoPlayer sourceVideoUrl={source} videoUrl={src} localVideoUrl={localUrl} label={label} loop={loop} toolbar={videoToolbar} />
  ) : (
    <StudioAudioPlayer blob={blob} url={url} label={label} endAction={endAction} />
  )
}

const ACTIVE = ['queued', 'running', 'waiting_remote', 'QUEUED', 'SUBMITTED', 'RUNNING']

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL.replace(/\/$/, '') : ''
const DEMO_PERSON_URL = `${BASE}/demo/digital-human/demo-person.mp4`
const DEMO_VOICE_URL = `${BASE}/demo/digital-human/demo-voice.wav`
const DEMO_RESULT_URL = `${BASE}/demo/digital-human/demo-result.mp4`
const DEMO_PERSON_NAME = 'demo-person.mp4'
const DEMO_VOICE_NAME = 'demo-voice.wav'
const DEMO_SCRIPT_TEXT =
  '大家好，我叫四海，今天非常高兴来给大家演示我们的数字人口播生成系统。\n在短视频、直播带货、企业宣传和产品讲解这些高频内容场景里，我们这套数字人口播生成系统，就是为一站式解决真人出镜耗时耗力、反复重拍等痛点量身打造的。'

async function fetchAsFile(url: string, filename: string, mime: string): Promise<File> {
  const res = await fetch(url, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`示例素材加载失败（${filename}，HTTP ${res.status}）`)
  const blob = await res.blob()
  return new File([blob], filename, { type: mime || blob.type })
}

function RetalkProgressMonitor({
  version,
  audioDuration,
  remote,
  onRefresh,
}: {
  version: DigitalHumanVersion
  audioDuration?: number
  remote: RetalkTask | null
  onRefresh: () => void
}) {
  const [elapsedSec, setElapsedSec] = useState(() => {
    const started = version.createdAt || Date.now()
    return Math.max(0, (Date.now() - started) / 1000)
  })

  // 每 250ms 刷新一次经过时间，支持一位小数高频微幅平滑递增
  useEffect(() => {
    const started = version.createdAt || Date.now()
    const timer = window.setInterval(() => {
      const passed = Math.max(0, (Date.now() - started) / 1000)
      setElapsedSec(passed)
    }, 250)
    return () => window.clearInterval(timer)
  }, [version.createdAt])

  const isFinished =
    remote?.status === 'SUCCEEDED' ||
    version.status === 'succeeded' ||
    Boolean(remote?.video_url) ||
    Boolean(version.videoUrl)

  const estimatedTotal = retalkEstimatedTotalSeconds(remote, audioDuration)
  const numericProgress = isFinished ? 100.0 : retalkProgressPercent(remote, elapsedSec, estimatedTotal)
  const displayProgressText = formatRetalkProgress(numericProgress)
  const stage = isFinished
    ? { title: '口型合成已就绪', desc: '画面渲染与编码完成，正在装载成片预览' }
    : retalkStageCopy(remote?.status ?? (version.status as RetalkTask['status'] | undefined))
  const queueHint = isFinished ? null : retalkQueueHint(remote)

  const formatTime = (s: number) => {
    const floorS = Math.floor(s)
    const m = Math.floor(floorS / 60)
    const sec = floorS % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const remainingSec = Math.max(0, Math.ceil(estimatedTotal - elapsedSec))
  const remainingLabel = isFinished
    ? '已完成'
    : remainingSec > 0
      ? `预计还需 ~${remainingSec} 秒`
      : '正在终道融合与超分编码...'

  return (
    <div className="dh-retalk-progress-monitor">
      {/* 动态呼吸环与百分比 */}
      <div className="dh-retalk-pulse-circle">
        <div className="dh-retalk-percent-val">{displayProgressText}%</div>
        <div className="dh-retalk-percent-label">{isFinished ? '生成完成' : '估算进度（非实时）'}</div>
      </div>

      <div className="dh-retalk-monitor-title">
        <h4>{stage.title}</h4>
        <p>{queueHint ?? stage.desc}</p>
      </div>

      <div className="dh-retalk-bar-container">
        <div className="dh-retalk-bar-fill" style={{ width: `${numericProgress}%` }} />
      </div>

      {/* 时间指标 */}
      <div className="dh-retalk-time-metrics">
        <span>已处理 {formatTime(elapsedSec)}</span>
        <span>{remainingLabel}</span>
      </div>

      {/* 底部自动轮询与手动刷新 */}
      <div className="dh-retalk-sync-row">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="dh-pulse-dot" /> {version.observationPaused ? '自动查询已暂停，请手动刷新' : version.error ? `查询提示：${version.error}` : '云端后台自动轮询同步'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-primary hover:text-primary gap-1"
          onClick={onRefresh}
          title="立即向服务端查询最新合成状态"
        >
          <RefreshCw size={11} />
          立即查询
        </Button>
      </div>
    </div>
  )
}

function voiceWorkshopPreviewText(raw?: string | null): string {
  if (!raw?.trim()) return '（无文案）'
  let text = raw.trim().replace(/\s+/g, ' ')
  const len = text.length
  if (len >= 24 && len % 2 === 0) {
    const half = text.slice(0, len / 2)
    if (half === text.slice(len / 2)) text = half
  }
  return text.length > 88 ? `${text.slice(0, 88)}…` : text
}

/** 配音工坊历史任务单项试听与直选卡片 */
function VoiceWorkshopTaskItem({
  task,
  onApply
}: {
  task: WorkbenchTaskRecord
  onApply: (blob: Blob, text: string, voiceLabel: string, duration: number, applyText: boolean) => void
}) {
  const actions = useWorkbenchTaskActions()
  const [playing, setPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [payload, setPayload] = useState<VoiceTtsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void actions.getPayload(task.payloadId).then(data => {
      if (!cancelled) setPayload(data as VoiceTtsPayload | null)
    })
    return () => {
      cancelled = true
    }
  }, [task, actions])

  async function togglePlay() {
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    if (!audioUrl) {
      setLoading(true)
      try {
        const url = await actions.getVoicePlaybackUrl(task)
        if (url) {
          setAudioUrl(url)
          const el = new Audio(url)
          audioRef.current = el
          el.onended = () => setPlaying(false)
          el.onerror = () => setPlaying(false)
          await el.play()
          setPlaying(true)
        }
      } catch {
        setPlaying(false)
      } finally {
        setLoading(false)
      }
    } else if (audioRef.current) {
      await audioRef.current.play()
      setPlaying(true)
    }
  }

  async function handleSelect(applyText: boolean) {
    setLoading(true)
    try {
      const url = audioUrl || (await actions.getVoicePlaybackUrl(task))
      if (!url) return
      const res = await fetch(url)
      const blob = await res.blob()
      const meta = await readDigitalHumanMedia(blob, 'audio')
      const text = payload?.text || task.title
      const voiceLabel = payload?.voiceLabel || task.title
      onApply(blob, text, voiceLabel, meta.duration, applyText)
    } finally {
      setLoading(false)
    }
  }

  const voiceLabel = payload?.voiceLabel || task.title
  const preview = voiceWorkshopPreviewText(payload?.text)
  const createdLabel = new Date(task.createdAt).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
  })

  return (
    <article className="dh-voice-lib-card">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="dh-voice-lib-card__play"
        disabled={loading}
        aria-label={playing ? '暂停试听' : '试听配音'}
        onClick={() => void togglePlay()}
      >
        {loading ? (
          <LoaderCircle size={13} className="animate-spin" aria-hidden />
        ) : playing ? (
          <Pause size={13} aria-hidden />
        ) : (
          <Play size={13} className="ml-0.5" aria-hidden />
        )}
      </Button>

      <div className="dh-voice-lib-card__body min-w-0">
        <div className="dh-voice-lib-card__title-row">
          <span className="dh-voice-lib-card__title truncate">{voiceLabel}</span>
          <span className="dh-voice-lib-card__date">{createdLabel}</span>
        </div>
        <p className="dh-voice-lib-card__text">{preview}</p>
      </div>

      <DigitalHumanPersonaChipShell className="dh-voice-lib-card__apply-shell shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={loading}
            render={
              <button
                type="button"
                className={digitalHumanPersonaChipButtonClass}
                data-bound="true"
                disabled={loading}
                aria-label="选用配音"
              >
                <span className="persona-injection__text">选用</span>
                <ChevronDown className="wb-disclosure-chevron shrink-0" size={14} aria-hidden />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[11rem]">
            <DropdownMenuItem disabled={loading} onClick={() => void handleSelect(false)}>
              仅用配音
            </DropdownMenuItem>
            <DropdownMenuItem disabled={loading} onClick={() => void handleSelect(true)}>
              配音与文案
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </DigitalHumanPersonaChipShell>
    </article>
  )
}

export default function DigitalHumanPage() {
  const { t } = useTranslation('digitalHuman')
  const { userId } = useAuth()
  const [params] = useSearchParams()
  const model = useDigitalHumanProject(params.get('project'))
  const { project, projects, update, patchVersion, persist, error, setError, saved, tasks } = model
  const actions = useWorkbenchTaskActions()

  // 页面视图切换：创作 vs 历史
  const [pageView, setPageView] = useState<WorkbenchPageView>('work')
  const [historyLayout, setHistoryLayout] = useState<WorkbenchTaskRecordLayout>('cards')

  const [selectedId, setSelectedId] = useState('')
  const [advancedModal, setAdvancedModal] = useState(false)
  const [renameModal, setRenameModal] = useState(false)
  const [renameInput, setRenameInput] = useState('')
  const [createProjectModal, setCreateProjectModal] = useState(false)
  const [createProjectInput, setCreateProjectInput] = useState('')
  const [loop, setLoop] = useState(true)
  const [preview, setPreview] = useState<'source' | 'result'>('source')
  const [busy, setBusy] = useState('')
  const [voices, setVoices] = useState(demoPlatformVoices())
  const [voiceError, setVoiceError] = useState('')
  const [voiceLibraryOpen, setVoiceLibraryOpen] = useState(false)
  const [importMode, setImportMode] = useState<'script' | 'audio' | null>(null)
  const [selectedImport, setSelectedImport] = useState('')
  const [audioUrlInput, setAudioUrlInput] = useState('')
  const [showAudioUrlModal, setShowAudioUrlModal] = useState(false)
  const [dubSourceMode, setDubSourceMode] = useState<'ai' | 'import'>('ai')
  const [scriptDubDockCollapsed, setScriptDubDockCollapsed] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [retentionHintOpen, setRetentionHintOpen] = useState(false)

  const controller = useRef<AbortController>()
  const scriptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const mounted = useRef(true)
  const account = useRef(userId)
  account.current = userId
  const lastProject = useRef(project)
  lastProject.current = project

  // 隐形文件输入 ref
  const fileSourceRef = useRef<HTMLInputElement>(null)
  const fileDocRef = useRef<HTMLInputElement>(null)
  const fileAudioRef = useRef<HTMLInputElement>(null)
  const fileRefImageRef = useRef<HTMLInputElement>(null)

  function focusScriptEditor() {
    setDubSourceMode('ai')
    requestAnimationFrame(() => {
      scriptTextareaRef.current?.focus()
    })
  }

  const segment = project?.segments.find(item => item.id === selectedId) ?? project?.segments[0]
  const version = segment ? activeDigitalHumanVersion(segment) : undefined
  const [resultVideoRemoteBytes, setResultVideoRemoteBytes] = useState<number>()
  const demo = isWorkbenchAiDemoMode()
  const voiceId = project?.voiceId ?? demoPlatformVoices()[0]?.id ?? ''
  const pending = Boolean(version && ACTIVE.includes(version.status ?? ''))
  const activeRetalkJob = useMemo(
    () => tasks.find(task => task.id === version?.localTaskId),
    [tasks, version?.localTaskId],
  )
  const [retalkRemote, setRetalkRemote] = useState<RetalkTask | null>(null)

  useEffect(() => {
    if (!pending || !activeRetalkJob) {
      setRetalkRemote(null)
      return
    }
    let cancelled = false
    void actions
      .getPayload(activeRetalkJob.payloadId)
      .then(raw => {
        if (cancelled) return
        const payload = raw as DigitalHumanRetalkPayload | null
        if (payload?.result) {
          setRetalkRemote(payload.result)
          return
        }
        if (payload?.taskId && payload?.status) {
          setRetalkRemote({
            task_id: payload.taskId,
            status: payload.status,
            created_at: new Date(activeRetalkJob.createdAt).toISOString(),
          })
          return
        }
        setRetalkRemote(null)
      })
      .catch(() => {
        if (!cancelled) setRetalkRemote(null)
      })
    return () => {
      cancelled = true
    }
  }, [pending, activeRetalkJob, activeRetalkJob?.payloadId, activeRetalkJob?.status, version?.status, actions])

  const segmentHasDubAudio = Boolean(version?.audio || version?.audioUrl)
  const otherRetalkActive = tasks.some(
    task => task.kind === 'digital_human_retalk' && ['queued', 'running'].includes(task.status) && task.id !== version?.localTaskId
  )
  const retryWait = Math.max(0, Math.ceil(((version?.retryAfterUntil ?? 0) - now) / 1000))

  useEffect(() => {
    if (!retryWait) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [version?.retryAfterUntil, retryWait > 0])

  const readySegmentsCount =
    project?.segments.filter(item => {
      const v = activeDigitalHumanVersion(item)
      return v?.sourceVideoUrl || v?.videoUrl || v?.videoBlob
    }).length ?? 0

  const hasSourceVideo = Boolean(project?.source || project?.sourceUrl?.trim())
  const portraitAuthorized = project ? isDigitalHumanPortraitAuthorized(project) : false
  const portraitAuthTooltip = !hasSourceVideo
    ? t('portraitAuthAwaitingSource')
    : portraitAuthorized
      ? t('portraitAuthDockOk')
      : t('portraitAuthDockHint')

  useEffect(() => {
    setRetentionHintOpen(false)
  }, [version?.id])
  const resultVideoByteSize = version?.videoBlob?.size ?? resultVideoRemoteBytes

  useEffect(() => {
    if (!version?.videoUrl || version.videoBlob || version?.status === 'expired') {
      setResultVideoRemoteBytes(undefined)
      return
    }
    const url = resolveMediaUrl(version.videoUrl)
    let alive = true
    void fetch(url, { method: 'HEAD' })
      .then(res => {
        if (!alive) return
        if (!res.ok) return
        const raw = res.headers.get('content-length')
        if (!raw) return
        const bytes = Number(raw)
        if (Number.isFinite(bytes) && bytes > 0) setResultVideoRemoteBytes(bytes)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [version?.videoUrl, version?.videoBlob, version?.status, segment?.id, version?.id, patchVersion, t])

  const importTasks = tasks.filter(
    task =>
      task.status === 'succeeded' &&
      (importMode === 'script' ? task.kind === 'script_generate' : ['voice_tts', 'ip_video_audio'].includes(task.kind))
  )

  // 配音工坊历史任务（语音合成成功的记录）
  const voiceWorkshopTasks = useMemo(() => {
    return tasks.filter(t => (t.kind === 'voice_tts' || t.kind === 'ip_video_audio') && t.status === 'succeeded')
  }, [tasks])

  // 项目 ID -> 最新项目名称映射表（包含当前 project 以及 projects 列表）
  const projectMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) {
      if (p.id && p.name) map.set(p.id, p.name)
    }
    if (project?.id && project.name) {
      map.set(project.id, project.name)
    }
    return map
  }, [projects, project?.id, project?.name])

  // 数字人合成历史任务与进行中徽标
  const digitalHumanTasks = useMemo(() => {
    return tasks
      .filter(t => t.kind === 'digital_human_retalk')
      .map(t => {
        const projectId = t.meta?.projectId
        const latestName = projectId ? projectMap.get(projectId) : undefined
        if (latestName && latestName !== t.title) {
          return { ...t, title: latestName }
        }
        return t
      })
  }, [tasks, projectMap])

  const pendingTasksCount = useMemo(() => {
    return digitalHumanTasks.filter(t => t.status === 'queued' || t.status === 'running').length
  }, [digitalHumanTasks])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])

  useEffect(() => {
    controller.current?.abort()
    setBusy('')
    setSelectedId('')
    setPreview('source')
    if (error && error.includes('短于配音')) setError('')
  }, [userId, project?.id, error, setError])

  useEffect(() => {
    if (demo || userId == null) return
    let active = true
    void Promise.all([resolveTtsSynthesisConfig(), listVoices()])
      .then(([tts, { data }]) => {
        if (active) {
          setVoices([
            ...tts.platformVoices,
            ...data
              .filter(item => item.ready_for_synthesis)
              .map(item => ({ id: item.voice_id, label: item.display_name }))
          ])
          setVoiceError('')
        }
      })
      .catch(e => {
        if (active) setVoiceError(apiErrorMessage(e))
      })
    return () => {
      active = false
    }
  }, [demo, userId])

  function changeSegment(change: (value: DigitalHumanSegment) => DigitalHumanSegment) {
    if (segment) {
      update(previous => ({
        ...previous,
        segments: previous.segments.map(item => (item.id === segment.id ? change(item) : item))
      }))
    }
  }

  function handleClearSegmentDub() {
    if (!segment || busy || pending) return
    const cleared = clearSegmentImportedAudio(segment)
    if (cleared === undefined) {
      toastWarning(t('scriptDubDockDeleteBlocked'))
      return
    }
    if (cleared === segment) return
    changeSegment(() => cleared)
    setScriptDubDockCollapsed(false)
  }

  function handleClearSourceVideo() {
    if (!project || busy) return
    if (!hasSourceVideo) return
    if (pending) {
      toastWarning(t('monitorSourceDeleteBlocked'))
      return
    }
    update(previous => ({
      ...previous,
      source: undefined,
      sourceUrl: '',
      uploadedSource: undefined,
    }))
    setPreview('source')
  }

  async function run(label: string, work: (signal: AbortSignal) => Promise<void>) {
    if (busy || userId == null) return
    const ac = new AbortController()
    controller.current = ac
    setBusy(label)
    setError('')
    try {
      await work(ac.signal)
    } catch (e) {
      if (!ac.signal.aborted && mounted.current) {
        const msg = apiErrorMessage(e)
        toastError(msg)
      }
    } finally {
      if (controller.current === ac) {
        setBusy('')
        controller.current = undefined
      }
    }
  }

  function ensureCurrent(id: string, owner: number, signal?: AbortSignal) {
    if (signal?.aborted || !mounted.current || account.current !== owner || lastProject.current?.id !== id) {
      throw new DOMException('已取消', 'AbortError')
    }
  }

  async function selectSource(file?: File) {
    if (!file || !isDigitalHumanPortraitAuthorized(project)) return
    const snapshot = project
    await run(t('reading'), async signal => {
      validateDigitalHumanFile(file, 'video')
      const metadata = await readDigitalHumanMedia(file, 'video', signal)
      validateDigitalHumanDuration(metadata.duration, 'video')
      if (Math.min(metadata.width, metadata.height) < 640 || Math.max(metadata.width, metadata.height) > 2048) {
        throw new Error(t('resolutionError'))
      }
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
      update(previous => ({
        ...previous,
        source: { id: crypto.randomUUID(), file, name: file.name, ...metadata },
        uploadedSource: undefined,
        sourceUrl: ''
      }))
      setPreview('source')
    })
  }

  async function selectReference(file?: File) {
    if (!file || !project) return
    const snapshot = project
    await run(t('reading'), async signal => {
      validateDigitalHumanFile(file, 'ref_image')
      const bitmap = await createImageBitmap(file)
      const valid =
        Math.max(bitmap.width, bitmap.height) <= 4096 &&
        Math.max(bitmap.width / bitmap.height, bitmap.height / bitmap.width) <= 2
      bitmap.close()
      if (!valid) throw new Error(t('referenceError'))
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
      update(previous => ({ ...previous, reference: { file, name: file.name }, referenceUrl: '' }))
    })
  }

  /** 一键导入官方演示示例（底模原视频、配音音频与演示文案；可选加载成片示例） */
  async function handleImportDemo(includeResult = false) {
    let currentProject = project
    if (!currentProject) {
      await run('正在初始化示例项目...', async () => {
        await model.create('数字人口播示例')
      })
      currentProject = lastProject.current
    }
    if (!currentProject) return
    const snapshot = currentProject
    await run(includeResult ? '正在加载成片演示示例...' : '正在导入官方示例素材...', async signal => {
      const personFile = await fetchAsFile(DEMO_PERSON_URL, DEMO_PERSON_NAME, 'video/mp4')
      validateDigitalHumanFile(personFile, 'video')
      const videoMeta = await readDigitalHumanMedia(personFile, 'video', signal)
      validateDigitalHumanDuration(videoMeta.duration, 'video')

      const voiceFile = await fetchAsFile(DEMO_VOICE_URL, DEMO_VOICE_NAME, 'audio/wav')
      validateDigitalHumanFile(voiceFile, 'audio')
      const audioMeta = await readDigitalHumanMedia(voiceFile, 'audio', signal)
      validateDigitalHumanDuration(audioMeta.duration)

      let resultBlob: Blob | undefined
      if (includeResult) {
        try {
          const res = await fetch(DEMO_RESULT_URL, { cache: 'force-cache', signal })
          if (res.ok) {
            resultBlob = await res.blob()
          }
        } catch {
          // 忽略成片加载异常
        }
      }

      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)

      const targetSegmentId = segment?.id ?? snapshot.segments[0]?.id ?? crypto.randomUUID()
      const nextVersion: DigitalHumanVersion = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        text: DEMO_SCRIPT_TEXT,
        audio: voiceFile,
        audioDuration: audioMeta.duration,
        voiceLabel: '四海原声演示 (demo-voice.wav)',
        status: resultBlob ? 'succeeded' : 'audio_ready',
        videoBlob: resultBlob
      }

      update(previous => {
        const segs =
          previous.segments.length > 0
            ? previous.segments.map((seg, idx) => {
                if (seg.id === targetSegmentId || (idx === 0 && !targetSegmentId)) {
                  if (resultBlob) {
                    return {
                      ...seg,
                      text: DEMO_SCRIPT_TEXT,
                      activeVersionId: nextVersion.id,
                      versions: [...seg.versions, nextVersion],
                    }
                  }
                  return applyImportedAudioToSegment(seg, {
                    text: DEMO_SCRIPT_TEXT,
                    audio: voiceFile,
                    audioDuration: audioMeta.duration,
                    voiceLabel: '四海原声演示 (demo-voice.wav)',
                  })
                }
                return seg
              })
            : [
                {
                  id: targetSegmentId,
                  text: DEMO_SCRIPT_TEXT,
                  activeVersionId: nextVersion.id,
                  versions: [nextVersion]
                }
              ]

        return {
          ...previous,
          authorized: true,
          extendVideo: true,
          source: {
            id: crypto.randomUUID(),
            file: personFile,
            name: personFile.name,
            ...videoMeta
          },
          uploadedSource: undefined,
          sourceUrl: '',
          segments: segs
        }
      })

      setSelectedId(targetSegmentId)
      setPreview(resultBlob ? 'result' : 'source')
      await persist()
    })
  }

  /** 仅为当前分镜引入官方示例配音 (demo-voice.wav) */
  async function handleImportDemoAudioOnly() {
    if (!segment || !project) return
    const snapshot = project
    const target = segment.id
    await run('正在导入示例配音...', async signal => {
      const voiceFile = await fetchAsFile(DEMO_VOICE_URL, DEMO_VOICE_NAME, 'audio/wav')
      validateDigitalHumanFile(voiceFile, 'audio')
      const audioMeta = await readDigitalHumanMedia(voiceFile, 'audio', signal)
      validateDigitalHumanDuration(audioMeta.duration)
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)

      const text = segment.text.trim() ? segment.text : DEMO_SCRIPT_TEXT
      update(previous => ({
        ...previous,
        segments: previous.segments.map(item =>
          item.id === target
            ? applyImportedAudioToSegment(item, {
                text,
                audio: voiceFile,
                audioDuration: audioMeta.duration,
                voiceLabel: '四海原声演示 (demo-voice.wav)',
              })
            : item
        ),
      }))
      setDubSourceMode('import')
    })
  }

  function addVersion(next: DigitalHumanVersion) {
    changeSegment(previous => ({ ...previous, activeVersionId: next.id, versions: [...previous.versions, next] }))
  }

  async function uploadAudio(file?: File) {
    if (!file || !segment || !project) return
    const snapshot = project
    const target = segment.id
    await run(t('reading'), async signal => {
      validateDigitalHumanFile(file, 'audio')
      const metadata = await readDigitalHumanMedia(file, 'audio', signal)
      validateDigitalHumanDuration(metadata.duration)
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
      update(previous => ({
        ...previous,
        segments: previous.segments.map(item =>
          item.id === target
            ? applyImportedAudioToSegment(item, {
                text: segment.text,
                audio: file,
                audioDuration: metadata.duration,
                voiceLabel: file.name,
              })
            : item
        ),
      }))
      setDubSourceMode('import')
    })
  }

  /** 从配音工坊历史任务直接应用到当前镜头 */
  function applyVoiceWorkshopTake(blob: Blob, text: string, voiceLabel: string, duration: number, applyText: boolean) {
    if (!segment) return
    const targetId = segment.id
    const nextText = applyText && text.trim() ? text.trim() : segment.text
    update(previous => ({
      ...previous,
      segments: previous.segments.map(item =>
        item.id === targetId
          ? applyImportedAudioToSegment(item, {
              text: nextText,
              audio: blob,
              audioDuration: duration,
              voiceLabel,
            })
          : item
      ),
    }))
    setVoiceLibraryOpen(false)
    if (applyText && text.trim()) {
      focusScriptEditor()
    } else {
      setDubSourceMode('import')
    }
  }

  async function useAudioUrl() {
    if (!isDigitalHumanPortraitAuthorized(project) || !segment || !audioUrlInput.trim()) return
    const snapshot = project
    await run(t('reading'), async signal => {
      const audioUrl = validatePublicMediaUrl(audioUrlInput.trim())
      const metadata = await readDigitalHumanMedia(audioUrl, 'audio', signal)
      validateDigitalHumanDuration(metadata.duration)
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
      update(previous => ({
        ...previous,
        segments: previous.segments.map(item =>
          item.id === segment.id
            ? applyImportedAudioToSegment(item, {
                text: segment.text,
                audioUrl,
                audioDuration: metadata.duration,
              })
            : item
        ),
      }))
      setShowAudioUrlModal(false)
      setAudioUrlInput('')
      setDubSourceMode('import')
    })
  }

  async function generateAudio(targetVoiceId?: string) {
    const vId = targetVoiceId || voiceId
    if (!project) return
    if (!isDigitalHumanPortraitAuthorized(project)) {
      toastWarning('请先勾选左侧监视器下方的肖像合规授权。')
      return
    }
    if (!segment?.text.trim()) {
      toastWarning('请先在上方输入需要朗读的台词文稿。')
      return
    }
    if (countScriptCharacters(segment.text) > DIGITAL_HUMAN_SCRIPT_LIMIT) {
      toastWarning('单段台词不能超过 350 字，请先使用台词工具拆分长文。')
      return
    }
    if (demo) {
      toastInfo('演示模式：已模拟配音生成流程。')
      return
    }
    if (version?.status === 'audio_queued') {
      toastInfo('配音任务正在后台生成中，请稍候。')
      return
    }
    if (busy) {
      toastInfo('系统正在处理中，请稍候。')
      return
    }
    const snapshot = project
    const target = segment
    await run(t('queueing'), async signal => {
      const next: DigitalHumanVersion = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        text: target.text,
        voiceId: vId,
        voiceLabel: voices.find(item => item.id === vId)?.label,
        status: 'audio_queued'
      }
      addVersion(next)
      await persist()
      try {
        const id = await actions.enqueueVoiceTts({
          text: target.text,
          voiceId: vId,
          voiceLabel: next.voiceLabel ?? vId,
          rate: 1,
          volume: 50,
          pitch: 1
        })
        ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
        patchVersion(target.id, next.id, { audioTaskId: id })
        model.refreshResults()
        toastSuccess('已加入配音生成任务', '后台正在合成音频，完成后自动就绪试听。')
      } catch (e) {
        if (account.current === snapshot.ownerUserId && lastProject.current?.id === snapshot.id) {
          patchVersion(target.id, next.id, { status: 'failed', error: apiErrorMessage(e) })
        }
        toastError(apiErrorMessage(e))
        throw e
      }
    })
  }

  async function generateRetalk() {
    if (!project) return
    if (!isDigitalHumanPortraitAuthorized(project)) {
      toastWarning('请先勾选左侧监视器下方的肖像合规授权。')
      return
    }
    if (!segment) return
    if (!(version?.audio || version?.audioUrl)) {
      toastWarning('当前段落尚未就绪配音，请先生成或选择配音。')
      return
    }
    if (!(project.source || project.sourceUrl?.trim())) {
      toastWarning('尚未绑定人物底模原视频，请先在左侧上传或导入底模。')
      return
    }
    if (demo) {
      toastInfo('演示模式：当前为演示环境，口型提交已禁用。')
      return
    }
    if (pending) {
      toastInfo('当前段落口型已在合成中，请稍候。')
      return
    }
    if (otherRetalkActive) {
      toastWarning(t('otherTaskActive'))
      return
    }
    if ((version?.retryAfterUntil ?? 0) > Date.now()) {
      toastWarning(`平台队列暂满，服务端要求等待 ${retryWait} 秒后再提交。`)
      return
    }

    const snapshot = project
    const target = segment
    const take = version
    if (take.text !== target.text) {
      toastWarning('台词文案已修改，与当前配音不一致。请重新配音或恢复此前文案。')
      return
    }
    await run(t('uploading'), async signal => {
      validateDigitalHumanDuration(take.audioDuration ?? 0)
      const publicVideo = snapshot.sourceUrl?.trim() ? validatePublicMediaUrl(snapshot.sourceUrl.trim()) : ''
      const sourceMetadata = publicVideo ? await readDigitalHumanMedia(publicVideo, 'video', signal) : snapshot.source
      if (!sourceMetadata) {
        toastWarning(t('sourceRequired'))
        return
      }
      validateDigitalHumanDuration(sourceMetadata.duration, 'video')
      if (Math.min(sourceMetadata.width, sourceMetadata.height) < 640 || Math.max(sourceMetadata.width, sourceMetadata.height) > 2048) {
        toastError(t('resolutionError'))
        return
      }

      // 底模时长检测与正倒放交替延长处理：改为 Toast 提示，且自动辅助开启正倒放延长，不弹出红色 Notice 错误横幅
      if (!snapshot.videoExtension && take.audioDuration! > sourceMetadata.duration + 0.1) {
        toastWarning(
          `底模视频（${sourceMetadata.duration.toFixed(1)}s）短于配音（${take.audioDuration?.toFixed(1)}s）`,
          '已为你自动开启正倒放交替延长，确保口播不被截断。'
        )
        update(previous => ({ ...previous, videoExtension: true }))
      }

      const uploadOptions = { signal }
      const cached =
        snapshot.uploadedSource?.sourceId === snapshot.source?.id && snapshot.uploadedSource?.expiresAt > Date.now()
          ? snapshot.uploadedSource.url
          : ''
      let video = publicVideo || cached
      if (!video && snapshot.source) {
        try {
          video = await uploadLipsyncAsset(
            new File([snapshot.source.file], snapshot.source.name, { type: snapshot.source.file.type }),
            'video',
            uploadOptions,
          )
        } catch (e) {
          if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e
          setError('底模视频上传失败，请检查网络后重试。')
          throw new Error('底模视频上传失败，请检查网络后重试。')
        }
      }
      if (!video) {
        toastWarning(t('sourceRequired'))
        return
      }
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
      if (!publicVideo && !cached && snapshot.source?.id) {
        update(previous => ({
          ...previous,
          uploadedSource: {
            sourceId: snapshot.source!.id!,
            url: video,
            expiresAt: Date.now() + 47 * 60 * 60 * 1000
          }
        }))
      }
      const audioExtension = take.audio?.type.includes('mpeg') ? 'mp3' : take.audio?.type.includes('aac') ? 'aac' : 'wav'
      const audio = take.audioUrl
        ? validatePublicMediaUrl(take.audioUrl)
        : await uploadLipsyncAsset(
            new File([take.audio!], take.audio instanceof File ? take.audio.name : `speech.${audioExtension}`, {
              type: take.audio!.type || 'audio/wav'
            }),
            'audio',
            uploadOptions
          )
      const faceReference = snapshot.referenceUrl?.trim()
        ? validatePublicMediaUrl(snapshot.referenceUrl.trim())
        : snapshot.reference
          ? await uploadLipsyncAsset(
              new File([snapshot.reference.file], snapshot.reference.name, { type: snapshot.reference.file.type }),
              'ref_image',
              uploadOptions
            )
          : undefined
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)

      const next: DigitalHumanVersion = {
        ...take,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        text: target.text,
        clientRequestId: `web-${crypto.randomUUID()}`,
        sourceName: snapshot.source?.name ?? snapshot.sourceUrl,
        videoUrl: undefined,
        sourceVideoUrl: undefined,
        videoBlob: undefined,
        taskId: undefined,
        localTaskId: undefined,
        status: 'queued',
        error: undefined
      }
      addVersion(next)
      await persist()
      let accepted = false
      try {
        const id = await actions.enqueueDigitalHumanRetalk({
          projectId: snapshot.id,
          segmentId: target.id,
          versionId: next.id,
          title: snapshot.name || t('untitled'),
          video,
          audio,
          faceReference,
          videoExtension: true, // 确保传给执行器时带上延长
          text: target.text,
          clientRequestId: next.clientRequestId!
        })
        accepted = true
        ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
        patchVersion(target.id, next.id, { localTaskId: id })
        await persist()
        model.refreshResults()
        setPreview('result')
        toastSuccess('口型合成任务已提交', '后台神经网络正在渲染对齐，完成后可在成片栏查看。')
      } catch (e) {
        if (!accepted && account.current === snapshot.ownerUserId && lastProject.current?.id === snapshot.id) {
          patchVersion(target.id, next.id, { status: 'failed', error: apiErrorMessage(e) })
        }
        toastError(apiErrorMessage(e))
        throw e
      }
    })
  }

  async function importHistory() {
    if (!selectedImport || !project) return
    const snapshot = project
    const task = tasks.find(item => item.id === selectedImport)
    if (!task) return
    await run(t('reading'), async signal => {
      const raw = (await actions.getPayload(task.payloadId)) as {
        config?: { mode?: string }
        usedMock?: boolean
        segments?: Array<{ spoken?: string }>
        text?: string
        voiceLabel?: string
      }
      ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
      if (importMode === 'script') {
        if (raw.usedMock || raw.config?.mode !== 'video') throw new Error(t('realVideoScriptOnly'))
        const added = (raw.segments ?? [])
          .filter(item => item.spoken?.trim())
          .map(item => ({ id: crypto.randomUUID(), text: item.spoken!.trim(), versions: [] }))
        if (!added.length) throw new Error(t('emptyImport'))
        update(previous => ({
          ...previous,
          segments:
            previous.segments.length === 1 && !previous.segments[0].text && !previous.segments[0].versions.length
              ? added
              : [...previous.segments, ...added]
        }))
        setSelectedId(added[0].id)
      } else {
        const url = await actions.getVoicePlaybackUrl(task)
        if (!url) throw new Error(t('emptyImport'))
        const response = await fetch(url, { signal })
        if (!response.ok) throw new Error(t('audioLoadFailed'))
        const blob = await response.blob()
        const metadata = await readDigitalHumanMedia(blob, 'audio', signal)
        validateDigitalHumanDuration(metadata.duration)
        ensureCurrent(snapshot.id, snapshot.ownerUserId, signal)
        const text = segment?.text || raw.text || ''
        const next: DigitalHumanVersion = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          text,
          audio: blob,
          audioDuration: metadata.duration,
          voiceLabel: raw.voiceLabel ?? task.title,
          status: 'audio_ready'
        }
        changeSegment(previous => ({
          ...previous,
          text,
          activeVersionId: next.id,
          versions: [...previous.versions, next]
        }))
      }
      setImportMode(null)
    })
  }

  async function downloadVersion() {
    if (!version) return
    await run(t('downloading'), async signal => {
      let blob: Blob | undefined
      for (const candidate of [version.sourceVideoUrl, version.videoUrl]) {
        if (!candidate || blob) continue
        try {
          const response = await fetch(resolveMediaUrl(candidate), { signal })
          if (response.ok) blob = await response.blob()
        } catch (e) {
          if (signal.aborted) throw e
        }
      }
      blob ??= version.videoBlob
      if (!blob) throw new Error('成片暂时无法下载，请检查网络或稍后重试。')
      const metadata = await readDigitalHumanMedia(blob, 'video', signal)
      if (!metadata.width || !metadata.height) throw new Error(t('downloadFailed'))
      const extension = blob.type.includes('webm') ? 'webm' : 'mp4'
      const url = URL.createObjectURL(blob)
      downloadUrl(url, `${project?.name || 'digital-human'}-${selectedId || segment?.id}.${extension}`)
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
    })
  }

  const isConcatenating = busy === '视频拼接中'

  async function handleBatchGenerateAll() {
    if (!project || busy || pending) return
    if (!isDigitalHumanPortraitAuthorized(project)) {
      toastWarning('请先勾选左侧监视器下方的肖像合规授权。')
      return
    }
    if (!(project.source || project.sourceUrl?.trim())) {
      toastWarning('尚未绑定人物底模原视频，请先在左侧上传或导入底模。')
      return
    }
    const unvoiced = project.segments.filter(s => {
      const v = activeDigitalHumanVersion(s)
      return s.text.trim() && (!v?.audio && !v?.audioUrl)
    })
    const unrendered = project.segments.filter(s => {
      const v = activeDigitalHumanVersion(s)
      return s.text.trim() && !v?.videoUrl && !v?.sourceVideoUrl && !v?.videoBlob
    })
    if (!unrendered.length && !unvoiced.length) {
      toastInfo('所有段落均已就绪成片，可直接点击时间轴「合并成片」导出。')
      return
    }

    const confirmed = window.confirm(
      `即将顺序生成整篇文稿（共 ${project.segments.length} 段），这将按各段字数与时长消耗账户配音和数字人合成额度。确认继续？`
    )
    if (!confirmed) return

    for (let i = 0; i < project.segments.length; i++) {
      const targetSeg = project.segments[i]
      if (!targetSeg.text.trim()) continue
      setSelectedId(targetSeg.id)
      const currentVersion = activeDigitalHumanVersion(targetSeg)
      if (currentVersion?.sourceVideoUrl || currentVersion?.videoUrl || currentVersion?.videoBlob) {
        continue
      }
      if (!currentVersion?.audio && !currentVersion?.audioUrl) {
        toastInfo(`正在为第 ${i + 1}/${project.segments.length} 段生成配音...`)
        await generateAudio()
        toastInfo(`第 ${i + 1} 段配音已加入队列，可在任务列表中查看进度。`)
        break // 遵循串行任务安全：交由全局任务观察器有序推动，避免瞬时并发冲撞
      } else {
        toastInfo(`正在为第 ${i + 1}/${project.segments.length} 段提交口型渲染...`)
        await generateRetalk()
        break
      }
    }
  }

  async function handleConcatFullVideo() {
    if (!project || busy) return
    const readyItems: ConcatSegmentItem[] = []
    await run('视频拼接中', async signal => {
      // setConcatProgress
      for (let i = 0; i < project.segments.length; i++) {
        const seg = project.segments[i]
        const v = activeDigitalHumanVersion(seg)
        let blob = v?.videoBlob
        if (!blob && (v?.sourceVideoUrl || v?.videoUrl)) {
          for (const cand of [v.sourceVideoUrl, v.videoUrl]) {
            if (!cand || blob) continue
            try {
              const res = await fetch(resolveMediaUrl(cand), { signal })
              if (res.ok) blob = await res.blob()
            } catch {
              // ignore
            }
          }
        }
        if (!blob) {
          throw new Error(`第 ${i + 1} 段成片未能拉取到视频数据，请先确保所有段落已就绪成片。`)
        }
        const meta = await readDigitalHumanMedia(blob, 'video', signal)
        readyItems.push({
          id: seg.id,
          blob,
          duration: meta.duration || 10,
          width: meta.width || 1080,
          height: meta.height || 1920,
        })
      }

      toastInfo('正在浏览器本机无缝拼接全部段落，合成期间请保持页面打开...')
      const mergedBlob = await concatVideoBlobs(readyItems, {
        signal,
        onProgress: undefined,
      })

      const extension = mergedBlob.type.includes('webm') ? 'webm' : 'mp4'
      const url = URL.createObjectURL(mergedBlob)
      downloadUrl(url, `${project.name || 'digital-human'}-full-merged.${extension}`)
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      toastSuccess('多段视频已成功拼接并开始下载！')
    })
  }

  async function handleSelectHistoryTask(task: WorkbenchTaskRecord) {
    try {
      const raw = (await actions.getPayload(task.payloadId)) as { projectId?: string; segmentId?: string } | null
      if (raw?.projectId) {
        await model.open(raw.projectId)
        if (raw.segmentId) {
          setSelectedId(raw.segmentId)
        }
        setPreview('result')
      }
    } catch {
      // ignore
    }
    setPageView('work')
  }

  const statusLabel = (value?: string) => t(`status.${value ?? 'draft'}`, { defaultValue: value ?? t('draft') })
  const scriptText = segment?.text ?? ''
  const characterCount = countScriptCharacters(scriptText)
  const scriptDuration = resolveScriptDurationDisplay({
    text: scriptText,
    versionText: version?.text,
    audioDuration: version?.audioDuration,
  })
  const currentVoiceLabel = voices.find(v => v.id === voiceId)?.label || voiceId

  const isAudioQueued = version?.status === 'audio_queued'
  const isDubbingActive = isAudioQueued || busy === t('queueing')

  function handleDubbingButtonClick() {
    if (isDubbingActive) {
      toastInfo('当前段落配音正在后台生成中，请稍候。')
      return
    }
    if (!isDigitalHumanPortraitAuthorized(project)) {
      toastWarning('请先勾选左侧监视器下方的肖像合规授权。')
      return
    }
    if (!segment?.text.trim()) {
      toastWarning('请先在上方输入需要朗读的台词文稿。')
      return
    }
    if (pending) {
      toastWarning('当前段落正在合成口型，请等待完成后再重新配音。')
      return
    }
    void generateAudio()
  }

  function handleRetalkButtonClick() {
    if (busy) {
      toastInfo('系统正在处理素材上传，请稍候。')
      return
    }
    if (pending) {
      toastInfo('当前段落口型已在远端合成中，完成后成片将自动呈现。')
      return
    }
    if (!isDigitalHumanPortraitAuthorized(project)) {
      toastWarning('请先勾选左侧监视器下方的肖像合规授权。')
      return
    }
    if (!(project?.source || project?.sourceUrl?.trim())) {
      toastWarning('尚未绑定人物底模原视频，请先在左侧上传底模或导入示例。')
      return
    }
    if (!(version?.audio || version?.audioUrl)) {
      toastWarning('当前段落尚未生成配音，请先点击「生成音频」。')
      return
    }
    if (version.text !== segment?.text) {
      toastWarning('文案已修改，与当前配音不一致。请重新配音以保持音画同步。')
      return
    }
    if (otherRetalkActive) {
      toastWarning('当前账号已有其他口型任务正在运行，请等待完成后再提交下一段。')
      return
    }
    if (retryWait > 0) {
      toastWarning(`平台队列暂满，服务端要求等待 ${retryWait} 秒后再提交。`)
      return
    }
    void generateRetalk()
  }

  const needsAudioBeforeScene = Boolean(
    segment &&
      ((!version?.audio && !version?.audioUrl) || (version && version.text !== segment.text))
  )
  const activeShotNumber = segment && project ? project.segments.indexOf(segment) + 1 : 1
  const primaryGenerateBusyLabel = pending
    ? t('sceneGenerating')
    : isDubbingActive || busy === t('queueing')
      ? t('dubGenerating')
      : busy === t('uploading')
        ? t('uploading')
        : null
  const primaryGenerateLabel =
    primaryGenerateBusyLabel ??
    (needsAudioBeforeScene
      ? version?.audio || version?.audioUrl
        ? t('regenerateSegmentAudio')
        : t('generateSegmentAudio')
      : t('generateSegmentScene', { n: activeShotNumber }))
  const primaryGenerateDisabled = needsAudioBeforeScene
    ? isDubbingActive || pending || busy === t('uploading')
    : busy === t('uploading') || pending

  function handlePrimaryGenerateClick() {
    if (needsAudioBeforeScene) {
      handleDubbingButtonClick()
      return
    }
    handleRetalkButtonClick()
  }

  return (
    <Page
      moduleId="digital-human"
      layoutClassName="digital-human-layout"
      title={t('title')}
      description={t('description')}
      defaultWidth={1260}
      minWidth={DIGITAL_HUMAN_CONTENT_MIN_WIDTH}
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchToolPageHeaderTools>
          <WorkbenchPageViewTabs
            value={pageView}
            onChange={setPageView}
            historyBadge={pendingTasksCount}
          />
        </WorkbenchToolPageHeaderTools>
      }
      actions={
        pageView === 'history' ? (
          <WorkbenchPageChromeActions>
            <WorkbenchPageHistoryLayoutTabs layout={historyLayout} onLayoutChange={setHistoryLayout} />
          </WorkbenchPageChromeActions>
        ) : (
          <WorkbenchPageChromeActions>
            <span className="dh-save-status" role="status">
              {saved ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-500 inline mr-1" />
                  {t('saved')}
                </>
              ) : (
                t('savingLocal')
              )}
            </span>

            {project ? (
              <div className="dh-header-project-cluster">
                <Select
                  items={projects.map(item => ({
                    value: item.id,
                    label: item.name.trim() || t('untitled'),
                  }))}
                  value={project.id}
                  onValueChange={next => {
                    if (next !== null) void run(t('reading'), () => model.open(String(next)))
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="dh-header-project-select"
                    aria-label="切换口播项目"
                    disabled={!!busy}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {projects.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name.trim() || t('untitled')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="toolbar"
                        size="icon-sm"
                        className="dh-header-project-settings"
                        disabled={!!busy}
                        aria-label="项目设置"
                      />
                    }
                  >
                    <MoreHorizontal size={15} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="dh-project-settings-menu">
                    <DropdownMenuItem
                      onClick={() => {
                        setCreateProjectInput('')
                        setCreateProjectModal(true)
                      }}
                    >
                      <Plus size={14} className="mr-2" />
                      {t('newProject')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameInput(project?.name || '')
                        setRenameModal(true)
                      }}
                    >
                      <Settings2 size={14} className="mr-2" />
                      重命名当前项目
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={
                        !project ||
                        (!isDigitalHumanProjectShell(project) && digitalHumanProjectHasBusyVersions(project))
                      }
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 size={14} className="mr-2" />
                      {t('deleteProject')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </WorkbenchPageChromeActions>
        )
      }
    >
      {pageView === 'history' ? (
        <WorkbenchPageHistoryPanel layout={historyLayout} onLayoutChange={setHistoryLayout}>
          <WorkbenchTaskHistory
            items={digitalHumanTasks}
            onRemove={id => {
              void actions.removeTask(id).catch(error => toastError(apiErrorMessage(error)))
            }}
            onSelect={task => void handleSelectHistoryTask(task)}
            openLabel="在工作台查看成片"
            emptyHint="暂无数字人合成历史任务，请在「创作」面板合成口播视频"
          />
        </WorkbenchPageHistoryPanel>
      ) : (
        <div className="dh-workspace">
          {error && !error.includes('短于配音') && <Notice tone="error">{error}</Notice>}
          {demo && <Notice tone="warning">{t('demoBoundary')}</Notice>}

          {!project ? (
            <div className="dh-loading-state">
              <LoaderCircle className="animate-spin text-primary" size={28} />
              <p>{t('loading')}</p>
            </div>
          ) : (
            <>
            <div className="dh-studio-shell">
              <div className="dh-studio-stage">
              {/* 左侧：专业影视级暗室/浅色玻璃监视器 */}
              <section className="dh-monitor-column" aria-label={t('preview')}>
                <div className="dh-monitor-card">
                  <div className="dh-monitor-nav">
                    <div className="dh-monitor-tabs">
                      <button
                        type="button"
                        className="dh-monitor-tab"
                        data-active={preview === 'source'}
                        onClick={() => setPreview('source')}
                      >
                        {t('original')}
                      </button>
                      <button
                        type="button"
                        className="dh-monitor-tab"
                        data-active={preview === 'result'}
                        onClick={() => setPreview('result')}
                      >
                        {t('result')}
                        {readySegmentsCount > 0 && <span className="dh-tab-dot" />}
                      </button>
                    </div>

                    {/* 统一底模设置下拉菜单（聚合更换底模、载入示例、循环预览、高级参数） */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                            disabled={!!busy}
                            aria-label="底模设置与参数"
                          />
                        }
                      >
                        <Settings2 size={13} />
                        <span>底模设置</span>
                        <ChevronDown size={11} className="opacity-70" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="dh-menu-wide">
                        {project.source ? (
                          <>
                            <div className="px-2.5 py-1.5 text-xs">
                              <div className="font-medium text-foreground truncate max-w-[210px]">{project.source.name}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {project.source.duration.toFixed(1)} 秒 · {project.source.width} × {project.source.height}
                              </div>
                            </div>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}

                        <DropdownMenuItem onClick={() => fileSourceRef.current?.click()}>
                          <Upload size={14} className="mr-2" />
                          {project.source || project.sourceUrl ? '更换本地底模视频' : '上传本地底模视频'}
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => void handleImportDemo(false)}>
                          <Sparkles size={14} className="mr-2 text-primary" />
                          载入官方示例素材
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => void handleImportDemo(true)}>
                          <Film size={14} className="mr-2 text-primary" />
                          载入成片演示示例
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={e => {
                            e.preventDefault()
                            setLoop(prev => !prev)
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="flex items-center">
                              <RefreshCw size={14} className="mr-2" />
                              循环预览原视频
                            </span>
                            <span className={cn('text-xs font-semibold ml-2', loop ? 'text-primary' : 'text-muted-foreground')}>
                              {loop ? '已开启' : '关闭'}
                            </span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => setAdvancedModal(true)}>
                          <SlidersHorizontal size={14} className="mr-2" />
                          高级设置（人脸参考图 / 延展模式）
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="dh-monitor-assets dh-monitor-assets--result">
                    <div className="dh-monitor-screen">
                      {preview === 'source' ? (
                        hasSourceVideo ? (
                          <MediaPlayer
                            blob={project.source?.file}
                            url={project.sourceUrl}
                            kind="video"
                            label={t('original')}
                            loop={loop}
                            videoToolbar={{
                              onDelete: handleClearSourceVideo,
                              deleteLabel: t('monitorSourceDelete'),
                              disabled: !!busy || pending,
                            }}
                          />
                        ) : (
                          <div className="dh-monitor-empty">
                            <div
                              role="button"
                              tabIndex={!isDigitalHumanPortraitAuthorized(project) || busy ? -1 : 0}
                              aria-disabled={!isDigitalHumanPortraitAuthorized(project) || !!busy}
                              className="dh-monitor-dropzone"
                              onClick={() => {
                                if (!isDigitalHumanPortraitAuthorized(project) || busy) return
                                fileSourceRef.current?.click()
                              }}
                              onKeyDown={event => {
                                if (event.key !== 'Enter' && event.key !== ' ') return
                                event.preventDefault()
                                if (!isDigitalHumanPortraitAuthorized(project) || busy) return
                                fileSourceRef.current?.click()
                              }}
                            >
                              <div className="dh-monitor-empty-icon">
                                <Upload size={22} strokeWidth={1.5} />
                              </div>
                              <h4>{t('uploadYourself')}</h4>
                              <p>{t('shootingHint')}</p>
                              <p className="dh-monitor-empty__limits">{t('sourceLimits')}</p>
                              <div className="dh-monitor-empty__actions">
                                <span className="dh-dropzone-cta">{t('sourceFile')}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="dh-dropzone-cta dh-dropzone-cta--demo"
                                  disabled={!!busy}
                                  onClick={event => {
                                    event.stopPropagation()
                                    void handleImportDemo(false)
                                  }}
                                >
                                  <Sparkles size={13} className="text-primary" />
                                  官方示例
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (version?.sourceVideoUrl || version?.videoUrl || version?.videoBlob) ? (
                        <MediaPlayer
                          blob={version.videoBlob}
                          url={version.videoUrl}
                          sourceVideoUrl={version.sourceVideoUrl}
                          kind="video"
                          label={t('result')}
                          videoToolbar={{
                            onDownload: () => void downloadVersion(),
                            downloadLabel: t('download'),
                            retentionHint: t('retention'),
                            hintOpen: retentionHintOpen,
                            onToggleHint: () => setRetentionHintOpen(open => !open),
                            showHintDot: true,
                            disabled: !!busy || pending,
                          }}
                        />
                      ) : version?.status === 'expired' ? (
                        <div className="dh-monitor-empty dh-monitor-empty--result" style={{ padding: 24, textAlign: 'center' }}>
                          <Film size={34} strokeWidth={1.25} className="text-destructive/60 mb-2 mx-auto" />
                          <p style={{ fontWeight: 600, color: 'var(--destructive)', fontSize: 13, marginBottom: 4 }}>
                            {t('expired')}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', maxWidth: 320, margin: '0 auto 12px', lineHeight: 1.5 }}>
                            {version?.error || t('retention')}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending || !!busy}
                            onClick={() => {
                              if (segment?.id && version?.id) {
                                patchVersion(segment.id, version.id, {
                                  status: 'draft',
                                  error: undefined,
                                  videoUrl: undefined,
                                  sourceVideoUrl: undefined,
                                  videoBlob: undefined,
                                })
                              }
                            }}
                          >
                            <RefreshCw size={13} className="mr-1.5" /> 重新生成
                          </Button>
                        </div>
                      ) : (
                        <div className="dh-monitor-empty dh-monitor-empty--result">
                          {version?.status === 'succeeded' && version.localTaskId ? (
                            <>
                              <Film size={34} strokeWidth={1.25} />
                              <h4>生成已完成，暂未取得成片地址</h4>
                              <p>请刷新原任务查询结果，无需重新提交。</p>
                              <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => {
                                void run(t('refreshing'), async () => {
                                  await actions.refreshRetalkTask(version.localTaskId!)
                                  model.refreshResults()
                                })
                              }}>刷新任务</Button>
                            </>
                          ) : pending && version ? (
                            <RetalkProgressMonitor
                              version={version}
                              audioDuration={version.audioDuration}
                              remote={retalkRemote}
                              onRefresh={() => {
                                if (version.localTaskId) {
                                  void run(t('refreshing'), async () => {
                                    await actions.refreshRetalkTask(version.localTaskId!)
                                    model.refreshResults()
                                    if (activeRetalkJob?.payloadId) {
                                      const raw = await actions.getPayload(activeRetalkJob.payloadId)
                                      const p = raw as DigitalHumanRetalkPayload | null
                                      if (p?.result) setRetalkRemote(p.result)
                                    }
                                  })
                                }
                              }}
                            />
                          ) : (
                            <>
                              <Film size={34} strokeWidth={1.25} />
                              <h4>{statusLabel(version?.status)}</h4>
                              <p>{t('resultEmpty')}</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2 text-xs gap-1.5"
                                disabled={!!busy}
                                onClick={() => void handleImportDemo(true)}
                              >
                                <Sparkles size={13} className="text-primary" />
                                载入成片演示示例
                              </Button>
                            </>
                          )}
                        </div>
                      )}

                      {preview === 'result' && version ? (
                        <div className="dh-monitor-badge">
                          <span className="dh-pulse-dot" />
                          {statusLabel(version.status)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={cn(
                      'dh-monitor-dock dh-monitor-dock--footer',
                      !project.source && !project.sourceUrl?.trim() && 'dh-monitor-dock--auth-only',
                    )}
                  >
                    <div className="dh-monitor-dock__footer">
                      <div className="dh-monitor-dock__meta">
                        {preview !== 'source' && version && (version.sourceVideoUrl || version.videoUrl || version.videoBlob) ? (
                          <p className="dh-monitor-dock__caption">
                            <span className="truncate" title={t('result')}>
                              {version.sourceName?.trim() || t('result')}
                            </span>
                            {version.audioDuration || resultVideoByteSize ? (
                              <span className="dh-monitor-dock__caption-meta">
                                {[
                                  version.audioDuration ? `${Math.round(version.audioDuration)}s` : null,
                                  resultVideoByteSize ? `${(resultVideoByteSize / 1024 / 1024).toFixed(1)} MB` : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="dh-monitor-dock__actions">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="dh-auth-pill-hover-wrap inline-flex">
                                <label
                                  className="dh-auth-pill dh-auth-pill--dock"
                                  data-authorized={portraitAuthorized}
                                  data-source-ready={hasSourceVideo ? 'true' : 'false'}
                                >
                                  <input
                                    type="checkbox"
                                    checked={portraitAuthorized}
                                    disabled={!!busy}
                                    onChange={event =>
                                      update(previous => ({ ...previous, authorized: event.target.checked }))
                                    }
                                  />
                                  <ShieldCheck size={13} />
                                  <span>{portraitAuthorized ? '肖像合规' : '待授权'}</span>
                                </label>
                              </span>
                            }
                          />
                          <TooltipContent side="top">{portraitAuthTooltip}</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <ColumnDivider
                className="dh-studio-stage__divider"
                previewSelector=".dh-monitor-column"
                widthVariable="--dh-monitor-width"
                defaultWidth={420}
                minWidth={280}
                minMainWidth={320}
                maxPreviewRatio={0.5}
                label={t('monitorColumnDivider')}
              />

              {/* 右侧：文稿、分镜与录音编辑器 */}
              <div className="dh-editor-column">
                {/* 沉浸式文稿写作与配音核心卡片 */}
                {segment && (
                  <div className="dh-script-card">
                    <section className="dh-dub-settings" aria-labelledby="dh-dub-settings-title">
                      <div className="dh-dub-settings__head">
                        <div className="dh-dub-settings__shot flex items-center gap-2 min-w-0 flex-1">
                          <span className="dh-shot-tag">SHOT {project.segments.indexOf(segment) + 1}</span>
                          <h3 id="dh-dub-settings-title" className="truncate min-w-0 flex-1">
                            第 {project.segments.indexOf(segment) + 1} 镜 · 台词与口播配音
                          </h3>
                          <DigitalHumanDubModeMenu
                            t={t}
                            busy={!!busy}
                            pending={pending}
                            dubSourceMode={dubSourceMode}
                            onDubSourceModeChange={setDubSourceMode}
                          />
                        </div>
                        <div className="dh-dub-settings__controls">
                          {dubSourceMode === 'ai' ? (
                            <DigitalHumanVoiceFooterMenu
                              t={t}
                              busy={!!busy}
                              pending={pending}
                              isDubbingActive={isDubbingActive}
                              hasAudio={Boolean(version?.audio || version?.audioUrl)}
                              voices={voices}
                              voiceId={voiceId}
                              onVoiceIdChange={id => update(previous => ({ ...previous, voiceId: id }))}
                              currentVoiceLabel={currentVoiceLabel}
                              onGenerateDub={handleDubbingButtonClick}
                            />
                          ) : null}
                        </div>
                      </div>
                    </section>

                    {dubSourceMode === 'ai' ? (
                      <div
                        className="dh-script-editor-wrap"
                        data-dub-dock={segmentHasDubAudio && !scriptDubDockCollapsed ? 'open' : undefined}
                      >
                        <Textarea
                          ref={scriptTextareaRef}
                          className="dh-script-textarea focus-visible:border-transparent focus-visible:ring-0"
                          value={segment.text}
                          disabled={!!busy}
                          onPaste={event => {
                            const pasted = event.clipboardData.getData('text/plain')
                            const input = event.currentTarget
                            const combined = input.value.slice(0, input.selectionStart) + pasted + input.value.slice(input.selectionEnd)
                            if (countScriptCharacters(combined) <= DIGITAL_HUMAN_SCRIPT_LIMIT) return
                            event.preventDefault()
                            if (pending) {
                              toastWarning('当前段落正在生成，请完成后再拆分长文。')
                              return
                            }
                            const parts = splitDigitalHumanScript(combined)
                            if (!parts.length) return
                            update(previous => ({
                              ...previous,
                              segments: previous.segments.flatMap(item => item.id === segment.id
                                ? [{ ...item, text: parts[0].text, activeVersionId: undefined }, ...parts.slice(1)]
                                : [item]),
                            }))
                            toastInfo(`长文已拆分为 ${parts.length} 段，可逐段编辑和排序。`)
                          }}
                          onChange={event => {
                            const text = event.target.value
                            if (countScriptCharacters(text) > DIGITAL_HUMAN_SCRIPT_LIMIT && countScriptCharacters(text) > countScriptCharacters(segment.text)) {
                              toastWarning('单段最多 350 字，长文可直接粘贴后自动拆分。')
                              return
                            }
                            changeSegment(previous => ({ ...previous, text, activeVersionId: undefined }))
                          }}
                          placeholder={t('scriptPlaceholder')}
                        />
                        {segmentHasDubAudio && !scriptDubDockCollapsed ? (
                          <ScriptDubPreviewDock
                            collapsed={false}
                            onCollapsedChange={setScriptDubDockCollapsed}
                            expandLabel={t('listen')}
                            collapseLabel={t('scriptDubDockCollapse')}
                            deleteLabel={t('scriptDubDockDelete')}
                            deleteDisabled={!!busy || pending}
                            onDelete={handleClearSegmentDub}
                            audioPreview={({ collapse, delete: deleteControl }) => (
                              <MediaPlayer
                                blob={version?.audio}
                                url={version?.audioUrl}
                                kind="audio"
                                label={version?.voiceLabel?.trim() || t('dubReady')}
                                endAction={
                                  <>
                                    {collapse}
                                    {deleteControl}
                                  </>
                                }
                              />
                            )}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <DigitalHumanImportDubPanel
                        t={t}
                        busy={!!busy}
                        pending={pending}
                        hasAudio={Boolean(version?.audio || version?.audioUrl)}
                        audioPreview={
                          version?.audio || version?.audioUrl ? (
                            <MediaPlayer
                              blob={version.audio}
                              url={version.audioUrl}
                              kind="audio"
                              label={version.voiceLabel?.trim() || t('dubReady')}
                              endAction={
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="dh-import-dub-panel__delete dh-studio-player__mute-btn size-7 shrink-0 px-0 text-destructive hover:text-destructive"
                                        aria-label={t('scriptDubDockDelete')}
                                        disabled={!!busy || pending}
                                        onClick={handleClearSegmentDub}
                                      >
                                        <Trash2 size={14} aria-hidden />
                                      </Button>
                                    }
                                  />
                                  <TooltipContent side="top">{t('scriptDubDockDelete')}</TooltipContent>
                                </Tooltip>
                              }
                            />
                          ) : null
                        }
                        onOpenWorkshop={() => setVoiceLibraryOpen(true)}
                        onUploadClick={() => fileAudioRef.current?.click()}
                        onOpenAudioUrl={() => setShowAudioUrlModal(true)}
                        onImportDemo={() => void handleImportDemoAudioOnly()}
                      />
                    )}

                    {/* 文案与已录制音频不匹配时的提示 */}
                    {dubSourceMode === 'ai' && version?.audio && version.text !== segment.text && (
                      <div className="dh-script-mismatch-banner">
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                          <RotateCcw size={13} className="flex-shrink-0" />
                          <span>文案已修改，与当前配音不一致。请重新配音或恢复此前文案。</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                          disabled={!!busy}
                          onClick={() => changeSegment(previous => ({ ...previous, text: version.text }))}
                        >
                          {t('restoreVersionText')}
                        </Button>
                      </div>
                    )}

                    {voiceError && <Notice tone="warning">{voiceError}</Notice>}

                    {dubSourceMode === 'ai' ? (
                      <div className="dh-script-console">
                        <div className="dh-script-editor-foot">
                          <div
                            className={cn(
                              'dh-script-meta-bar',
                              !hasSourceVideo && 'dh-script-meta-bar--awaiting-source',
                            )}
                          >
                            <span className="dh-script-meta-item">
                              <strong>{characterCount}</strong> 字
                            </span>
                            {hasSourceVideo ? (
                              <>
                                <span className="dh-script-meta-divider" />
                                <span className="dh-script-meta-item flex items-center gap-1">
                                  <Clock size={11} className="opacity-70" aria-hidden />
                                  {scriptDuration.approximate ? '~' : ''}
                                  {scriptDuration.seconds} 秒
                                </span>
                                <span className="dh-script-meta-divider" />
                                <span className="dh-script-meta-item dh-script-meta-credits flex items-center gap-1">
                                  <Coins size={11} className="text-amber-500" aria-hidden />
                                  配音 <strong>{estimateVoiceCredits(characterCount)}</strong>
                                </span>
                                <span className="dh-script-meta-divider" />
                                <span className="dh-script-meta-item dh-script-meta-credits flex items-center gap-1">
                                  <Film size={11} className="text-primary opacity-80" aria-hidden />
                                  合成{' '}
                                  <strong>
                                    {estimateRetalkCredits(version?.audioDuration ?? scriptDuration.seconds)}
                                  </strong>
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="dh-script-meta-divider" />
                                <span className="dh-script-meta-item dh-script-meta-awaiting-source">
                                  {t('scriptMetaAwaitingSource')}
                                </span>
                              </>
                            )}
                            {segmentHasDubAudio && scriptDubDockCollapsed ? (
                              <ScriptDubPreviewDock
                                collapsed
                                onCollapsedChange={setScriptDubDockCollapsed}
                                expandLabel={t('listen')}
                                collapseLabel={t('scriptDubDockCollapse')}
                                audioPreview={
                                  <MediaPlayer
                                    blob={version?.audio}
                                    url={version?.audioUrl}
                                    kind="audio"
                                    label={version?.voiceLabel?.trim() || t('dubReady')}
                                  />
                                }
                              />
                            ) : null}
                          </div>
                          <div className="dh-script-editor-foot__actions flex items-center gap-2 shrink-0">
                            <DigitalHumanPersonaChipShell>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <button type="button" className={digitalHumanPersonaChipButtonClass} data-bound="true">
                                      <FileText size={14} aria-hidden />
                                      <span className="persona-injection__text">{t('scriptTools')}</span>
                                      <ChevronDown className="wb-disclosure-chevron shrink-0" size={14} aria-hidden />
                                    </button>
                                  }
                                />
                                <DropdownMenuContent align="end" className="dh-menu-wide">
                                  <DropdownMenuItem onClick={() => fileDocRef.current?.click()}>
                                    <Upload size={14} className="mr-2" />
                                    导入文档（.txt / .md / .docx）
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void handleImportDemo(false)}>
                                    <Sparkles size={14} className="mr-2 text-primary" />
                                    导入官方示例（底模+配音+台词）
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!segment.text.trim() || (countScriptCharacters(segment.text) <= DIGITAL_HUMAN_SCRIPT_LIMIT && !/\n\s*\n/.test(segment.text)) || !!busy || pending}
                                    onClick={() => {
                                      const parts = splitDigitalHumanScript(segment.text)
                                      update(previous => ({
                                        ...previous,
                                        segments: previous.segments.flatMap(item =>
                                          item.id === segment.id
                                            ? [{ ...item, text: parts[0]?.text ?? item.text, activeVersionId: undefined }, ...parts.slice(1)]
                                            : [item]
                                        )
                                      }))
                                    }}
                                  >
                                    <Scissors size={14} className="mr-2" />
                                    {t('splitParagraphs')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setImportMode('script')
                                      setSelectedImport('')
                                    }}
                                  >
                                    <FolderOpen size={14} className="mr-2" />
                                    从脚本创作历史导入
                                  </DropdownMenuItem>
                                  {project.segments.length > 1 ? (
                                    <DropdownMenuItem
                                      disabled={!!busy || pending}
                                      onClick={() => void handleBatchGenerateAll()}
                                    >
                                      <Sparkles size={14} className="mr-2 text-primary" />
                                      一键顺序生成整篇（配音与口型）
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </DigitalHumanPersonaChipShell>
                          </div>
                        </div>
                        <div className="dh-retalk-decision-box dh-retalk-decision-box--merged">
                          <Button
                            variant="generate"
                            className="dh-action-generate dh-action-generate--compact"
                            title={needsAudioBeforeScene ? t('generateSegmentAudio') : t('generateRetalk')}
                            disabled={primaryGenerateDisabled}
                            onClick={handlePrimaryGenerateClick}
                          >
                            {primaryGenerateBusyLabel ? (
                              <LoaderCircle size={16} className="animate-spin" />
                            ) : needsAudioBeforeScene ? (
                              <Mic size={16} />
                            ) : (
                              <Video size={16} />
                            )}
                            <span>{primaryGenerateLabel}</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="dh-retalk-decision-box dh-retalk-decision-box--import">
                        <Button
                          variant="generate"
                          className="dh-action-generate dh-action-generate--compact"
                          title={needsAudioBeforeScene ? t('generateSegmentAudio') : t('generateRetalk')}
                          disabled={primaryGenerateDisabled}
                          onClick={handlePrimaryGenerateClick}
                        >
                          {primaryGenerateBusyLabel ? (
                            <LoaderCircle size={16} className="animate-spin" />
                          ) : needsAudioBeforeScene ? (
                            <Mic size={16} />
                          ) : (
                            <Video size={16} />
                          )}
                          <span>{primaryGenerateLabel}</span>
                        </Button>
                        {version?.localTaskId ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="dh-retalk-decision__refresh size-9 shrink-0"
                              aria-label={t('refresh')}
                              disabled={!!busy}
                              onClick={() =>
                                void run(t('refreshing'), async () => {
                                  await actions.refreshRetalkTask(version.localTaskId!)
                                  model.refreshResults()
                                })
                              }
                            >
                              <RefreshCw size={15} aria-hidden />
                            </Button>
                            {['QUEUED', 'queued'].includes(version.status ?? '') ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 shrink-0 text-xs text-destructive"
                                disabled={!!busy}
                                onClick={() => void run(t('cancelling'), () => actions.cancelTask(version.localTaskId!))}
                              >
                                {t('cancelQueued')}
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    )}

                    {otherRetalkActive && <Notice>{t('otherTaskActive')}</Notice>}
                    {retryWait > 0 && <Notice tone="warning">{t('retryCountdown', { seconds: retryWait })}</Notice>}
                    {version?.submissionUncertain && version.localTaskId && (
                      <Notice tone="warning">
                        {t('uncertainHint')}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!!busy}
                          onClick={() =>
                            void run(t('refreshing'), async () => {
                              await actions.retryDigitalHumanRetalk(version.localTaskId!)
                              model.refreshResults()
                            })
                          }
                        >
                          {t('confirmOriginalSubmission')}
                        </Button>
                      </Notice>
                    )}
                    {version?.error && <Notice tone="warning">{version.error}</Notice>}
                    {version && ['FAILED', 'EXPIRED', 'failed', 'cancelled', 'CANCELED'].includes(version.status ?? '') && (
                      <Notice tone="warning">{t('regenerateHint')}</Notice>
                    )}

                  </div>
                )}

              </div>
              </div>
            </div>

            <DigitalHumanTimelineRail
              segments={project.segments}
              selectedSegmentId={segment?.id}
              readySegmentsCount={readySegmentsCount}
              busy={busy}
              statusLabel={statusLabel}
              onUpdateProject={update}
              onConcatFullVideo={handleConcatFullVideo}
              isConcatenating={isConcatenating}
              onSelectSegment={id => {
                setSelectedId(id)
                const selected = project.segments.find(item => item.id === id)
                const selectedVersion = selected ? activeDigitalHumanVersion(selected) : undefined
                setPreview(selectedVersion && !selectedVersion.resultCleared && (selectedVersion.sourceVideoUrl || selectedVersion.videoUrl || selectedVersion.videoBlob || ACTIVE.includes(selectedVersion.status ?? '')) ? 'result' : 'source')
                focusScriptEditor()
              }}
              onOpenTaskHistory={() => setPageView('history')}
            />
            </>
          )}
        </div>
      )}

      {/* 隐藏的专用文件选择 input */}
      <input
        ref={fileSourceRef}
        type="file"
        accept=".mp4,.mov,.avi"
        hidden
        disabled={!isDigitalHumanPortraitAuthorized(project) || !!busy}
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          void selectSource(file)
        }}
      />
      <input
        ref={fileDocRef}
        type="file"
        accept=".txt,.md,.docx"
        hidden
        disabled={!!busy}
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file && project) {
            void run(t('reading'), async signal => {
              const text = await extractDocumentText(file)
              ensureCurrent(project.id, project.ownerUserId, signal)
              changeSegment(previous => ({ ...previous, text, activeVersionId: undefined }))
            })
          }
        }}
      />
      <input
        ref={fileAudioRef}
        type="file"
        accept=".wav,.mp3,.aac,.m4a"
        hidden
        disabled={!!busy || !isDigitalHumanPortraitAuthorized(project)}
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          void uploadAudio(file)
        }}
      />
      <input
        ref={fileRefImageRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.bmp"
        hidden
        disabled={!isDigitalHumanPortraitAuthorized(project) || !!busy}
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          void selectReference(file)
        }}
      />

      {/* 配音工坊历史选片库弹窗 */}
      <Dialog open={voiceLibraryOpen} onOpenChange={setVoiceLibraryOpen}>
        <DialogContent className="dh-voice-lib-dialog max-w-[26rem] max-h-[min(85vh,32rem)] flex flex-col gap-3 p-4 sm:p-5">
          <DialogHeader className="gap-1 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Headphones size={16} className="text-primary shrink-0" aria-hidden />
              配音工坊录音
            </DialogTitle>
            <DialogDescription className="text-xs leading-snug">
              试听并选用历史配音，注入当前镜头
            </DialogDescription>
          </DialogHeader>

          <div className="dh-voice-lib-scroll">
            {!voiceWorkshopTasks.length ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                <Mic size={20} className="mx-auto mb-1.5 opacity-40" aria-hidden />
                暂无可用配音记录
              </div>
            ) : (
              voiceWorkshopTasks.map(task => (
                <VoiceWorkshopTaskItem
                  key={task.id}
                  task={task}
                  onApply={(blob, text, voiceLabel, duration, applyText) =>
                    applyVoiceWorkshopTake(blob, text, voiceLabel, duration, applyText)
                  }
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AdvancedSourceSettingsDialog
        open={advancedModal}
        onOpenChange={setAdvancedModal}
        project={project}
        busy={!!busy}
        onUpdate={update}
        onPickReferenceFile={() => fileRefImageRef.current?.click()}
      />

      {/* 新建项目 */}
      <Dialog open={createProjectModal} onOpenChange={setCreateProjectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newProject')}</DialogTitle>
            <DialogDescription>为新的口播项目填写名称，创建后将自动切换至该项目</DialogDescription>
          </DialogHeader>
          <Input
            value={createProjectInput}
            maxLength={80}
            placeholder={t('projectNamePlaceholder')}
            autoFocus
            onChange={e => setCreateProjectInput(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return
              const name = createProjectInput.trim()
              if (!name) return
              void run(t('saving'), () => model.create(name))
              setCreateProjectModal(false)
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateProjectModal(false)}>
              取消
            </Button>
            <Button
              variant="default"
              disabled={!createProjectInput.trim()}
              onClick={() => {
                const name = createProjectInput.trim()
                if (!name) return
                void run(t('saving'), () => model.create(name))
                setCreateProjectModal(false)
              }}
            >
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 项目重命名弹窗 */}
      <Dialog open={renameModal} onOpenChange={setRenameModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名项目</DialogTitle>
            <DialogDescription>修改当前数字人项目的显示名称</DialogDescription>
          </DialogHeader>
          <Input
            value={renameInput}
            maxLength={80}
            placeholder={t('projectNamePlaceholder')}
            onChange={e => setRenameInput(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRenameModal(false)}>
              取消
            </Button>
            <Button
              variant="default"
              onClick={() => {
                const nextName = renameInput.trim() || t('untitled')
                update(prev => ({ ...prev, name: nextName }))
                if (project?.id) {
                  void actions.updateProjectTasksTitle(project.id, nextName)
                }
                setRenameModal(false)
              }}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 历史任务导入弹窗 */}
      <Dialog
        open={importMode !== null}
        onOpenChange={open => {
          if (!open) setImportMode(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{importMode === 'script' ? t('importScript') : t('chooseAudio')}</DialogTitle>
            <DialogDescription>{t('historyHint')}</DialogDescription>
          </DialogHeader>
          <SelectField
            label={t('history')}
            value={selectedImport}
            onChange={setSelectedImport}
            options={[
              { value: '', label: t('chooseOne') },
              ...importTasks.map(task => ({
                value: task.id,
                label: `${task.title} · ${new Date(task.createdAt).toLocaleDateString()}`
              }))
            ]}
          />
          <Button disabled={!selectedImport || !!busy} onClick={() => void importHistory()}>
            {t('import')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* 网络音频 URL 弹窗 */}
      <Dialog open={showAudioUrlModal} onOpenChange={setShowAudioUrlModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('publicAudioUrl')}</DialogTitle>
            <DialogDescription>输入可公开跨域访问的音频直链（.wav / .mp3）</DialogDescription>
          </DialogHeader>
          <Field label={t('publicAudioUrl')}>
            <Input
              value={audioUrlInput}
              disabled={!!busy}
              placeholder="https://example.com/audio.mp3"
              onChange={event => setAudioUrlInput(event.target.value)}
            />
          </Field>
          <Button disabled={!audioUrlInput.trim() || !!busy} onClick={() => void useAudioUrl()}>
            {t('usePublicAudio')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* 删除项目确认弹窗 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteProject')}</DialogTitle>
            <DialogDescription>{t('deleteProjectHint')}</DialogDescription>
          </DialogHeader>
          <Button
            variant="destructive"
            onClick={() =>
              void run(t('saving'), async () => {
                await model.remove()
                setDeleteOpen(false)
              })
            }
          >
            {t('confirmDelete')}
          </Button>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
