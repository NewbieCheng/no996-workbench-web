export type DigitalHumanVersion = {
  id: string
  createdAt: number
  text: string
  audio?: Blob
  audioUrl?: string
  audioDuration?: number
  audioTaskId?: string
  voiceId?: string
  voiceLabel?: string
  videoUrl?: string
  videoBlob?: Blob
  taskId?: string
  localTaskId?: string
  clientRequestId?: string
  status?: string
  error?: string
  submissionUncertain?: boolean
  retryAfterUntil?: number
  observationPaused?: boolean
  sourceName?: string
  pointsCharged?: number
  /** 用户主动移除本机成片后，不再从任务记录回填 videoUrl */
  resultCleared?: boolean
}
export type DigitalHumanSegment = {
  id: string
  text: string
  activeVersionId?: string
  versions: DigitalHumanVersion[]
}
export type DigitalHumanProject = {
  id: string
  ownerUserId: number
  name: string
  createdAt: number
  updatedAt: number
  source?: { id?: string; file: Blob; name: string; duration: number; width: number; height: number }
  uploadedSource?: { sourceId: string; url: string; expiresAt: number }
  sourceUrl?: string
  reference?: { file: Blob; name: string }
  referenceUrl?: string
  videoExtension?: boolean
  authorized?: boolean
  voiceId?: string
  segments: DigitalHumanSegment[]
}
const DB = 'no996-workbench-digital-human'
const STORE = 'projects'
export const DIGITAL_HUMAN_STORAGE_LIMIT = 800 * 1024 * 1024

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('ownerUserId', 'ownerUserId')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('本机数字人资料库不可用'))
    request.onblocked = () => reject(new Error('请关闭其他工作台标签页后重试'))
  })
}
export function digitalHumanProjectBytes(project: DigitalHumanProject): number {
  return (project.source?.file.size ?? 0) + (project.reference?.file.size ?? 0) + project.segments.reduce((sum, segment) => sum + segment.versions.reduce((n, version) => n + (version.audio?.size ?? 0) + (version.videoBlob?.size ?? 0), 0), 0)
}
export async function listDigitalHumanProjects(owner: number): Promise<DigitalHumanProject[]> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).index('ownerUserId').getAll(owner)
      request.onsuccess = () => resolve((request.result as DigitalHumanProject[]).sort((a, b) => b.updatedAt - a.updatedAt))
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
export async function getDigitalHumanProject(id: string, owner: number): Promise<DigitalHumanProject | undefined> {
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result?.ownerUserId === owner ? request.result : undefined)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}
/** A single readwrite transaction checks the owner's quota and commits without evicting any project. */
export async function saveDigitalHumanProject(project: DigitalHumanProject): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      const existing = store.get(project.id)
      let failure: Error | undefined
      existing.onsuccess = () => {
        if (existing.result && existing.result.ownerUserId !== project.ownerUserId) {
          failure = new Error('不能覆盖其他账号的项目'); transaction.abort(); return
        }
        const all = store.index('ownerUserId').getAll(project.ownerUserId)
        all.onsuccess = () => {
          const bytes = (all.result as DigitalHumanProject[]).filter(item => item.id !== project.id).reduce((sum, item) => sum + digitalHumanProjectBytes(item), digitalHumanProjectBytes(project))
          if (bytes > DIGITAL_HUMAN_STORAGE_LIMIT) { failure = new Error('数字人本机存储已达 800 MB，请先下载并删除不用的项目'); transaction.abort(); return }
          store.put(project)
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('保存项目失败'))
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('保存已中止'))
    })
  } finally { db.close() }
}
export async function deleteDigitalHumanProject(id: string, owner: number): Promise<void> {
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite'); const store = transaction.objectStore(STORE); const request = store.get(id)
      request.onsuccess = () => { if (request.result?.ownerUserId === owner) store.delete(id) }
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}
/** 未显式关闭时视为已授权（兼容旧项目无 `authorized` 字段） */
export function isDigitalHumanPortraitAuthorized(
  project: Pick<DigitalHumanProject, 'authorized'> | undefined,
): boolean {
  return project?.authorized !== false
}

/** 无素材、无台词、无配音/成片数据的空壳项目（多为误删后自动创建的占位） */
export function isDigitalHumanProjectShell(project: DigitalHumanProject): boolean {
  if (project.source?.file || project.sourceUrl?.trim()) return false
  if (project.reference?.file || project.referenceUrl?.trim()) return false
  return project.segments.every(segment => {
    if (segment.text.trim()) return false
    return segment.versions.every(
      version =>
        !version.audio &&
        !version.audioUrl?.trim() &&
        !version.videoUrl &&
        !version.videoBlob,
    )
  })
}

export function digitalHumanProjectHasBusyVersions(project: DigitalHumanProject): boolean {
  return project.segments.some(segment => segment.versions.some(version => versionIsBusy(version)))
}

export const LEGACY_DIGITAL_HUMAN_UNTITLED_LABEL = '未命名口播项目'

