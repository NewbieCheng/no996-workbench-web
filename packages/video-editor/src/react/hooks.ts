/**
 * React 剪辑器 Hooks 体系
 * 基于 useSyncExternalStore 精确订阅，避免时间码高频刷新触发无关面板重渲染。
 */

import { useContext, useSyncExternalStore, useCallback, useRef, useEffect } from 'react'
import { EditorContext } from './EditorContext.tsx'
import type { EditorInstance, EditorSnapshot } from '../core/instance.ts'
import type { EditorDocument, CaptionCue, CaptionStyle } from '../core/project.ts'
import type { PanelId } from '../core/capabilities.ts'
import type { TimeUs } from '../core/time.ts'
import { PlaybackController } from '../core/playback/controller.ts'

export function useEditor(): EditorInstance {
  const editor = useContext(EditorContext)
  if (!editor) {
    throw new Error('useEditor 必须在 <EditorProvider> 子树内调用')
  }
  return editor
}

export const useEditorInstance = useEditor


/**
 * 通用精确状态选择器 Hook
 */
export function useEditorSelector<T>(
  selector: (snapshot: EditorSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = (a, b) => a === b
): T {
  const editor = useEditor()
  const lastSelectedValueRef = useRef<T>(selector(editor.getSnapshot()))

  const getSnapshot = useCallback(() => {
    const nextVal = selector(editor.getSnapshot())
    if (isEqual(lastSelectedValueRef.current, nextVal)) {
      return lastSelectedValueRef.current
    }
    lastSelectedValueRef.current = nextVal
    return nextVal
  }, [editor, selector, isEqual])

  return useSyncExternalStore(editor.subscribe, getSnapshot, getSnapshot)
}

/**
 * 订阅完整工程文档（仅在 document 发生实质性变更时触发重渲染）
 */
export function useEditorDocument(): EditorDocument {
  return useEditorSelector(
    (s) => s.document,
    (a, b) => a.revision === b.revision && a.id === b.id
  )
}

/**
 * 订阅播放头与播放状态（绑定具备 30fps 时钟推进与连续 Seek 竞态保护的 PlaybackController）
 */
export function usePlayback() {
  const editor = useEditor()
  const playheadUs = useEditorSelector((s) => s.playheadUs)
  const isPlaying = useEditorSelector((s) => s.isPlaying)

  // 为当前 editor 绑定唯一 PlaybackController
  const controllerRef = useRef<PlaybackController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = new PlaybackController({ editor })
  }

  useEffect(() => {
    return () => {
      controllerRef.current?.dispose()
      controllerRef.current = null
    }
  }, [editor])

  const seek = useCallback(
    (timeUs: TimeUs) => {
      controllerRef.current?.seek(timeUs)
    },
    []
  )

  const setIsPlaying = useCallback(
    (playing: boolean) => {
      if (playing) {
        controllerRef.current?.play()
      } else {
        controllerRef.current?.pause()
      }
    },
    []
  )

  const togglePlay = useCallback(() => {
    controllerRef.current?.togglePlay()
  }, [])

  return {
    playheadUs,
    isPlaying,
    seek,
    setIsPlaying,
    togglePlay,
  }
}

/**
 * 订阅选中元素列表
 */
export function useSelection() {
  const editor = useEditor()
  const selectedIds = useEditorSelector(
    (s) => s.selectedElementIds,
    (a, b) => a.length === b.length && a.every((id, idx) => id === b[idx])
  )

  const setSelection = useCallback(
    (ids: string[]) => {
      editor.setSelection(ids)
    },
    [editor]
  )

  const clearSelection = useCallback(() => {
    editor.clearSelection()
  }, [editor])

  return {
    selectedIds,
    setSelection,
    clearSelection,
  }
}

/**
 * 订阅字幕数据与样式
 */
export function useCaptions() {
  const editor = useEditor()
  const captions = useEditorSelector((s) => s.document.captions)
  const captionStyle = useEditorSelector((s) => s.document.captionStyle)

  const setCaptions = useCallback(
    (newCaptions: CaptionCue[]) => {
      editor.updateDocument((prev) => ({
        ...prev,
        captions: newCaptions,
      }))
    },
    [editor]
  )

  const setCaptionStyle = useCallback(
    (patch: Partial<CaptionStyle>) => {
      editor.updateDocument((prev) => ({
        ...prev,
        captionStyle: { ...prev.captionStyle, ...patch },
      }))
    },
    [editor]
  )

  return {
    captions,
    captionStyle,
    setCaptions,
    setCaptionStyle,
  }
}

/**
 * 检查指定面板在当前 Profile 下是否允许挂载
 */
export function usePanelAllowed(panelId: PanelId): boolean {
  return useEditorSelector((s) => s.profile.allowedPanels.includes(panelId))
}
