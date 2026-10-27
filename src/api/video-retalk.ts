import { api } from './client'
import { parseApiError, throwApiError } from './errors'

function retalkError(e: unknown): never {
  const parsed = parseApiError(e)
  if (parsed) {
    const raw = (e as { response?: { headers?: Record<string, unknown> } }).response?.headers?.['retry-after']
    const seconds = Number(raw)
    if (raw != null && Number.isFinite(seconds) && seconds >= 0) Object.assign(parsed, { retryAfterSeconds: seconds })
    if (parsed.status === 0) parsed.message = '数字人接口连接中断或超时；提交结果可能尚未确认，请勿重复创建任务。'
    throw parsed
  }
  throwApiError(e)
}

export type RetalkStatus = 'QUEUED' | 'SUBMITTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'EXPIRED'
export interface RetalkTask {
  task_id: string
  status: RetalkStatus
  queue_position?: number
  estimated_wait_seconds?: number
  /** 上游返回的完成度（0–100），无则仅按状态展示 */
  progress?: number
  progress_percent?: number
  upstream_status?: string
  video_url?: string
  source_url?: string
  cover_url?: string
  usage?: { video_duration?: number; size?: string; video_ratio?: string; fps?: number } | null
  points_charged?: number
  error?: string
  created_at: string
  submitted_at?: string
  finished_at?: string
}
export interface RetalkSubmitInput {
  video: string
  audio: string
  face_reference?: string
  video_extension?: boolean
  query_face_threshold?: number
  client_request_id: string
}
export function assertRetalkReference(value: string) {
  if (/^oss:\/\/[^\s]+$/.test(value)) return
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '[::1]' || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw new Error()
  } catch { throw new Error('请提供 oss:// 素材引用或无需登录可访问的公网 URL。') }
}
function validateTask(task: RetalkTask): RetalkTask {
  if (!task?.task_id || !['QUEUED', 'SUBMITTED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED'].includes(task.status)) throw new Error('任务接口返回了无效状态，请手动刷新确认。')
  return task
}
export async function submitRetalk(input: RetalkSubmitInput, signal?: AbortSignal): Promise<RetalkTask> {
  assertRetalkReference(input.video)
  assertRetalkReference(input.audio)
  if (input.face_reference) assertRetalkReference(input.face_reference)
  if (!input.client_request_id.trim()) throw new Error('缺少本次提交的幂等标识。')
  try { return validateTask((await api.post<RetalkTask>('/ai/videos/retalk', input, { signal })).data) }
  catch (e) { retalkError(e) }
}
export async function getRetalkTask(id: string, signal?: AbortSignal): Promise<RetalkTask> {
  try { return validateTask((await api.get<RetalkTask>(`/ai/videos/retalk/tasks/${encodeURIComponent(id)}`, { signal })).data) }
  catch (e) { retalkError(e) }
}
export async function cancelRetalkTask(id: string, signal?: AbortSignal): Promise<RetalkTask> {
  try {
    await api.post(`/ai/videos/retalk/tasks/${encodeURIComponent(id)}/cancel`, undefined, { signal })
    // A successful HTTP response is not a locally invented cancellation: read the authoritative state.
    return await getRetalkTask(id, signal)
  } catch (e) { retalkError(e) }
}
