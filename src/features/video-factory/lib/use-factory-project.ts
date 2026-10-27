/**
 * 视频工厂工程状态
 *
 * 职责：
 *  - 从 IndexedDB 载入/新建工程，按 userId 隔离；
 *  - 800ms 防抖自动保存；
 *  - 提供镜头插入、音频插入等操作入口。
 *
 * 与 IP 口播视频复用编辑器模型与仓储实现，但工程和素材分库存储。
 * 视频工厂保留原数据库，IP 口播使用独立的 ip-video 工作区。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createEditor,
  createEmptyDocument,
  type CanvasRatio,
  type EditorDocument,
  type EditorInstance,
} from '@no996/video-editor'
import {
  IndexedDBProjectRepository,
  IndexedDBAssetRepository,
} from '@no996/video-editor/core/repository/indexeddb.ts'
import { InsertShotCommand, shotDurationUs } from '@no996/video-editor/core'
import type { ShotDefinition } from '@no996/video-editor'
import { resolveShotInsertTrack } from '@no996/video-editor/panels'

export type FactorySaveState = 'saved' | 'saving' | 'unsaved'

export type UseFactoryProjectResult = {
  editor: EditorInstance | null
  draftList: { id: string; name: string }[]
  activeDoc: EditorDocument | null
  saveState: FactorySaveState
  error: string
  createDraft: (name: string, ratio?: CanvasRatio) => Promise<void>
  openDraft: (id: string) => Promise<void>
  renameDraft: (id: string, name: string) => Promise<void>
  deleteDraft: (id: string) => Promise<void>
  insertShot: (shot: ShotDefinition, trackId?: string) => string | undefined
  saveAssetBlob: (blobId: string, blob: Blob) => Promise<void>
  getAssetBlob: (blobId: string) => Promise<Blob | null>
  deleteAssetBlob: (blobId: string) => Promise<void>
  flushSave: () => Promise<void>
}

const AUTOSAVE_DEBOUNCE_MS = 800

export function useFactoryProject(userId: number | null): UseFactoryProjectResult {
  const scope = userId != null ? String(userId) : ''
  const projectRepo = useRef<IndexedDBProjectRepository | null>(null)
  const assetRepo = useRef<IndexedDBAssetRepository | null>(null)
  if (!projectRepo.current) projectRepo.current = new IndexedDBProjectRepository()
  if (!assetRepo.current) assetRepo.current = new IndexedDBAssetRepository()

  const [editor, setEditor] = useState<EditorInstance | null>(null)
  const [draftList, setDraftList] = useState<{ id: string; name: string }[]>([])
  const [activeDoc, setActiveDoc] = useState<EditorDocument | null>(null)
  const [saveState, setSaveState] = useState<FactorySaveState>('saved')
  const [error, setError] = useState('')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeDocRef = useRef<EditorDocument | null>(null)

  const flushSave = useCallback(async () => {
    const doc = activeDocRef.current
    if (!doc || !scope) return
    setSaveState('saving')
    try {
      await projectRepo.current!.saveProject(doc)
      setSaveState('saved')
    } catch (saveError) {
      console.error('自动保存失败:', saveError)
      setSaveState('unsaved')
      // 不要把所有失败都说成「存储空间不足」：工程数量上限、IndexedDB 异常的原因不同
      const reason = saveError instanceof Error && saveError.message ? saveError.message : '未知错误'
      setError(`工程保存失败：${reason}`)
    }
  }, [scope])

  const attachEditor = useCallback(
    (doc: EditorDocument) => {
      const instance = createEditor({
        document: doc,
        onDocumentChange: (next: EditorDocument) => {
          activeDocRef.current = next
          setActiveDoc(next)
          setSaveState('unsaved')
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => void flushSave(), AUTOSAVE_DEBOUNCE_MS)
        },
      })
      activeDocRef.current = doc
      setActiveDoc(doc)
      setEditor(instance)
    },
    [flushSave],
  )

  // 载入工程列表
  useEffect(() => {
    if (!scope) {
      setEditor(null)
      setActiveDoc(null)
      setDraftList([])
      return
    }
    let active = true

    void (async () => {
      try {
        const list = await projectRepo.current!.listProjects(scope)
        if (!active) return
        if (list.length === 0) {
          const doc = createEmptyDocument(`proj-vf-${crypto.randomUUID()}`, '未命名成片', scope, '16:9')
          doc.templateMeta = { templateId: 'video-factory', presetName: '视频工厂', category: 'general' }
          await projectRepo.current!.saveProject(doc)
          if (!active) return
          setDraftList([{ id: doc.id, name: doc.name }])
          attachEditor(doc)
          return
        }
        setDraftList(list.map((item) => ({ id: item.id, name: item.name })))
        const first = await projectRepo.current!.getProject(list[0].id, scope)
        if (!active) return
        attachEditor(
          first ?? createEmptyDocument(`proj-vf-${crypto.randomUUID()}`, '未命名成片', scope, '16:9'),
        )
      } catch (loadError) {
        if (!active) return
        console.error('载入工程失败:', loadError)
        setError('载入工程失败，请刷新重试')
      }
    })()

    return () => {
      active = false
    }
  }, [scope, attachEditor])

  // 卸载时清定时器
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const createDraft = useCallback(
    async (name: string, ratio: CanvasRatio = '16:9') => {
      if (!scope) return
      const doc = createEmptyDocument(`proj-vf-${crypto.randomUUID()}`, name || '未命名成片', scope, ratio)
      doc.templateMeta = { templateId: 'video-factory', presetName: '视频工厂', category: 'general' }
      try {
        await projectRepo.current!.saveProject(doc)
        setDraftList((prev) => [{ id: doc.id, name: doc.name }, ...prev])
        attachEditor(doc)
        setError('')
      } catch (createError) {
        console.error('新建工程失败:', createError)
        setError('新建工程失败：可能已达到本机工程数量上限，请先删除旧工程')
      }
    },
    [scope, attachEditor],
  )

  const openDraft = useCallback(
    async (id: string) => {
      if (!scope) return
      try {
        const doc = await projectRepo.current!.getProject(id, scope)
        if (!doc) {
          setError('工程不存在或已被删除')
          return
        }
        attachEditor(doc)
        setError('')
      } catch (openError) {
        console.error('打开工程失败:', openError)
        setError('打开工程失败')
      }
    },
    [scope, attachEditor],
  )

  const renameDraft = useCallback(
    async (id: string, name: string) => {
      if (!scope) return
      const doc = await projectRepo.current!.getProject(id, scope)
      if (!doc) return
      const next = { ...doc, name: name.trim() || doc.name, updatedAt: Date.now() }
      await projectRepo.current!.saveProject(next)
      setDraftList((prev) => prev.map((item) => (item.id === id ? { ...item, name: next.name } : item)))
      if (activeDocRef.current?.id === id) {
        editor?.setDocument(next)
        setActiveDoc(next)
      }
    },
    [scope, editor],
  )

  const deleteDraft = useCallback(
    async (id: string) => {
      if (!scope) return
      try {
        await projectRepo.current!.deleteProject(id, scope)
      } catch (deleteError) {
        console.error('删除工程失败:', deleteError)
      }
      const remaining = draftList.filter((item) => item.id !== id)
      setDraftList(remaining)
      if (activeDocRef.current?.id === id) {
        if (remaining.length) await openDraft(remaining[0].id)
        else await createDraft('未命名成片')
      }
    },
    [scope, draftList, openDraft, createDraft],
  )

  /** 按镜头上轴策略与默认星标轨插入镜头，落点接在目标轨末尾。 */
  const insertShot = useCallback(
    (shot: ShotDefinition, trackId?: string): string | undefined => {
      if (!editor) return undefined
      try {
        const resolved = resolveShotInsertTrack(editor, shot.shotId, {
          explicitTrackId: trackId,
        })
        const doc = editor.getDocument()
        const fps = doc.canvas.fps.num / doc.canvas.fps.den
        editor.executeCommand(
          new InsertShotCommand(
            {
              trackId: resolved.track.id,
              shotId: shot.shotId,
              sourceDurationFrames: shot.durationInFrames,
              startUs: resolved.startUs,
              canvasWidth: doc.canvas.width,
              canvasHeight: doc.canvas.height,
            },
            fps,
          ),
        )
        const next = editor.getDocument()
        if (next.durationUs <= 0) {
          editor.setDocument({
            ...next,
            durationUs: shotDurationUs(shot.durationInFrames, 1, fps),
          })
        }
        return resolved.track.name
      } catch (error) {
        console.warn('插入镜头失败:', error)
        return undefined
      }
    },
    [editor],
  )

  const saveAssetBlob = useCallback(
    async (blobId: string, blob: Blob) => {
      if (!scope) throw new Error('未登录，无法保存素材')
      await assetRepo.current!.saveAssetBlob(blobId, scope, blob)
    },
    [scope],
  )

  const getAssetBlob = useCallback(
    async (blobId: string) => {
      if (!scope) return null
      try {
        return await assetRepo.current!.getAssetBlob(blobId, scope)
      } catch {
        return null
      }
    },
    [scope],
  )

  const deleteAssetBlob = useCallback(
    async (blobId: string) => {
      if (!scope) throw new Error('未登录，无法删除素材')
      await assetRepo.current!.deleteAssetBlob(blobId, scope)
    },
    [scope],
  )

  return {
    editor,
    draftList,
    activeDoc,
    saveState,
    error,
    createDraft,
    openDraft,
    renameDraft,
    deleteDraft,
    insertShot,
    saveAssetBlob,
    getAssetBlob,
    deleteAssetBlob,
    flushSave,
  }
}
