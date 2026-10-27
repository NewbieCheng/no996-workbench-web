import { assertRetalkReference } from '../../api/video-retalk'
import { isVoiceSpeed, VOICE_SPEED_MAX, VOICE_SPEED_MIN } from '../../lib/voice-speed'
import { requireTaskLocks, withTaskLock } from './task-locks'
import { WORKBENCH_TASKS_DB } from './idb-health'
import { WORKBENCH_TASKS_DB_VERSION } from './idb-store-health'
import { readLegacyVoiceTts } from './migrate-voice-tts'
import { canTransition, newTaskId, planPruneForUser, pickNextQueuedJob } from './queue-logic.ts'
import type { WorkbenchTaskRepository } from './repository'
import {
  TASK_LIMITS,
  type IPVideoAudioPayload,
  type IPVideoCreatePayload,
  type PersonaGeneratePayload,
  type ScriptTaskPayload,
  type TaskBlobRecord,
  type TaskPayloadRecord,
  type TitlesTaskPayload,
  type MomentsPlanTaskPayload,
  type MomentsCopyTaskPayload,
  type VoiceClonePayload,
  type VoiceDubAdvancedPayload,
  type EnqueueVideoFactoryExportInput,
  type VideoFactoryExportPayload,
  type VoiceTtsPayload,
  type WorkbenchTaskRecord,
} from './types'

const DB_NAME = WORKBENCH_TASKS_DB
// 版本号从 idb-health 统一导出，避免健康检查与写入方各写一份而漂移。
// v3：新增 script_generate 任务类型（store 结构未变，仅触发 upgrade 走一次 ensureMainSchema）
const DB_VERSION = WORKBENCH_TASKS_DB_VERSION
const STORE_JOBS = 'jobs'
const STORE_BLOBS = 'blobs'
const STORE_PAYLOADS = 'payloads'
const META_KEY = '__migrated_voice_tts_v1'

function ensureMainSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_JOBS)) {
    const store = db.createObjectStore(STORE_JOBS, { keyPath: 'id' })
    store.createIndex('by_owner_created', ['ownerUserId', 'createdAt'], { unique: false })
    store.createIndex('by_status', 'status', { unique: false })
  }
  if (!db.objectStoreNames.contains(STORE_BLOBS)) {
    db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(STORE_PAYLOADS)) {
    db.createObjectStore(STORE_PAYLOADS, { keyPath: 'id' })
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('打开后台任务本地库失败'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      ensureMainSchema(req.result)
    }
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('后台任务本地库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('后台任务本地库事务中止'))
  })
}

function isJob(value: unknown): value is WorkbenchTaskRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.ownerUserId === 'number' &&
    typeof r.kind === 'string' &&
    typeof r.status === 'string' &&
    typeof r.createdAt === 'number' &&
    typeof r.title === 'string' &&
    typeof r.route === 'string' &&
    typeof r.payloadId === 'string'
  )
}

async function getAllJobs(db: IDBDatabase): Promise<WorkbenchTaskRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOBS, 'readonly')
    const req = tx.objectStore(STORE_JOBS).getAll()
    req.onsuccess = () => resolve((req.result as unknown[]).filter(isJob))
    req.onerror = () => reject(req.error ?? new Error('读取后台任务失败'))
  })
}

let migrationPromise: Promise<void> | null = null

