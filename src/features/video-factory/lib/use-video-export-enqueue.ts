import { useCallback, useState } from 'react'
import type { EditorInstance } from '@no996/video-editor'
import type { ExportResolutionPreset } from '@no996/video-editor/panels/export/ExportPanel.tsx'
import { useWorkbenchTaskActions } from '../../../services/workbench-tasks'
import type { VideoExportSource } from '../../../services/workbench-tasks/types'
import { toastTaskEnqueued } from '../../../lib/toast-task-enqueued.tsx'
import { useVideoExportTaskSnapshot } from './use-video-export-task-snapshot.ts'

const EXPORT_ENQUEUE_TOAST =
  '已加入后台任务。合成在本标签页浏览器里进行：请勿刷新、关闭或离开本页。可关弹窗，可点顶栏任务中心看进度。'

export function useVideoExportEnqueue({
  editor,
  ownerScope,
  source,
  beforeEnqueue,
}: {
  editor: EditorInstance | null
  ownerScope: string
  source: VideoExportSource
  beforeEnqueue?: () => Promise<void>
}) {
  const { enqueueVideoFactoryExport } = useWorkbenchTaskActions()
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const { snapshot } = useVideoExportTaskSnapshot(activeTaskId, setActiveTaskId)

  const onEnqueue = useCallback(
    async (preset: ExportResolutionPreset, options?: { composition?: 'preview' | 'offline' }) => {
      if (!editor) throw new Error('编辑器未就绪')
      if (!ownerScope) throw new Error('请先登录')
      await beforeEnqueue?.()
      const doc = editor.getDocument()
      const taskId = await enqueueVideoFactoryExport({
        documentId: doc.id,
        documentRevision: doc.revision,
        projectTitle: doc.name || '未命名成片',
        resolutionPreset: preset,
        source,
        ownerScope,
        documentSnapshot: structuredClone(doc),
        composition: options?.composition === 'offline' ? 'offline' : 'preview',
      })
      setActiveTaskId(taskId)
      toastTaskEnqueued({ message: EXPORT_ENQUEUE_TOAST })
      return taskId
    },
    [editor, ownerScope, source, beforeEnqueue, enqueueVideoFactoryExport],
  )

  return { onEnqueue, trackedTask: snapshot, activeTaskId, setActiveTaskId }
}
