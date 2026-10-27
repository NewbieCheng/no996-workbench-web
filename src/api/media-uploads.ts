import { api } from './client'
import { throwApiError } from './errors'

export type LipsyncAssetKind = 'video' | 'audio' | 'ref_image'
export interface TemporaryUploadPolicy {
  upload_host: string
  policy: string
  signature: string
  oss_access_key_id: string
  x_oss_object_acl: string
  x_oss_forbid_overwrite: string
  key_prefix: string
  expire_in_seconds: number
  max_file_size_mb?: number
}
export interface MediaUploadPolicy {
  direct: boolean
  policy?: TemporaryUploadPolicy
  max_file_size_mb: number
  policy_max_file_size_mb?: number
  accept?: string
  note?: string
}

export function buildLipsyncUpload(file: File, kind: LipsyncAssetKind, response: MediaUploadPolicy) {
  if (response.direct) throw new Error('当前上传通道要求公网 URL，请提供无需登录即可访问的素材 URL；暂不支持本地文件上传。')
  const p = response.policy
  if (!p || !p.upload_host || !p.key_prefix || !p.policy || !p.signature || !p.oss_access_key_id || !p.x_oss_object_acl || !p.x_oss_forbid_overwrite || !Number.isFinite(p.expire_in_seconds) || p.expire_in_seconds <= 0) throw new Error('上传凭证不完整，请重新获取。')
  if (!/^https:\/\//i.test(p.upload_host)) throw new Error('上传地址必须使用 HTTPS。')
  const limits = [kind === 'video' ? 300 : kind === 'audio' ? 30 : 10, response.max_file_size_mb, response.policy_max_file_size_mb, p.max_file_size_mb].filter((n): n is number => typeof n === 'number' && n > 0)
  const max = Math.min(...limits)
  if (!file.size || file.size > max * 1024 * 1024) throw new Error(`文件为空或超过 ${max} MB 上限。`)
  const name = file.name.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '_').replace(/^\.+/, '_') || 'asset'
  const key = `${p.key_prefix.replace(/^\/+|\/+$/g, '')}/${name}`
  const form = new FormData()
  form.append('OSSAccessKeyId', p.oss_access_key_id)
  form.append('Signature', p.signature)
  form.append('policy', p.policy)
  form.append('x-oss-object-acl', p.x_oss_object_acl)
  form.append('x-oss-forbid-overwrite', p.x_oss_forbid_overwrite)
  form.append('key', key)
  form.append('success_action_status', '200')
  form.append('file', file, name) // OSS requires the file to be the last field.
  return { form, host: p.upload_host, reference: `oss://${key}`, timeoutMs: Math.min(300_000, Math.max(1, p.expire_in_seconds) * 1000) }
}

export async function uploadLipsyncAsset(file: File, kind: LipsyncAssetKind, options?: { signal?: AbortSignal; onProgress?: (percent: number) => void }): Promise<string> {
  let policy: MediaUploadPolicy
  try {
    policy = (await api.get<MediaUploadPolicy>('/ai/uploads/policy', { params: { capability: 'lipsync', kind }, signal: options?.signal })).data
  } catch (e) { throwApiError(e) }
  const upload = buildLipsyncUpload(file, kind, policy)
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest() // Deliberately independent of the authenticated axios client.
    const abort = () => xhr.abort()
    const finish = (error?: Error) => {
      options?.signal?.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve(upload.reference)
    }
    xhr.open('POST', upload.host)
    xhr.withCredentials = false
    xhr.timeout = upload.timeoutMs
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) options?.onProgress?.(Math.round(event.loaded / event.total * 100)) }
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error(`素材上传失败：HTTP ${xhr.status}`))
    xhr.onerror = () => finish(new Error('素材上传失败，请检查网络与上传通道跨域配置。'))
    xhr.ontimeout = () => finish(new Error('上传凭证已超时，请重新上传。'))
    xhr.onabort = () => finish(new DOMException('上传已取消', 'AbortError'))
    options?.signal?.addEventListener('abort', abort, { once: true })
    if (options?.signal?.aborted) { finish(new DOMException('上传已取消', 'AbortError')); return }
    xhr.send(upload.form)
  })
}
