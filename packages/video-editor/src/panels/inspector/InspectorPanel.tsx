/**
 * 完整 Inspector 属性检视器组件
 * 对标剪映专业版/FCPX 上下文智能感知设计
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { VideoClipElement, ImageClipElement, TextClipElement, ShotClipElement, TransformBox, ElementMask } from '../../core/project.ts'
import {
  UpdateElementTransformCommand,
  AlignElementsCommand,
  DistributeElementsCommand,
  UpdateElementMaskCommand,
  UpdateTextClipCommand,
} from '../../core/commands/index.ts'
import { formatTimeCode } from '../../core/time.ts'
import { TransformSection } from './TransformSection.tsx'
import { MaskSection } from './MaskSection.tsx'
import { LayoutPresetsCard } from './LayoutPresetsCard.tsx'
import { TextPanel } from '../captions/TextPanel.tsx'
import { CaptionStyleSection } from '../captions/CaptionStyleSection.tsx'
import { isCaptionTextClip } from '../captions/sync-text-track.ts'
import { ShotInspectorSection } from './ShotInspectorSection.tsx'
import type { AlignmentMode, DistributionAxis } from './transform-math.ts'
import {
  AlignLeftIcon,
  AlignCenterHorizontalIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignMiddleVerticalIcon,
  AlignBottomIcon,
  DistributeHorizontalIcon,
  DistributeVerticalIcon,
  AlignCenterAllIcon,
  ResetCcwIcon,
  SlidersIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from './inspector-icons.tsx'
import { PanelHint } from '../shared/PanelChrome.tsx'
import '../shared/panel-chrome.css'

export type InspectorPanelProps = {
  editor: EditorInstance
  style?: React.CSSProperties
  className?: string
  /** 宿主注入：字幕字体 @font-face 加载 */
  loadCaptionFont?: (fontId: string) => Promise<void>
}

/** 防止在固定高度 flex 容器内被压扁裁切（滚动交给外层 .vf-right__scroll 等） */
const inspectorBlockStyle: React.CSSProperties = { flexShrink: 0 }

