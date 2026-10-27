/**
 * 示例 1：完整专业剪辑器装配 (FullEditorHost)
 * 全面板、全轨道、全渲染、全控制器完整独立装配
 */

import React, { useState } from 'react'
import {
  EditorProvider,
  createEmptyDocument,
  DEFAULT_FULL_PROFILE,
  usePlayback,
  useEditorDocument,
  useEditorInstance,
  usePanelAllowed,
  PlayerSurface,
  TimelinePanel,
  MediaPanel,
  InspectorPanel,
  CaptionsPanel,
  TransitionsPanel,
  EffectsPanel,
  KeyframesPanel,
  AudioMixerPanel,
  TemplatePanel,
  ExportPanel,
  type EditorDocument,
} from '../src/index.ts'

type LeftTab = 'media' | 'templates' | 'transitions' | 'effects'
type RightTab = 'inspector' | 'captions' | 'keyframes' | 'mixer' | 'export'

export function FullEditorHost() {
  const [doc, setDoc] = useState<EditorDocument>(() => {
    const d = createEmptyDocument('proj-full-demo', '专业剪辑工程示例', 'tenant-demo', '16:9')
    // 注入初始演示素材
    d.tracks[0].elements.push({
      id: 'clip-v1',
      trackId: d.tracks[0].id,
      type: 'video',
      assetId: 'asset-video-1',
      startUs: 0,
      durationUs: 6_000_000,
      sourceInUs: 0,
      sourceOutUs: 6_000_000,
      rate: 1,
      volume: 1,
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
    })
    d.durationUs = 6_000_000
    return d
  })

  const [leftTab, setLeftTab] = useState<LeftTab>('media')
  const [rightTab, setRightTab] = useState<RightTab>('inspector')

  return (
    <EditorProvider document={doc} profile={DEFAULT_FULL_PROFILE} onDocumentChange={setDoc}>
      <FullEditorLayout
        leftTab={leftTab}
        setLeftTab={setLeftTab}
        rightTab={rightTab}
        setRightTab={setRightTab}
      />
    </EditorProvider>
  )
}

function FullEditorLayout({
  leftTab,
  setLeftTab,
  rightTab,
  setRightTab,
}: {
  leftTab: LeftTab
  setLeftTab: (t: LeftTab) => void
  rightTab: RightTab
  setRightTab: (t: RightTab) => void
}) {
  const editor = useEditorInstance()
  const { playheadUs, isPlaying, togglePlay, seek } = usePlayback()
  const doc = useEditorDocument()

  const navBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: 11,
    border: 'none',
    background: active ? '#21262d' : 'transparent',
    color: active ? '#58a6ff' : '#8b949e',
    cursor: 'pointer',
    borderRadius: 4,
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: '#0d1117',
        color: '#f0f6fc',
        overflow: 'hidden',
      }}
    >
      {/* 顶部标题栏 */}
      <header
        style={{
          height: 40,
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 13 }}>
          {doc.name} (专业剪辑模式)
        </span>
        <button
          type="button"
          onClick={() => setRightTab('export')}
          style={{
            padding: '3px 12px',
            fontSize: 11,
            fontWeight: 'bold',
            background: '#238636',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          导出作品
        </button>
      </header>

      {/* 中间核心区：左侧工具面板 + 中央监视器 + 右侧检测器 */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 300px', overflow: 'hidden' }}>
        {/* 左侧功能栏 */}
        <aside style={{ borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
          <div style={{ display: 'flex', gap: 4, padding: 8, borderBottom: '1px solid #21262d' }}>
            <button type="button" onClick={() => setLeftTab('media')} style={navBtnStyle(leftTab === 'media')}>素材</button>
            <button type="button" onClick={() => setLeftTab('templates')} style={navBtnStyle(leftTab === 'templates')}>模板</button>
            <button type="button" onClick={() => setLeftTab('transitions')} style={navBtnStyle(leftTab === 'transitions')}>转场</button>
            <button type="button" onClick={() => setLeftTab('effects')} style={navBtnStyle(leftTab === 'effects')}>滤镜</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {leftTab === 'media' && <MediaPanel editor={editor} />}
            {leftTab === 'templates' && <TemplatePanel editor={editor} playheadUs={playheadUs} />}
            {leftTab === 'transitions' && <TransitionsPanel editor={editor} />}
            {leftTab === 'effects' && <EffectsPanel editor={editor} />}
          </div>
        </aside>

        {/* 中央实时合成监视器 */}
        <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PlayerSurface
            editor={editor}
            playheadUs={playheadUs}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onSeek={seek}
          />
        </main>

        {/* 右侧属性与扩展面板 */}
        <aside style={{ borderLeft: '1px solid #30363d', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
          <div style={{ display: 'flex', gap: 2, padding: 8, borderBottom: '1px solid #21262d', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setRightTab('inspector')} style={navBtnStyle(rightTab === 'inspector')}>属性</button>
            <button type="button" onClick={() => setRightTab('captions')} style={navBtnStyle(rightTab === 'captions')}>字幕</button>
            <button type="button" onClick={() => setRightTab('keyframes')} style={navBtnStyle(rightTab === 'keyframes')}>关键帧</button>
            <button type="button" onClick={() => setRightTab('mixer')} style={navBtnStyle(rightTab === 'mixer')}>混音</button>
            <button type="button" onClick={() => setRightTab('export')} style={navBtnStyle(rightTab === 'export')}>导出</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {rightTab === 'inspector' && <InspectorPanel editor={editor} />}
            {rightTab === 'captions' && <CaptionsPanel editor={editor} playheadUs={playheadUs} onSeek={seek} />}
            {rightTab === 'keyframes' && <KeyframesPanel editor={editor} playheadUs={playheadUs} onSeek={seek} />}
            {rightTab === 'mixer' && <AudioMixerPanel editor={editor} />}
            {rightTab === 'export' && <ExportPanel editor={editor} exportMode="inline" />}
          </div>
        </aside>
      </div>

      {/* 底部多轨时间轴 */}
      <div style={{ height: 260, flexShrink: 0, borderTop: '1px solid #30363d' }}>
        <TimelinePanel
          editor={editor}
          variant="full"
          playheadUs={playheadUs}
          onSeek={seek}
        />
      </div>
    </div>
  )
}
