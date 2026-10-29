import { runBrowserExport } from '../../../features/video-factory/lib/run-browser-export.ts'
import { isDocumentHidden, waitForDocumentVisible } from '../../../features/video-factory/lib/export-visibility.ts'
import { IndexedDBAssetRepository, IndexedDBProjectRepository } from '@no996/video-editor/core/repository/indexeddb.ts'
import { formatExportDiagnostic, type ExportDiagnosticContext } from '../../../../packages/video-editor/src/core/export/export-diagnostics.ts'
import { resolveExportDimensions } from '@no996/video-editor/core/export/controller.ts'
import { FAST_EXPORT_VIDEO_BITRATE } from '@no996/video-editor/core/export/composition-recorder.ts'
import { AUDIO_BITRATE } from '@no996/video-editor/media/pcm.ts'
import type { WorkbenchTaskRepository } from '../repository'
import type { VideoFactoryExportPayload, WorkbenchTaskRecord } from '../types'

export async function executeVideoFactoryExport(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
  /** 进度写库后必须通知任务快照刷新，否则弹窗/任务中心会一直停在「排队中 0%」。 */
  onProgressPersisted?: () => void,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as VideoFactoryExportPayload | undefined
  if (!payload) throw new Error('导出任务数据丢失')

  const workspace = payload.source === 'ip-composition' ? 'ip-video' : 'video-factory'
  const projectRepo = new IndexedDBProjectRepository(workspace)
  const assetRepo = new IndexedDBAssetRepository(workspace)

  if (payload.ownerScope !== String(job.ownerUserId)) throw new Error('导出任务与当前素材账号不一致')
  const doc = payload.documentSnapshot ?? await projectRepo.getProject(payload.documentId, payload.ownerScope)
  if (!doc) throw new Error('工程不存在或已被删除，请保存后重试')
  if (doc.scope !== payload.ownerScope || doc.id !== payload.documentId || doc.revision !== payload.documentRevision) throw new Error('工程已变化，无法还原本次提交的版本，请重新导出。')

  const checkCancelled = () => {
    if (signal?.aborted) throw new DOMException('编码已取消', 'AbortError')
  }

  let lastMetaPatch = 0
  const patchProgress = async (progress: number, stage: string, paused?: boolean) => {
    const now = Date.now()
    if (now - lastMetaPatch < 350 && progress < 100 && !paused) return
    lastMetaPatch = now
    await repo.patchJob(job.id, {
      meta: {
        progress: String(Math.round(progress)),
        stage: paused ? '已暂停：请保持本页在前台' : stage,
        resolution: payload.resolutionPreset,
        source: payload.source,
        composition: payload.composition === 'offline' ? 'offline' : 'preview',
      },
    })
    onProgressPersisted?.()
  }

  const visibilityInterval =
    typeof document !== 'undefined'
      ? window.setInterval(() => {
          if (isDocumentHidden()) {
            void patchProgress(0, '', true)
          }
        }, 800)
      : undefined

  try {
    // 立刻盖掉入队时的「排队中」，避免任务已 running 但 UI 仍像没开始。
    await patchProgress(0, '正在启动浏览器合成')

    while (isDocumentHidden()) {
      await patchProgress(0, '', true)
      await waitForDocumentVisible(signal)
    }

    checkCancelled()

    const dimensions = resolveExportDimensions(doc, payload.resolutionPreset)
    const diagnostic: ExportDiagnosticContext = {
      module: payload.source === 'ip-composition' ? 'IP 视频' : '视频工厂',
      composition: payload.composition === 'offline' ? '逐帧精确导出' : '预览快速导出',
      width: dimensions.width,
      height: dimensions.height,
      fps: doc.canvas.fps.num / doc.canvas.fps.den,
      videoBitrate: FAST_EXPORT_VIDEO_BITRATE,
      audioBitrate: AUDIO_BITRATE,
      hasAudio: undefined,
      stage: '准备导出',
      attempts: [],
    }
    try {
      const { blob, fileName } = await runBrowserExport({
        doc,
        resolutionPreset: payload.resolutionPreset,
        getAssetBlob: (blobId) => assetRepo.getAssetBlob(blobId, payload.ownerScope),
        signal,
        composition: payload.composition === 'offline' ? 'offline' : 'preview',
        onProgress: (p, stage) => {
          diagnostic.stage = stage
          void patchProgress(p * 100, stage)
        },
        onPausedForVisibility: () => {
          void patchProgress(0, '', true)
        },
      })
      checkCancelled()
      await repo.putBlob({ id: job.id, mime: blob.type || 'video/mp4', data: blob })
      await repo.patchPayload(job.payloadId, { ...payload, fileName })
      await repo.patchJob(job.id, {
        status: 'succeeded',
        finishedAt: Date.now(),
        blobId: job.id,
        audioByteLength: blob.size,
        meta: {
          progress: '100',
          stage: '导出完成',
          resolution: payload.resolutionPreset,
          source: payload.source,
          composition: payload.composition === 'offline' ? 'offline' : 'preview',
          fileName,
          byteLength: String(blob.size),
        },
      })
      await repo.pruneForUser(job.ownerUserId)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        const errorDetails = error instanceof Error && 'diagnostic' in error
          ? (error as Error & { diagnostic?: Partial<ExportDiagnosticContext> }).diagnostic
          : undefined
        if (errorDetails) {
          diagnostic.stage = errorDetails.stage ?? diagnostic.stage
          diagnostic.attempts = errorDetails.attempts ?? diagnostic.attempts
        }
        await repo.patchJob(job.id, {
          meta: { ...job.meta, diagnostic: formatExportDiagnostic(diagnostic, error) },
        })
      }
      throw error
    }
  } finally {
    if (visibilityInterval !== undefined) clearInterval(visibilityInterval)
  }
}