/** 新建本机口播项目时的默认名称：口播项目1、口播项目2… */
export function nextDigitalHumanProjectName(
  projects: ReadonlyArray<Pick<DigitalHumanProject, 'name'>>,
  prefix = '口播项目',
): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`)
  let maxNum = 0
  for (const item of projects) {
    const trimmed = item.name.trim()
    const numbered = trimmed.match(pattern)
    if (numbered) {
      maxNum = Math.max(maxNum, Number.parseInt(numbered[1], 10))
      continue
    }
    if (!trimmed || trimmed === LEGACY_DIGITAL_HUMAN_UNTITLED_LABEL || trimmed === `${prefix}1`) {
      maxNum = Math.max(maxNum, 1)
    }
  }
  return `${prefix}${maxNum + 1}`
}

export function createDigitalHumanProject(ownerUserId: number, name: string): DigitalHumanProject {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    ownerUserId,
    name,
    createdAt: now,
    updatedAt: now,
    authorized: true,
    videoExtension: true, // 默认开启：当原视频短于配音时自动正倒放延展
    segments: [{ id: crypto.randomUUID(), text: '', versions: [] }]
  }
}
export function splitDigitalHumanScript(text: string): DigitalHumanSegment[] {
  return text.trim().split(/\n\s*\n/).map(value => value.trim()).filter(Boolean).map(value => ({ id: crypto.randomUUID(), text: value, versions: [] }))
}
export function activeDigitalHumanVersion(segment: DigitalHumanSegment): DigitalHumanVersion | undefined {
  return segment.versions.find(version => version.id === segment.activeVersionId) ?? [...segment.versions].reverse().find(version => version.text === segment.text)
}

const BUSY_VERSION_STATUSES = new Set([
  'queued',
  'running',
  'waiting_remote',
  'QUEUED',
  'SUBMITTED',
  'RUNNING',
  'audio_queued',
])

function versionHasResultVideo(version: DigitalHumanVersion): boolean {
  return Boolean(version.videoUrl || version.videoBlob)
}

function versionIsBusy(version: DigitalHumanVersion): boolean {
  return BUSY_VERSION_STATUSES.has(version.status ?? '')
}

function keepVersionWhenReplacingAudio(version: DigitalHumanVersion): boolean {
  return versionHasResultVideo(version) || versionIsBusy(version)
}

export type ImportedAudioPatch = {
  text?: string
  audio?: Blob
  audioUrl?: string
  audioDuration?: number
  voiceLabel?: string
  voiceId?: string
}

/** 本镜仅保留一条可替换的导入/上传配音（不新增并列音频版本；保留已成片或进行中的版本） */
export function applyImportedAudioToSegment(
  segment: DigitalHumanSegment,
  patch: ImportedAudioPatch,
): DigitalHumanSegment {
  const text = patch.text?.trim() ? patch.text.trim() : segment.text
  const active = activeDigitalHumanVersion(segment)
  const replaceTarget =
    active && !versionIsBusy(active) && !versionHasResultVideo(active) ? active : undefined

  if (replaceTarget) {
    const updated: DigitalHumanVersion = {
      ...replaceTarget,
      ...patch,
      text,
      id: replaceTarget.id,
      createdAt: Date.now(),
      status: 'audio_ready',
      audioTaskId: undefined,
      taskId: undefined,
      localTaskId: undefined,
      clientRequestId: undefined,
      videoUrl: undefined,
      videoBlob: undefined,
      error: undefined,
      submissionUncertain: undefined,
      retryAfterUntil: undefined,
      observationPaused: undefined,
      sourceName: undefined,
      pointsCharged: undefined,
    }
    const versions = segment.versions
      .filter(version => version.id === updated.id || keepVersionWhenReplacingAudio(version))
      .map(version => (version.id === updated.id ? updated : version))
    return { ...segment, text, activeVersionId: updated.id, versions }
  }

  const newVersion: DigitalHumanVersion = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    text,
    status: 'audio_ready',
    voiceLabel: patch.voiceLabel,
    voiceId: patch.voiceId,
    audio: patch.audio,
    audioUrl: patch.audioUrl,
    audioDuration: patch.audioDuration,
  }
  const versions = segment.versions.filter(keepVersionWhenReplacingAudio).concat(newVersion)
  return { ...segment, text, activeVersionId: newVersion.id, versions }
}

/** 当前镜头用于素材库展示的唯一条导入配音（不含仅 TTS 排队中的空音频槽） */
export function segmentLibraryAudioVersion(segment: DigitalHumanSegment): DigitalHumanVersion | undefined {
  const active = activeDigitalHumanVersion(segment)
  if (active && (active.audio || active.audioUrl?.trim())) {
    return active
  }
  return [...segment.versions]
    .reverse()
    .find(version => version.audio || version.audioUrl?.trim())
}

export function canClearSegmentImportedAudio(segment: DigitalHumanSegment): boolean {
  const target = segmentLibraryAudioVersion(segment)
  return Boolean(target && !versionIsBusy(target) && !versionHasResultVideo(target))
}

/** 移除本镜素材库中的导入配音（进行中任务或已绑定成片时返回 undefined） */
export function clearSegmentImportedAudio(segment: DigitalHumanSegment): DigitalHumanSegment | undefined {
  const target = segmentLibraryAudioVersion(segment)
  if (!target) return segment
  if (!canClearSegmentImportedAudio(segment)) return undefined
  const versions = segment.versions.filter(version => version.id !== target.id)
  return { ...segment, activeVersionId: undefined, versions }
}