export function createIndexedDbWorkbenchTaskRepository(): WorkbenchTaskRepository {
  const repo: WorkbenchTaskRepository = {
    async ensureMigrated() {
      if (!migrationPromise) {
        migrationPromise = (async () => {
          const db = await openDb()
          const flag = await new Promise<string | null>((resolve, reject) => {
            const tx = db.transaction(STORE_PAYLOADS, 'readonly')
            const req = tx.objectStore(STORE_PAYLOADS).get(META_KEY)
            req.onsuccess = () => {
              const v = req.result as TaskPayloadRecord | undefined
              resolve(v && typeof v.data === 'string' ? v.data : null)
            }
            req.onerror = () => reject(req.error)
          })
          if (flag === 'done') return
          const legacy = await readLegacyVoiceTts()
          // Write META / import rows via openDb transactions only — never call
          // putPayload/putJob here: those await ensureMigrated and would deadlock
          // on the in-flight migrationPromise.
          if (legacy.jobs.length === 0) {
            const markTx = db.transaction(STORE_PAYLOADS, 'readwrite')
            markTx.objectStore(STORE_PAYLOADS).put({
              id: META_KEY,
              kind: 'voice_tts',
              data: 'done',
            })
            await txDone(markTx)
            return
          }
          const existing = await getAllJobs(db)
          const existingIds = new Set(existing.map((j) => j.id))
          const tx = db.transaction([STORE_JOBS, STORE_BLOBS, STORE_PAYLOADS], 'readwrite')
          for (const job of legacy.jobs) {
            if (existingIds.has(job.id)) continue
            tx.objectStore(STORE_JOBS).put(job)
          }
          for (const p of legacy.payloads) {
            tx.objectStore(STORE_PAYLOADS).put(p)
          }
          for (const b of legacy.blobs) {
            tx.objectStore(STORE_BLOBS).put(b)
          }
          tx.objectStore(STORE_PAYLOADS).put({ id: META_KEY, kind: 'voice_tts', data: 'done' })
          await txDone(tx)
        })().catch((err) => {
          migrationPromise = null
          throw err
        })
      }
      await migrationPromise
    },

    async putJob(job) {
      await repo.ensureMigrated()
      const db = await openDb()
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      tx.objectStore(STORE_JOBS).put(job)
      await txDone(tx)
    },

    async patchJob(id, patch) {
      await repo.ensureMigrated()
      const db = await openDb()
      const existing = await new Promise<WorkbenchTaskRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_JOBS, 'readonly')
        const req = tx.objectStore(STORE_JOBS).get(id)
        req.onsuccess = () => resolve(isJob(req.result) ? req.result : null)
        req.onerror = () => reject(req.error)
      })
      if (!existing) return null
      if (patch.status && !canTransition(existing.status, patch.status)) {
        throw new Error(`非法任务状态: ${existing.status} → ${patch.status}`)
      }
      const next: WorkbenchTaskRecord = { ...existing, ...patch }
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      tx.objectStore(STORE_JOBS).put(next)
      await txDone(tx)
      return next
    },

    async getJob(id) {
      await repo.ensureMigrated()
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_JOBS, 'readonly')
        const req = tx.objectStore(STORE_JOBS).get(id)
        req.onsuccess = () => resolve(isJob(req.result) ? req.result : null)
        req.onerror = () => reject(req.error)
      })
    },

    async listJobsForUser(ownerUserId) {
      const all = await repo.listAllJobs()
      return all
        .filter((j) => j.ownerUserId === ownerUserId)
        .sort((a, b) => b.createdAt - a.createdAt)
    },

    async listAllJobs() {
      await repo.ensureMigrated()
      const db = await openDb()
      return getAllJobs(db)
    },

    async deleteJob(id) {
      await repo.ensureMigrated()
      const job = await repo.getJob(id)
      const db = await openDb()
      const tx = db.transaction([STORE_JOBS, STORE_BLOBS, STORE_PAYLOADS], 'readwrite')
      tx.objectStore(STORE_JOBS).delete(id)
      tx.objectStore(STORE_BLOBS).delete(id)
      if (job?.payloadId) tx.objectStore(STORE_PAYLOADS).delete(job.payloadId)
      await txDone(tx)
    },

    async updateTasksTitleByProjectId(ownerUserId, projectId, title) {
      if (!projectId || !title) return
      await repo.ensureMigrated()
      const db = await openDb()
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      const store = tx.objectStore(STORE_JOBS)
      const req = store.getAll()
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const jobs = (req.result as WorkbenchTaskRecord[]) || []
          for (const job of jobs) {
            if (job.ownerUserId === ownerUserId && job.meta?.projectId === projectId) {
              if (job.title !== title) {
                store.put({ ...job, title })
              }
            }
          }
          resolve()
        }
        req.onerror = () => reject(req.error)
      })
      await txDone(tx)
    },

    async putPayload(payload) {
      await repo.ensureMigrated()
      const db = await openDb()
      const tx = db.transaction(STORE_PAYLOADS, 'readwrite')
      tx.objectStore(STORE_PAYLOADS).put(payload)
      await txDone(tx)
    },

    async getPayload(id) {
      await repo.ensureMigrated()
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PAYLOADS, 'readonly')
        const req = tx.objectStore(STORE_PAYLOADS).get(id)
        req.onsuccess = () => {
          const v = req.result as TaskPayloadRecord | undefined
          if (!v || typeof v.id !== 'string') {
            resolve(null)
            return
          }
          resolve(v)
        }
        req.onerror = () => reject(req.error)
      })
    },

    async patchPayload(id, data) {
      const existing = await repo.getPayload(id)
      if (!existing) return
      await repo.putPayload({ ...existing, data })
    },

    async putBlob(blob) {
      await repo.ensureMigrated()
      try {
        const db = await openDb()
        const tx = db.transaction(STORE_BLOBS, 'readwrite')
        tx.objectStore(STORE_BLOBS).put(blob)
        await txDone(tx)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          throw new Error('本机存储空间不足，请删除部分历史记录后重试。')
        }
        throw e
      }
    },

    async getBlob(id) {
      await repo.ensureMigrated()
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly')
        const req = tx.objectStore(STORE_BLOBS).get(id)
        req.onsuccess = () => {
          const v = req.result as TaskBlobRecord | undefined
          if (!v || typeof v.id !== 'string' || !(v.data instanceof ArrayBuffer)) {
            resolve(null)
            return
          }
          resolve(v)
        }
        req.onerror = () => reject(req.error)
      })
    },

    async pickNextQueued(ownerUserId) {
      const jobs = await repo.listAllJobs()
      return pickNextQueuedJob(jobs, ownerUserId)
    },

    async resetStaleRunning(maxAgeMs, ownerUserId) {
      await repo.ensureMigrated()
      const db = await openDb()
      const jobs = await getAllJobs(db)
      const now = Date.now()
      let count = 0
      const payloadIdsToClear: string[] = []
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      const store = tx.objectStore(STORE_JOBS)
      for (const job of jobs) {
        if (job.status !== 'running' || job.kind === 'digital_human_retalk' || (ownerUserId !== undefined && job.ownerUserId !== ownerUserId)) continue
        const started = job.startedAt ?? job.createdAt
        const stale = maxAgeMs <= 0 || now - started > maxAgeMs
        if (stale) {
          if (job.kind === 'video_factory_export') {
            store.put({
              ...job,
              status: 'failed',
              finishedAt: now,
              startedAt: undefined,
              errorMessage: '页面已刷新或关闭，浏览器合成已中断，请重新导出',
            })
          } else {
            store.put({ ...job, status: 'queued', startedAt: undefined })
          }
          // Creation plans cannot be resumed from arbitrary stages. Keep their
          // checkpoints so recovery can fail safely instead of repeating paid work.
          if (job.kind !== 'ip_video_create' && job.kind !== 'video_factory_export') payloadIdsToClear.push(job.payloadId)
          count += 1
        }
      }
      await txDone(tx)
      for (const payloadId of payloadIdsToClear) {
        const rec = await repo.getPayload(payloadId)
        const data = rec?.data
        if (!data || typeof data !== 'object' || !('run' in data)) continue
        const next = { ...(data as Record<string, unknown>) }
        delete next.run
        await repo.patchPayload(payloadId, next)
      }
      return count
    },

    async pruneForUser(ownerUserId) {
      await repo.ensureMigrated()
      const db = await openDb()
      const jobs = await getAllJobs(db)
      const blobBytes = new Map<string, number>()
      for (const j of jobs) {
        if (j.blobId && j.audioByteLength) blobBytes.set(j.blobId, j.audioByteLength)
      }
      const plan = planPruneForUser({
        jobs,
        blobBytes,
        ownerUserId,
        now: Date.now(),
      })
      if (plan.deleteJobIds.length === 0) return
      const tx = db.transaction([STORE_JOBS, STORE_BLOBS, STORE_PAYLOADS], 'readwrite')
      const jobStore = tx.objectStore(STORE_JOBS)
      const blobStore = tx.objectStore(STORE_BLOBS)
      const payloadStore = tx.objectStore(STORE_PAYLOADS)
      for (const id of plan.deleteBlobIds) blobStore.delete(id)
      for (const id of plan.deletePayloadIds) {
        if (id !== META_KEY) payloadStore.delete(id)
      }
      for (const id of plan.deleteJobIds) jobStore.delete(id)
      await txDone(tx)
    },

    async createDigitalHumanRetalkJob(ownerUserId, input) {
      requireTaskLocks()
      assertRetalkReference(input.video)
      assertRetalkReference(input.audio)
      if (input.faceReference) assertRetalkReference(input.faceReference)
      if (![input.projectId, input.segmentId, input.versionId, input.clientRequestId].every((v) => typeof v === 'string' && v.trim())) throw new Error('缺少项目、片段、版本或幂等标识。')
      return withTaskLock(`retalk-enqueue:${ownerUserId}`, async () => {
        const existing = (await repo.listJobsForUser(ownerUserId)).find((j) => j.kind === 'digital_human_retalk' && j.meta?.clientRequestId === input.clientRequestId)
        if (existing) return existing
        const id = newTaskId()
        const job: WorkbenchTaskRecord = { id, ownerUserId, kind: 'digital_human_retalk', status: 'queued', title: input.title, route: '/workbench/digital-human', createdAt: Date.now(), payloadId: id, meta: { projectId: input.projectId, segmentId: input.segmentId, versionId: input.versionId, clientRequestId: input.clientRequestId } }
        await repo.putPayload({ id, kind: job.kind, data: { ...input } })
        await repo.putJob(job)
        return job
      })
    },

    async createVideoFactoryExportJob(ownerUserId, input: EnqueueVideoFactoryExportInput) {
      await repo.ensureMigrated()
      const title = input.projectTitle.trim() || '未命名成片'
      const id = newTaskId()
      const route =
        input.source === 'ip-composition' ? '/workbench/ip-video?view=composition' : '/workbench/video-factory'
      const payload: VideoFactoryExportPayload = { ...input, projectTitle: title }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'video_factory_export',
        status: 'queued',
        title: `视频导出 · ${title.slice(0, 24)}`,
        subtitle: input.resolutionPreset === '720p' ? '720P' : '1080P',
        route,
        createdAt: Date.now(),
        payloadId: id,
        meta: {
          progress: '0',
          stage: '排队中',
          resolution: input.resolutionPreset,
          source: input.source,
          composition: input.composition === 'offline' ? 'offline' : 'preview',
        },
      }
      await repo.putPayload({ id, kind: 'video_factory_export', data: payload })
      await repo.putJob(job)
      return job
    },

    async createIPVideoCreateJob(ownerUserId, input) {
      if (input.document.scope !== String(ownerUserId)) throw new Error('工程不属于当前账号。')
      if (!input.document.id || !Number.isInteger(input.document.revision) || input.document.revision < 0) throw new Error('工程快照缺少有效标识或版本。')
      if (!['directions', 'create', 'adjust'].includes(input.intent)) throw new Error('未知的 IP 视频创作操作。')
      await repo.ensureMigrated()
      const id = newTaskId()
      const labels = { directions: '推荐方向', create: '创作视频方案', adjust: '调整视频方案' }
      const payload: IPVideoCreatePayload = { input: structuredClone(input) }
      const job: WorkbenchTaskRecord = {
        id, ownerUserId, kind: 'ip_video_create', status: 'queued',
        title: input.document.name?.trim() || 'IP 视频创作',
        subtitle: labels[input.intent],
        route: `/workbench/ip-video?taskId=${encodeURIComponent(id)}`,
        createdAt: Date.now(), payloadId: id,
        meta: { projectId: input.document.id, intent: input.intent, source: 'ip-composition', status: 'queued', pct: '0' },
      }
      await repo.putPayload({ id, kind: job.kind, data: payload })
      await repo.putJob(job)
      return job
    },

    async createIPVideoAudioJob(ownerUserId, input) {
      const text = input.text.trim()
      if (Array.from(text.replace(/\s/g, '')).length < 20) throw new Error('口播文案至少需要 20 字。')
      if (!isVoiceSpeed(input.speed)) throw new Error(`语速必须在 ${VOICE_SPEED_MIN}–${VOICE_SPEED_MAX} 之间。`)
      if (!input.voiceId || input.voiceId.startsWith('demo-')) throw new Error('请选择真实平台音色。')
      const id = newTaskId()
      const payload: IPVideoAudioPayload = { ...input, text }
      const job: WorkbenchTaskRecord = { id, ownerUserId, kind: 'ip_video_audio', status: 'queued', title: `IP 口播 · ${Array.from(text).slice(0, 20).join('')}`, subtitle: input.voiceLabel, route: '/workbench/ip-video', createdAt: Date.now(), payloadId: id }
      await repo.putPayload({ id, kind: 'ip_video_audio', data: payload })
      await repo.putJob(job)
      return job
    },

    async createVoiceTtsJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const trimmed = input.text.trim()
      const id = newTaskId()
      const payload: VoiceTtsPayload = {
        text: trimmed,
        textPreview: trimmed.slice(0, TASK_LIMITS.textPreviewLen),
        voiceId: input.voiceId,
        voiceLabel: input.voiceLabel,
        rate: input.rate,
        volume: input.volume,
        pitch: input.pitch,
        instruction: input.instruction?.trim() || undefined,
      }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'voice_tts',
        status: 'queued',
        title: payload.textPreview,
        subtitle: input.voiceLabel,
        route: '/workbench/voice',
        createdAt: Date.now(),
        payloadId: id,
      }
      await repo.putPayload({ id, kind: 'voice_tts', data: payload })
      await repo.putJob(job)
      return job
    },

    async createVoiceCloneJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const displayName = input.displayName.trim()
      if (!displayName) throw new Error('请填写音色名称。')
      if (!input.file || input.file.size === 0) throw new Error('请录制或上传声音样本。')
      const id = newTaskId()
      const buf = await input.file.arrayBuffer()
      const mime = input.file.type || 'audio/wav'
      await repo.putBlob({ id, mime, data: buf })
      const payload: VoiceClonePayload = {
        displayName,
        languageHint: input.languageHint?.trim() || 'zh',
        sampleBlobId: id,
        fileName: input.file.name || 'clone-sample.wav',
        mimeType: mime,
      }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'voice_clone',
        status: 'queued',
        title: `声音克隆 · ${displayName}`,
        subtitle: '提交审核',
        route: '/workbench/voice',
        createdAt: Date.now(),
        payloadId: id,
      }
      await repo.putPayload({ id, kind: 'voice_clone', data: payload })
      await repo.putJob(job)
      return job
    },

    async createVoiceDubAdvancedJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const doc = input.config.documentText.trim()
      const id = newTaskId()
      const title = input.title || (doc.slice(0, 24) + (doc.length > 24 ? '…' : ''))
      const payload: VoiceDubAdvancedPayload = {
        config: input.config,
        title,
        segments: input.confirmedSegments ?? [],
        run: input.resumeSnapshot,
        resumeFromStageId: input.resumeFromStageId,
      }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'voice_dub_advanced',
        status: 'queued',
        title,
        subtitle: input.config.globalVoiceLabel,
        route: input.route || '/workbench/voice',
        createdAt: Date.now(),
        payloadId: id,
        meta: {
          phase: input.resumeFromStageId ? 'tts' : 'plan',
          voice: input.config.globalVoiceLabel,
        },
      }
      await repo.putPayload({ id, kind: 'voice_dub_advanced', data: payload })
      await repo.putJob(job)
      return job
    },

    async createPersonaJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const id = newTaskId()
      const payload: PersonaGeneratePayload = {
        personaId: input.personaId,
        personaName: input.personaName,
        formData: input.formData,
        instruction: input.instruction,
        currentProfile: input.currentProfile,
        chatAttachments: input.chatAttachments,
      }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'persona_generate',
        status: 'queued',
        title: input.personaName || '人设生成',
        subtitle: input.instruction ? 'AI 微调' : '首次生成',
        route: '/workbench/persona',
        createdAt: Date.now(),
        payloadId: id,
        meta: { personaId: input.personaId },
      }
      await repo.putPayload({ id, kind: 'persona_generate', data: payload })
      await repo.putJob(job)
      return job
    },

    async createTitlesJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const id = newTaskId()
      const payload: TitlesTaskPayload = {
        input: input.input,
        chatAttachments: input.chatAttachments,
        requirement: {
          theme: input.input.topic,
          audience: input.input.audience,
          painPoints: '',
          goal: '点击',
          platform: input.input.platform,
          toneIntensity: input.input.toneIntensity,
        },
        formulas: [],
        evidence: [],
        candidates: [],
        hardCheck: { pass: true, hits: [], mustFixIds: [], charCount: 0 },
        review: { items: [], rounds: [] },
        run: input.resumeSnapshot ?? null,
        resumeFromStageId: input.resumeFromStageId,
      }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'titles_generate',
        status: 'queued',
        title: input.title,
        subtitle: `${input.input.platform} · ${input.input.audience || '通用受众'}`,
        route: input.route,
        createdAt: Date.now(),
        payloadId: id,
        meta: { platform: input.input.platform, status: 'queued', pct: '0' },
      }
      await repo.putPayload({ id, kind: 'titles_generate', data: payload })
      await repo.putJob(job)
      return job
    },

    async createSourceCreateJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const id = newTaskId()
      const payload = {
        sourceUrl: input.sourceUrl,
        materialId: input.materialId,
        targetType: input.targetType,
        instructions: input.instructions,
        personaContent: input.personaContent,
        chatAttachments: input.chatAttachments,
      }
      const typeLabelMap: Record<string, string> = {
        titles: '爆款标题',
        'video-script': '视频脚本',
        'live-script': '直播脚本',
        xiaohongshu: '小红书笔记',
        'wechat-article': '公众号文章',
      }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'source_create',
        status: 'queued',
        title: input.title,
        subtitle: `${typeLabelMap[input.targetType] || input.targetType}创作`,
        route: input.route,
        createdAt: Date.now(),
        payloadId: id,
        meta: { targetType: input.targetType },
      }
      await repo.putPayload({ id, kind: 'source_create', data: payload })
      await repo.putJob(job)
      return job
    },

    async createScriptGenerateJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const id = newTaskId()
      const payload: ScriptTaskPayload = {
        config: input.config,
        run: input.resumeSnapshot ?? null,
        resumeFromStageId: input.resumeFromStageId,
      }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'script_generate',
        status: 'queued',
        title: input.title,
        subtitle: input.config.mode === 'live' ? '直播脚本' : '视频脚本',
        route: input.route,
        createdAt: Date.now(),
        payloadId: id,
        meta: {
          mode: input.config.mode,
          status: 'queued',
          round: '0',
          pct: '0',
        },
      }
      await repo.putPayload({ id, kind: 'script_generate', data: payload })
      await repo.putJob(job)
      return job
    },

    async createMomentsPlanJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const id = newTaskId()
      const payload: MomentsPlanTaskPayload = { input: input.input, run: null }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'moments_plan',
        status: 'queued',
        title: input.title,
        subtitle: `${input.input.planPeriod.startDate} ~ ${input.input.planPeriod.endDate}`,
        route: input.route,
        createdAt: Date.now(),
        payloadId: id,
        meta: { weekId: input.input.weekId, runKind: 'plan', status: 'queued', pct: '0' },
      }
      await repo.putPayload({ id, kind: 'moments_plan', data: payload })
      await repo.putJob(job)
      return job
    },

    async createMomentsCopyJob(ownerUserId, input) {
      await repo.ensureMigrated()
      const id = newTaskId()
      const payload: MomentsCopyTaskPayload = { input: input.input, run: null }
      const job: WorkbenchTaskRecord = {
        id,
        ownerUserId,
        kind: 'moments_copy',
        status: 'queued',
        title: input.title,
        subtitle: input.input.date,
        route: input.route,
        createdAt: Date.now(),
        payloadId: id,
        meta: {
          weekId: input.input.weekId,
          date: input.input.date,
          runKind: input.runKind,
          ...(input.input.rewrite?.scheduleItemId
            ? { scheduleItemId: input.input.rewrite.scheduleItemId }
            : {}),
          status: 'queued',
          pct: '0',
        },
      }
      await repo.putPayload({ id, kind: 'moments_copy', data: payload })
      await repo.putJob(job)
      return job
    },
  }

  return repo
}
