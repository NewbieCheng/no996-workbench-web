import type { WorkbenchTaskRepository } from './repository.ts'
import type { VideoFactoryExportPayload, WorkbenchTaskRecord } from './types.ts'

export async function resolveVideoExportDownloadUrl(
  repo: WorkbenchTaskRepository,
  task: WorkbenchTaskRecord,
): Promise<string> {
  if (task.kind !== 'video_factory_export' || task.status !== 'succeeded' || !task.blobId) return ''
  const blob = await repo.getBlob(task.blobId)
  if (!blob?.data || blob.data.byteLength === 0) return ''
  const mime = blob.mime || 'video/mp4'
  return URL.createObjectURL(new Blob([blob.data], { type: mime }))
}

export async function resolveVideoExportFileName(
  repo: WorkbenchTaskRepository,
  task: WorkbenchTaskRecord,
): Promise<string> {
  const fromMeta = task.meta?.fileName?.trim()
  if (fromMeta) return fromMeta
  const payloadRec = await repo.getPayload(task.payloadId)
  const payload = payloadRec?.data as VideoFactoryExportPayload | undefined
  const fromPayload = payload?.fileName?.trim()
  if (fromPayload) return fromPayload
  const title = (payload?.projectTitle || task.title).replace(/^视频导出 ·\s*/, '').trim()
  const safe = (title || 'video').replace(/[<>:"/\\|?*]/g, '_')
  return `${safe}.mp4`
}