export function InspectorPanel({ editor, style, className, loadCaptionFont }: InspectorPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [selectedIds, setSelectedIds] = useState(() => editor.getSelectedElementIds())
  const [lockAspect, setLockAspect] = useState(true)
  const [alignHighlight, setAlignHighlight] = useState<
    AlignmentMode | DistributionAxis | 'center-all' | null
  >(null)

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedIds(editor.getSelectedElementIds())
    })
  }, [editor])

  useEffect(() => {
    setAlignHighlight(null)
  }, [selectedIds.join('|')])

  // 获取当前选中的所有元素
  const selectedElements = doc.tracks
    .flatMap((t) => t.elements)
    .filter((e) => selectedIds.includes(e.id))

  // 空间尺寸与对齐面板默认保持展开可见，避免用户误以为缩放属性丢失
  const [transformCollapsed, setTransformCollapsed] = useState(false)
  // 模式切换：镜头专属内容 ('content') 还是 基础排版空间缩放 ('transform')
  const [viewMode, setViewMode] = useState<'content' | 'transform'>('content')

  useEffect(() => {
    const handleSwitchMode = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode?: 'content' | 'transform' }>
      if (customEvent.detail?.mode) {
        setViewMode(customEvent.detail.mode)
      } else {
        setViewMode((v) => (v === 'content' ? 'transform' : 'content'))
      }
    }
    window.addEventListener('video-factory:toggle-inspector-mode', handleSwitchMode)
    return () => window.removeEventListener('video-factory:toggle-inspector-mode', handleSwitchMode)
  }, [])

  // 当没有选中任何片段时，展示专业的大厂级「工程/画布属性概览」
  if (selectedElements.length === 0) {
    const totalClips = doc.tracks.reduce((acc, t) => acc + t.elements.length, 0)
    const fps = doc.canvas.fps.num / doc.canvas.fps.den

    return (
      <div
        className={['ve-inspector-panel', className].filter(Boolean).join(' ')}
        data-testid="inspector-panel-empty"
        style={{
          padding: '4px 12px 12px',
          color: 'var(--foreground)',
          fontSize: 12,
          background: 'var(--card)',
          minHeight: 0,
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          ...style,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 12, letterSpacing: '-0.01em' }}>工程属性</span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 7px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--muted) 85%, transparent)',
              color: 'var(--muted-foreground)',
              fontWeight: 500,
            }}
          >
            全局画布
          </span>
        </div>

        <div
          style={{
            background: 'color-mix(in srgb, var(--muted) 72%, var(--card))',
            borderRadius: 8,
            padding: '6px 10px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {[
            { label: '画幅分辨率', value: `${doc.canvas.width} × ${doc.canvas.height}`, strong: true },
            {
              label: '画面比例',
              value: doc.canvas.width >= doc.canvas.height
                ? `${(doc.canvas.width / doc.canvas.height).toFixed(2)}:1 (横屏)`
                : `1:${(doc.canvas.height / doc.canvas.width).toFixed(2)} (竖屏)`,
            },
            { label: '项目帧率', value: `${Math.round(fps)} FPS` },
            { label: '总时长', value: formatTimeCode(doc.durationUs), primary: true },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
                padding: '4px 0',
                lineHeight: 1.35,
              }}
            >
              <span style={{ color: 'var(--muted-foreground)' }}>{row.label}</span>
              <span
                style={{
                  fontWeight: row.strong || row.primary ? 600 : 500,
                  color: row.primary ? 'var(--primary)' : 'var(--foreground)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            background: 'color-mix(in srgb, var(--muted) 72%, var(--card))',
            borderRadius: 8,
            padding: '6px 10px 4px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--muted-foreground)',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              padding: '1px 0 3px',
            }}
          >
            时间线统计
          </div>
          {[
            { label: '编排轨道', value: `${doc.tracks.length} 条` },
            { label: '片段总数', value: `${totalClips} 个` },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
                padding: '4px 0',
                lineHeight: 1.35,
              }}
            >
              <span style={{ color: 'var(--muted-foreground)' }}>{row.label}</span>
              <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{row.value}</span>
            </div>
          ))}
        </div>

        <PanelHint>
          在时间轴上点击任意镜头、字幕或音频片段，即可在此调节精准属性。
        </PanelHint>
      </div>
    )
  }

  const primaryElement = selectedElements[0]
  const hasTransform = 'transform' in primaryElement && primaryElement.transform
  const isMedia = primaryElement.type === 'video' || primaryElement.type === 'image'
  const isText = primaryElement.type === 'text'
  const isCaptionMarker = isText && isCaptionTextClip(primaryElement)
  const isTitleText = isText && !isCaptionMarker
  const isShot = primaryElement.type === 'shot'
  const captionClipIds = selectedElements.filter((el) => isCaptionTextClip(el)).map((el) => el.id)
  const allSelectedAreCaptions =
    selectedElements.length > 0 && selectedElements.every((el) => isCaptionTextClip(el))
  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  const mask = isMedia ? (primaryElement as VideoClipElement | ImageClipElement).mask : undefined

  // 对齐操作
  const handleAlign = (mode: AlignmentMode) => {
    if (selectedIds.length === 0) return
    setAlignHighlight(mode)
    editor.executeCommand(new AlignElementsCommand(selectedIds, mode))
  }

  // 完全居中
  const handleCenterAll = () => {
    if (selectedIds.length === 0) return
    setAlignHighlight('center-all')
    editor.executeCommand(new AlignElementsCommand(selectedIds, 'center'))
    editor.executeCommand(new AlignElementsCommand(selectedIds, 'middle'))
  }

  // 分布操作
  const handleDistribute = (axis: DistributionAxis) => {
    if (selectedIds.length < 3) return
    editor.executeCommand(new DistributeElementsCommand(selectedIds, axis))
  }

  // 变换修改
  const handleTransformChange = (patch: Partial<TransformBox>) => {
    editor.executeCommand(new UpdateElementTransformCommand(primaryElement.id, patch))
  }

  // 一键重置变换
  const handleResetTransform = () => {
    handleTransformChange({
      x: 0,
      y: 0,
      width: doc.canvas.width,
      height: doc.canvas.height,
      rotationDeg: 0,
      opacity: 1,
      round: 0,
      cropMode: 'cover',
      contentFocusX: 0.5,
      contentFocusY: 0.5,
    })
  }

  // 蒙版修改
  const handleMaskChange = (newMask: ElementMask) => {
    editor.executeCommand(new UpdateElementMaskCommand(primaryElement.id, newMask))
  }

  const handleMaskRemove = () => {
    editor.executeCommand(
      new UpdateElementMaskCommand(primaryElement.id, {
        kind: 'none',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        inverted: false,
        feather: 0,
      })
    )
  }

  // 标题文字修改（非字幕 marker）；字幕走 CaptionStyleSection / Cue
  const handleTextChange = (patch: { text?: string; style?: any }) => {
    if (!isTitleText) return
    const textElem = primaryElement as TextClipElement
    editor.executeCommand(
      new UpdateTextClipCommand(textElem.id, {
        text: patch.text,
        style: patch.style ? { ...textElem.style, ...patch.style } : undefined,
      }),
    )
  }

  // 工具栏图标按钮样式
  const iconBtnStyle: React.CSSProperties = {
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    color: 'var(--foreground)',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s ease',
  }

  return (
    <div
      className={['ve-inspector-panel', className].filter(Boolean).join(' ')}
      data-testid="inspector-panel"
      style={{
        padding: '4px 12px 12px',
        background: 'var(--card)',
        color: 'var(--foreground)',
        fontSize: 12,
        minHeight: 0,
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* 顶部标题与类型徽标 */}
      <div style={{ ...inspectorBlockStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em' }}>属性检视</span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
              color: 'var(--primary)',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {primaryElement.type}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isShot && hasTransform && (
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === 'content' ? 'transform' : 'content'))}
              title={viewMode === 'content' ? '切换至基础空间排版与缩放设置' : '切换回镜头内容精修'}
              style={{
                ...iconBtnStyle,
                width: 'auto',
                padding: '0 8px',
                fontSize: 10,
                background: viewMode === 'transform' ? 'var(--primary)' : 'var(--muted)',
                color: viewMode === 'transform' ? 'var(--primary-foreground)' : 'var(--foreground)',
                gap: 4,
                fontWeight: 600,
              }}
            >
              <SlidersIcon size={11} />
              <span>{viewMode === 'content' ? '基础排版' : '返回镜头'}</span>
            </button>
          )}

          {hasTransform && (
            <button
              type="button"
              onClick={handleResetTransform}
              title="一键恢复默认铺满画幅"
              style={{
                ...iconBtnStyle,
                width: 'auto',
                padding: '0 6px',
                fontSize: 10,
                color: 'var(--muted-foreground)',
                gap: 4,
              }}
            >
              <ResetCcwIcon size={11} />
              <span>复位</span>
            </button>
          )}
          {selectedElements.length > 1 && (
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
              多选 {selectedElements.length} 项
            </span>
          )}
        </div>
      </div>

      {/* 字幕 marker 不展示像素 transform（位置走 captionStyle 比例） */}
      {hasTransform && !isCaptionMarker && (!isShot || viewMode === 'transform') && (
        <div
          style={{
            ...inspectorBlockStyle,
            borderRadius: 10,
            overflow: 'visible',
            background: 'color-mix(in srgb, var(--muted) 72%, var(--card))',
          }}
        >
          <button
            type="button"
            onClick={() => setTransformCollapsed((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--foreground)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>基础排版与画面缩放</span>
              <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 500 }}>
                {Math.round((primaryElement.transform.width / doc.canvas.width) * 100)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted-foreground)' }}>
              <span>{transformCollapsed ? '展开' : '收起'}</span>
              {transformCollapsed ? <ChevronDownIcon size={11} /> : <ChevronUpIcon size={11} />}
            </div>
          </button>

          {!transformCollapsed && (
            <div
              style={{
                padding: '0 10px 10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                borderTop: '1px solid color-mix(in srgb, var(--border) 55%, transparent)',
                paddingTop: 8,
              }}
            >
              {/* 专业对齐与分布工具栏 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>对齐与分布</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--card)',
                    padding: '4px 6px',
                    borderRadius: 8,
                  }}
                >
                  <button
                    type="button"
                    className="ve-inspector-icon-btn"
                    data-active={alignHighlight === 'left'}
                    onClick={() => handleAlign('left')}
                    title="左对齐"
                  >
                    <AlignLeftIcon />
                  </button>
                  <button
                    type="button"
                    className="ve-inspector-icon-btn"
                    data-active={alignHighlight === 'center' || alignHighlight === 'center-all'}
                    onClick={() => handleAlign('center')}
                    title="水平居中对齐"
                  >
                    <AlignCenterHorizontalIcon />
                  </button>
                  <button
                    type="button"
                    className="ve-inspector-icon-btn"
                    data-active={alignHighlight === 'right'}
                    onClick={() => handleAlign('right')}
                    title="右对齐"
                  >
                    <AlignRightIcon />
                  </button>

                  <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />

                  <button
                    type="button"
                    className="ve-inspector-icon-btn"
                    data-active={alignHighlight === 'top'}
                    onClick={() => handleAlign('top')}
                    title="顶对齐"
                  >
                    <AlignTopIcon />
                  </button>
                  <button
                    type="button"
                    className="ve-inspector-icon-btn"
                    data-active={alignHighlight === 'middle' || alignHighlight === 'center-all'}
                    onClick={() => handleAlign('middle')}
                    title="垂直居中对齐"
                  >
                    <AlignMiddleVerticalIcon />
                  </button>
                  <button
                    type="button"
                    className="ve-inspector-icon-btn"
                    data-active={alignHighlight === 'bottom'}
                    onClick={() => handleAlign('bottom')}
                    title="底对齐"
                  >
                    <AlignBottomIcon />
                  </button>

                  <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />

                  <button
                    type="button"
                    className="ve-inspector-icon-btn"
                    data-active={alignHighlight === 'center-all'}
                    onClick={handleCenterAll}
                    title="画面正中居中 (水平+垂直)"
                  >
                    <AlignCenterAllIcon />
                  </button>

                  {selectedIds.length >= 3 && (
                    <>
                      <button
                        type="button"
                        className="ve-inspector-icon-btn"
                        data-active={alignHighlight === 'horizontal'}
                        onClick={() => {
                          setAlignHighlight('horizontal')
                          handleDistribute('horizontal')
                        }}
                        title="水平均匀分布"
                      >
                        <DistributeHorizontalIcon />
                      </button>
                      <button
                        type="button"
                        className="ve-inspector-icon-btn"
                        data-active={alignHighlight === 'vertical'}
                        onClick={() => {
                          setAlignHighlight('vertical')
                          handleDistribute('vertical')
                        }}
                        title="垂直均匀分布"
                      >
                        <DistributeVerticalIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 空间变换小节（X, Y, 宽, 高, 旋转, 透明度, 缩放） */}
              <TransformSection
                transform={primaryElement.transform}
                lockAspect={lockAspect}
                onChange={handleTransformChange}
                onToggleLockAspect={() => setLockAspect((v) => !v)}
                canvasWidth={doc.canvas.width}
                canvasHeight={doc.canvas.height}
              />

              {/* 构图布局预设（微型线框矩阵） */}
              <LayoutPresetsCard
                canvasWidth={doc.canvas.width}
                canvasHeight={doc.canvas.height}
                transform={primaryElement.transform}
                onApplyLayout={handleTransformChange}
              />
            </div>
          )}
        </div>
      )}

      {/* 字幕烧录真源：captionStyle + Cue */}
      {(isCaptionMarker || allSelectedAreCaptions) && (
        <div style={inspectorBlockStyle}>
          <CaptionStyleSection
            editor={editor}
            doc={doc}
            selectedCaptionClipIds={captionClipIds.length > 0 ? captionClipIds : [primaryElement.id]}
            loadFont={loadCaptionFont}
          />
        </div>
      )}

      {/* 普通标题文字（非字幕 marker） */}
      {isTitleText && (
        <div style={inspectorBlockStyle}>
          <TextPanel
            element={primaryElement as TextClipElement}
            onChange={handleTextChange}
          />
        </div>
      )}

      {/* 镜头元素专有内容与素材检视 */}
      {isShot && viewMode === 'content' && (
        <div style={inspectorBlockStyle}>
          <ShotInspectorSection
            element={primaryElement as ShotClipElement}
            editor={editor}
            fps={fps}
          />
        </div>
      )}

      {/* 蒙版小节 */}
      {isMedia && (
        <div style={inspectorBlockStyle}>
          <MaskSection
            mask={mask}
            onChange={handleMaskChange}
            onRemove={handleMaskRemove}
          />
        </div>
      )}
    </div>
  )
}
