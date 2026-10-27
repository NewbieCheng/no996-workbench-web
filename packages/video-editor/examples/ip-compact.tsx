/**
 * 示例 2：IP 口播视频按需精简装配
 * 仅开放文稿配音插槽、主轨、字幕与快速导出，曲线与混音台默认不挂载
 */

import React, { useState } from 'react'
import {
  EditorProvider,
  createEmptyDocument,
  DEFAULT_IP_PROFILE,
  usePlayback,
  useCaptions,
  useEditorInstance,
  usePanelAllowed,
  TimelinePanel,
  type EditorDocument,
} from '../src/index.ts'

function IpScriptPreparationSlot({ onApplyScript }: { onApplyScript: (text: string) => void }) {
  const [script, setScript] = useState('大家好，今天分享一个职场沟通的小技巧。')
  return (
    <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 }}>
      <strong>【IP 专属向导插槽】文稿与配音准备</strong>
      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        rows={2}
        style={{ width: '100%', marginTop: 8 }}
      />
      <button
        type="button"
        onClick={() => onApplyScript(script)}
        style={{ marginTop: 8, padding: '4px 12px' }}
      >
        生成配音并填入工程
      </button>
    </div>
  )
}

function IpCaptionsEditor() {
  const { captions, captionStyle, setCaptionStyle } = useCaptions()
  const isAllowed = usePanelAllowed('captions')
  if (!isAllowed) return null

  return (
    <div style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }}>
      <h4>口播字幕快速校准</h4>
      <p>当前共 {captions.length} 句字幕 · 字号 {captionStyle.size}px</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => setCaptionStyle({ color: '#FFD60A' })}
          style={{ background: '#FFD60A', color: '#000', padding: '2px 8px' }}
        >
          高亮黄
        </button>
        <button
          type="button"
          onClick={() => setCaptionStyle({ color: '#FFFFFF' })}
          style={{ background: '#000000', color: '#fff', padding: '2px 8px' }}
        >
          标准白
        </button>
      </div>
    </div>
  )
}

function CompactTimeline() {
  const editor = useEditorInstance()
  const { playheadUs, seek } = usePlayback()
  const hasTimeline = usePanelAllowed('timeline')

  if (!hasTimeline) return null

  return (
    <div style={{ height: 180, flexShrink: 0 }}>
      <TimelinePanel
        editor={editor}
        variant="compact"
        playheadUs={playheadUs}
        onSeek={seek}
      />
    </div>
  )
}

export function IpCompactHost() {
  const [doc, setDoc] = useState<EditorDocument>(() =>
    createEmptyDocument('proj-ip-demo', '短视频口播文案', 'tenant-demo', '9:16')
  )

  const handleApplyScript = (text: string) => {
    // 模拟由业务插槽向主工程注入主视频与配音
    const newDoc = JSON.parse(JSON.stringify(doc)) as EditorDocument
    newDoc.tracks[0].elements = [
      {
        id: 'clip-speaker',
        trackId: newDoc.tracks[0].id,
        type: 'video',
        assetId: 'asset-speaker-1',
        startUs: 0,
        durationUs: 4_000_000,
        sourceInUs: 0,
        sourceOutUs: 4_000_000,
        rate: 1,
        volume: 1,
        transform: { x: 0, y: 0, width: 1080, height: 1920, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
      },
    ]
    newDoc.durationUs = 4_000_000
    setDoc(newDoc)
  }

  return (
    <EditorProvider document={doc} profile={DEFAULT_IP_PROFILE} onDocumentChange={setDoc}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
        <IpScriptPreparationSlot onApplyScript={handleApplyScript} />
        <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 8 }}>
          <div style={{ background: '#000', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <span>竖屏口播视频舞台 (9:16)</span>
          </div>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <IpCaptionsEditor />
          </aside>
        </main>
        <CompactTimeline />
      </div>
    </EditorProvider>
  )
}
