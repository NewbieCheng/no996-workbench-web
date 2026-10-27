/**
 * React 编辑器 Provider 组件
 * 负责注入 EditorInstance，支持外部传入已有实例或传入配置自动实例化。
 */

import { useEffect, useMemo, type ReactNode } from 'react'
import { EditorContext } from './EditorContext.tsx'
import {
  createEditor,
  type EditorInstance,
  type EditorInstanceOptions,
} from '../core/instance.ts'
import type { EditorDocument } from '../core/project.ts'
import type { PanelProfile } from '../core/capabilities.ts'

export type EditorProviderProps =
  | {
      editor: EditorInstance
      children: ReactNode
    }
  | {
      document: EditorDocument
      profile?: PanelProfile
      onDocumentChange?: (doc: EditorDocument) => void
      children: ReactNode
    }

export function EditorProvider(props: EditorProviderProps) {
  const isExternalInstance = 'editor' in props

  const internalEditor = useMemo(() => {
    if (isExternalInstance) return null
    const options: EditorInstanceOptions = {
      document: props.document,
      profile: props.profile,
      onDocumentChange: props.onDocumentChange,
    }
    return createEditor(options)
    // 仅在首次创建或 document.id 发生改变时重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExternalInstance ? null : props.document.id])

  const activeEditor = isExternalInstance ? props.editor : internalEditor

  useEffect(() => {
    return () => {
      // 内部创建的实例在卸载时自动回收
      if (!isExternalInstance && internalEditor) {
        internalEditor.dispose()
      }
    }
  }, [isExternalInstance, internalEditor])

  if (!activeEditor) {
    return null
  }

  return (
    <EditorContext.Provider value={activeEditor}>
      {props.children}
    </EditorContext.Provider>
  )
}
