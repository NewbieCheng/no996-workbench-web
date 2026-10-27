/**
 * 示例 3：纯净第二宿主独立接入示例 (MinimalHost)
 * 仅依赖 `@no996/video-editor` 公开契约，零业务侵入
 */

import React, { useState } from 'react'
import {
  EditorProvider,
  createEmptyDocument,
  useEditor,
  useEditorDocument,
  usePlayback,
  InsertElementCommand,
  type EditorDocument,
} from '../src/index.ts'

function MinimalToolbar() {
  const editor = useEditor()
  const doc = useEditorDocument()
  const { isPlaying, togglePlay } = usePlayback()

  const handleAddText = () => {
    const textElem = {
      id: `text-${crypto.randomUUID()}`,
      trackId: doc.tracks[0].id,
      type: 'text' as const,
      startUs: 0,
      durationUs: 3_000_000,
      text: '第二宿主独立自定义文字',
      style: {
        font: 'sans-serif',
        size: 40,
        weight: 700,
        color: '#ffffff',
        backgroundColor: 'transparent',
        outlineColor: '#000000',
        outlineWidth: 2,
        align: 'center' as const,
        lineHeight: 1.4,
        letterSpacing: 0,
      },
      transform: {
        x: 100,
        y: 100,
        width: 400,
        height: 100,
        rotationDeg: 0,
        opacity: 1,
        cropMode: 'none' as const,
        round: 0,
      },
    }
    editor.executeCommand(new InsertElementCommand(doc.tracks[0].id, textElem))
  }

  return (
    <div style={{ display: 'flex', gap: 12, padding: 8, borderBottom: '1px solid #30363d', background: '#161b22', color: '#fff' }}>
      <strong>{doc.name}</strong>
      <span>版本: r{doc.revision}</span>
      <span>元素数: {doc.tracks[0].elements.length}</span>
      <button type="button" onClick={handleAddText} style={{ padding: '2px 8px', cursor: 'pointer' }}>
        + 插入文本
      </button>
      <button type="button" onClick={togglePlay} style={{ padding: '2px 8px', cursor: 'pointer' }}>
        {isPlaying ? '暂停' : '播放'}
      </button>
    </div>
  )
}

export function MinimalHost() {
  const [document, setDocument] = useState<EditorDocument>(() =>
    createEmptyDocument('proj-minimal', '独立第二宿主工程', 'external-tenant-888', '1:1')
  )

  return (
    <EditorProvider document={document} onDocumentChange={setDocument}>
      <div style={{ padding: 16, background: '#0d1117', color: '#f0f6fc', minHeight: 200 }}>
        <MinimalToolbar />
        <p style={{ marginTop: 12, fontSize: 12, color: '#8b949e' }}>
          此示例证明：新公共包 `@no996/video-editor` 是完全解耦、自包含的独立可分发组件，后续任何业务页面均可直接使用。
        </p>
      </div>
    </EditorProvider>
  )
}
