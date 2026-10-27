/**
 * 镜头专属内容与视觉属性检视器（三栏子页签 + 全要素看板 + 双层调色系统）
 *
 * 允许用户在时间轴点击 shot 镜头后：
 * 1. 结构化子页签切换：【内容与文案】、【看板与图表】、【视觉配色】；
 * 2. 快捷画面定位：「定位第一幕」与「定位第二幕」毫秒级跳转；
 * 3. 杀手级能力：AI 智能解析并填满本镜头，支持输入业务台词全自动填入参数；
 * 4. 视觉配色：6 套经典色盘卡片 + 5 路高级自定义拾色器。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react'
import type { ShotClipElement } from '../../core/project.ts'
import type { EditorInstance } from '../../core/instance.ts'
import { UpdateShotClipCommand } from '../../core/commands/shot-commands.ts'
import { getShotSchema, type ShotParamField } from '../../demos/shot-schemas.ts'
import { findShot } from '../../demos/registry.generated.ts'
import { formatTimeCode } from '../../core/time.ts'
import { refineTextWithAi } from '../../../../../src/features/video-factory/lib/ai-refine-text'
import { extractShotParamsWithAi } from '../../../../../src/features/video-factory/lib/ai-extract-shot'
import {
  SparklesIcon,
  WandIcon,
  CompassIcon,
  PaletteIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ResetCcwIcon,
  LayoutIcon,
  EditIcon,
} from './inspector-icons.tsx'
import { useEditorSelector } from '../../react/hooks.ts'

function actSegmentButtonStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '4px 6px',
    fontSize: 10,
    borderRadius: 4,
    border: 'none',
    background: isActive ? 'var(--primary)' : 'transparent',
    color: isActive ? 'var(--primary-foreground)' : 'var(--foreground)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontWeight: isActive ? 600 : 500,
  }
}

export type ShotInspectorSectionProps = {
  element: ShotClipElement
  editor: EditorInstance
  fps: number
}

// 预设经典色盘配置
const PRESET_PALETTES = [
  { id: 'dark-blue', name: '深蓝科技', bg: '#0a0f1e', primary: '#4d7cff', secondary: '#19d3b4' },
  { id: 'neon-purple', name: '极光暗紫', bg: '#0d071a', primary: '#9d4dff', secondary: '#d319a8' },
  { id: 'cyber-teal', name: '赛博青绿', bg: '#061414', primary: '#19d3b4', secondary: '#00ffc8' },
  { id: 'obsidian-gold', name: '曜石黑金', bg: '#0f0e0b', primary: '#e0b354', secondary: '#ffd700' },
  { id: 'sunset-orange', name: '活力暖阳', bg: '#140a08', primary: '#ff5722', secondary: '#ff9800' },
  { id: 'porcelain-light', name: '极简瓷白', bg: '#f4f6fa', primary: '#2563eb', secondary: '#0d9488' },
]

export function ShotInspectorSection({ element, editor, fps }: ShotInspectorSectionProps) {
  const schema = getShotSchema(element.shotId)
  const definition = findShot(element.shotId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeSlotKeyRef = useRef<string>('')

  // 配色键只在真正接了配色的镜头里才存在；没有就别渲染一排拖了不动的手柄
  const hasColorKeys = Boolean(
    definition?.editableKeys?.some((key) => key === 'colorTheme' || key.startsWith('custom')),
  )
  const [activeTab, setActiveTab] = useState<'content' | 'dashboard' | 'style'>('content')
  const [showAutoFillBox, setShowAutoFillBox] = useState(false)
  const [autoFillInput, setAutoFillInput] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [refiningKey, setRefiningKey] = useState<string | null>(null)

  const playheadUs = useEditorSelector((s) => s.playheadUs)
  const act2Us = useMemo(
    () => element.startUs + Math.round(element.durationUs * 0.8),
    [element.startUs, element.durationUs],
  )
  const clipEndUs = element.startUs + element.durationUs
  const activeAct: 1 | 2 = useMemo(() => {
    if (playheadUs >= element.startUs && playheadUs < clipEndUs) {
      return playheadUs >= act2Us ? 2 : 1
    }
    return playheadUs < element.startUs ? 1 : 2
  }, [playheadUs, element.startUs, clipEndUs, act2Us])

  // 监听画布原位点击联动事件，自动切页签并高亮聚焦对应输入框
  useEffect(() => {
    const handleFocusField = (e: Event) => {
      const customEvent = e as CustomEvent<{
        shotId?: string
        fieldKey?: string
        category?: 'content' | 'dashboard' | 'style'
      }>
      if (!customEvent.detail) return
      const { category, fieldKey } = customEvent.detail

      if (category) {
        setActiveTab(category)
      }

      if (fieldKey) {
        setTimeout(() => {
          const input = document.getElementById(`shot-field-${fieldKey}`)
          if (input) {
            input.scrollIntoView({ behavior: 'smooth', block: 'center' })
            input.focus()
            input.style.transition = 'box-shadow 0.2s ease, border-color 0.2s ease'
            input.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.6)'
            input.style.borderColor = 'var(--primary, #3b82f6)'
            setTimeout(() => {
              input.style.boxShadow = ''
              input.style.borderColor = ''
            }, 1400)
          }
        }, 80)
      }
    }

    window.addEventListener('video-factory:focus-inspector-field', handleFocusField)
    return () => window.removeEventListener('video-factory:focus-inspector-field', handleFocusField)
  }, [])

  const overrides = element.overrides || {}
  const slots = element.slots || {}

  const handleOverrideChange = (key: string, value: string) => {
    editor.executeCommand(
      new UpdateShotClipCommand(
        element.id,
        {
          overrides: { [key]: value },
        },
        fps,
      ),
    )
  }

  const handleBatchOverrides = (patch: Record<string, string>) => {
    editor.executeCommand(
      new UpdateShotClipCommand(
        element.id,
        {
          overrides: { ...overrides, ...patch },
        },
        fps,
      ),
    )
  }

  const handleSlotChange = (key: string, value: string) => {
    editor.executeCommand(
      new UpdateShotClipCommand(
        element.id,
        {
          slots: { [key]: value },
        },
        fps,
      ),
    )
  }

  const handleRateChange = (nextRate: number) => {
    editor.executeCommand(
      new UpdateShotClipCommand(
        element.id,
        {
          rate: nextRate,
        },
        fps,
      ),
    )
  }

  const handleResetOverrides = () => {
    editor.executeCommand(
      new UpdateShotClipCommand(
        element.id,
        {
          overrides: {},
          slots: {},
        },
        fps,
      ),
    )
  }

  const handleResetSingleField = (key: string) => {
    const nextOverrides = { ...overrides }
    delete nextOverrides[key]
    editor.executeCommand(
      new UpdateShotClipCommand(
        element.id,
        {
          overrides: nextOverrides,
        },
        fps,
      ),
    )
  }

  // 第一幕定位：起始关键帧
  const handleSeekToAct1 = () => {
    editor.setPlayheadUs(element.startUs)
  }

  // 第二幕定位：后段全屏看板/核心接管关键帧
  const handleSeekToAct2 = () => {
    const act2Us = element.startUs + Math.round(element.durationUs * 0.8)
    editor.setPlayheadUs(act2Us)
  }

  const handleTriggerUpload = (slotKey: string) => {
    activeSlotKeyRef.current = slotKey
    fileInputRef.current?.click()
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeSlotKeyRef.current) return
    const url = URL.createObjectURL(file)
    handleSlotChange(activeSlotKeyRef.current, url)
    e.target.value = ''
  }

  // AI 单项精炼
  const handleAiTrimText = async (fieldKey: string, currentVal: string, fieldLabel: string) => {
    if (!currentVal || refiningKey) return
    setRefiningKey(fieldKey)
    try {
      const refined = await refineTextWithAi({
        text: currentVal,
        fieldLabel,
        maxChars: fieldKey === 'text' || fieldKey === 'title' ? 8 : 14,
      })
      if (refined) {
        handleOverrideChange(fieldKey, refined)
      }
    } finally {
      setRefiningKey(null)
    }
  }

  // AI 智能解析并填满本镜头
  const handleExecuteAutoFill = async () => {
    const textToProcess = autoFillInput.trim() || overrides.text || overrides.title || overrides.subline || ''
    if (!textToProcess || isExtracting) return
    setIsExtracting(true)
    try {
      const extracted = await extractShotParamsWithAi({
        inputText: textToProcess,
        shotId: element.shotId,
        schema,
      })
      if (extracted && Object.keys(extracted).length > 0) {
        handleBatchOverrides(extracted)
        setShowAutoFillBox(false)
        setAutoFillInput('')
      }
    } finally {
      setIsExtracting(false)
    }
  }

  // 字段分类判定
  const resolveFieldCategory = (field: ShotParamField): 'content' | 'dashboard' | 'style' => {
    if (field.category) return field.category
    const k = field.key.toLowerCase()
    if (k.includes('color') || k.startsWith('custom') || field.type === 'color') return 'style'
    if (k.includes('dashboard') || k.includes('kpi') || k.includes('chart') || k.includes('region')) return 'dashboard'
    return 'content'
  }

  const contentFields = schema.fields.filter((f) => resolveFieldCategory(f) === 'content')
  const dashboardFields = schema.fields.filter((f) => resolveFieldCategory(f) === 'dashboard')

  const currentColorTheme = overrides.colorTheme || 'dark-blue'
  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--muted)',
        padding: 10,
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* 头部：镜头名称与多幕定位 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--foreground)' }}>
              {definition?.name || element.shotId.split('/')[1] || element.shotId}
            </span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
              {definition?.categoryLabel || element.shotId.split('/')[0]} · {element.sourceDurationFrames} 帧
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetOverrides}
            title="清空定制内容，恢复动效默认预设"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <ResetCcwIcon size={10} />
            <span>复位预设</span>
          </button>
        </div>

        {/* 幕次定位 Segmented Control */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--card)',
            padding: 2,
            borderRadius: 6,
            border: '1px solid var(--border)',
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={handleSeekToAct1}
            title="播放头对齐到第 1 幕起始（首帧）"
            aria-pressed={activeAct === 1}
            style={actSegmentButtonStyle(activeAct === 1)}
          >
            <CompassIcon size={11} />
            <span>第 1 幕 · 镂空大字</span>
          </button>
          <button
            type="button"
            onClick={handleSeekToAct2}
            title="播放头跳到第 2 幕（全屏看板展示期）"
            aria-pressed={activeAct === 2}
            style={actSegmentButtonStyle(activeAct === 2)}
          >
            <CompassIcon size={11} />
            <span>第 2 幕 · 全屏看板</span>
          </button>
        </div>
      </div>

      {schema.fields.length === 0 ? (
        /* 诚实提示：该镜头没有任何真实参数入口（注册表 editableKeys 为空），
           不再渲染会写入无效 overrides 的假控件——填了也不生效的输入框比没有更糟。 */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'var(--card)',
            border: '1px dashed var(--border)',
            borderRadius: 6,
            padding: 10,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>该镜头为内置演示场景</span>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
            画面中的文案、表格与品牌均为动效自带的示例内容，当前版本不支持替换；时间轴上的裁剪、变速与排序仍然可用。可编辑的文案与配色会随镜头适配陆续开放。
          </span>
        </div>
      ) : (
      <>

      {/* AI 智能解析与参数自动填入卡片 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          type="button"
          onClick={() => setShowAutoFillBox((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            fontSize: 11,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--foreground)',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
            <SparklesIcon size={13} />
            <span style={{ fontWeight: 600 }}>AI 智能解析并填入镜头</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)', fontSize: 10 }}>
            <span>{showAutoFillBox ? '收起' : '展开'}</span>
            {showAutoFillBox ? <ChevronUpIcon size={11} /> : <ChevronDownIcon size={11} />}
          </div>
        </button>

        {showAutoFillBox && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              background: 'var(--card)',
              padding: 8,
              borderRadius: 6,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
              粘贴口播台词或业务阐述，AI 自动将大字、正文、看板全要素填入：
            </div>
            <textarea
              rows={2}
              value={autoFillInput}
              placeholder="例如：未来已来，智能创作吞吐大盘突破248万次，单片耗时降低35%，渲染流水线全速推进"
              onChange={(e) => setAutoFillInput(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 6px',
                fontSize: 11,
                background: 'var(--muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                type="button"
                onClick={() => setShowAutoFillBox(false)}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isExtracting}
                onClick={handleExecuteAutoFill}
                style={{
                  fontSize: 10,
                  padding: '3px 10px',
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 4,
                  color: 'var(--primary-foreground)',
                  cursor: isExtracting ? 'wait' : 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <SparklesIcon size={11} />
                <span>{isExtracting ? '大模型智能拆解中…' : '立即解析并填入'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 结构化子页签切换（Segmented Sub-Tabs） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          background: 'var(--card)',
          padding: 2,
          borderRadius: 6,
          border: '1px solid var(--border)',
          gap: 2,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('content')}
          style={{
            padding: '5px 0',
            fontSize: 10,
            borderRadius: 4,
            border: 'none',
            background: activeTab === 'content' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'content' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            cursor: 'pointer',
            fontWeight: activeTab === 'content' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <EditIcon size={11} />
          <span>内容与文案</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          style={{
            padding: '5px 0',
            fontSize: 10,
            borderRadius: 4,
            border: 'none',
            background: activeTab === 'dashboard' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'dashboard' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            cursor: 'pointer',
            fontWeight: activeTab === 'dashboard' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <LayoutIcon size={11} />
          <span>看板数据 ({dashboardFields.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('style')}
          style={{
            padding: '5px 0',
            fontSize: 10,
            borderRadius: 4,
            border: 'none',
            background: activeTab === 'style' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'style' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            cursor: 'pointer',
            fontWeight: activeTab === 'style' ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all 0.15s ease',
          }}
        >
          <PaletteIcon size={11} />
          <span>视觉配色</span>
        </button>
      </div>

      {/* Tab 1: 【内容与文案】 */}
      {activeTab === 'content' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contentFields.length > 0 && (
            <div style={{ fontSize: 9, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
              文案按 1920×1080 横屏构图排布；该镜头尚未做竖屏（9:16）适配，超出标注字数的长文案可能出画。
            </div>
          )}
          {contentFields.map((field) => {
            const isSlot = Boolean(field.isSlot)
            const isCustomized = isSlot
              ? Boolean(slots[field.key])
              : overrides[field.key] !== undefined && overrides[field.key] !== ''
            const displayValue = isSlot
              ? slots[field.key] || ''
              : overrides[field.key] !== undefined
                ? overrides[field.key]
                : field.defaultValue || ''
            const charCount = Array.from(displayValue).length
            const overLimit = typeof field.maxLength === 'number' && charCount > field.maxLength

            if (field.type === 'image') {
              return (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--muted-foreground)' }}>{field.label}</span>
                      <span
                        style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: isCustomized ? 'var(--primary)' : 'var(--card)',
                          color: isCustomized ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                          fontWeight: 500,
                        }}
                      >
                        {isCustomized ? '已自定义' : '内置看板'}
                      </span>
                    </div>
                    {isCustomized && (
                      <button
                        type="button"
                        onClick={() => handleSlotChange(field.key, '')}
                        style={{ fontSize: 10, color: 'var(--destructive, #ef4444)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        恢复默认
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {displayValue ? (
                      <img
                        src={displayValue}
                        alt={field.label}
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 4,
                          background: 'var(--card)',
                          border: '1px dashed var(--border)',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 9,
                          color: 'var(--muted-foreground)',
                          textAlign: 'center',
                          padding: 2,
                        }}
                      >
                        内置全屏看板
                      </div>
                    )}

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleTriggerUpload(field.key)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: 'var(--foreground)',
                        }}
                      >
                        {displayValue ? '替换为本地图片' : '上传自定义图片'}
                      </button>
                      {field.description && (
                        <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{field.description}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>{field.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        padding: '1px 4px',
                        borderRadius: 3,
                        background: isCustomized ? 'var(--primary)' : 'var(--card)',
                        border: '1px solid var(--border)',
                        color: isCustomized ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                        fontWeight: 500,
                      }}
                    >
                      {isCustomized ? '已定制' : '预设默认'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isCustomized && (
                      <button
                        type="button"
                        onClick={() => handleResetSingleField(field.key)}
                        title="恢复为该镜头预设默认文案"
                        style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        恢复默认
                      </button>
                    )}
                    {displayValue && (
                      <button
                        type="button"
                        disabled={Boolean(refiningKey)}
                        onClick={() => void handleAiTrimText(field.key, displayValue, field.label)}
                        title="调用真实大模型 AI 深度精炼至爆款短语"
                        style={{
                          fontSize: 10,
                          color: 'var(--primary)',
                          background: 'none',
                          border: 'none',
                          cursor: refiningKey === field.key ? 'wait' : 'pointer',
                          fontWeight: refiningKey === field.key ? 600 : 400,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <WandIcon size={10} />
                        <span>{refiningKey === field.key ? 'AI 提炼中…' : 'AI 精炼'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {field.type === 'textarea' ? (
                  <textarea
                    id={`shot-field-${field.key}`}
                    rows={2}
                    value={displayValue}
                    placeholder={field.placeholder || field.defaultValue}
                    onChange={(e) => handleOverrideChange(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: 11,
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--foreground)',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <input
                    id={`shot-field-${field.key}`}
                    type="text"
                    value={displayValue}
                    placeholder={field.placeholder || field.defaultValue}
                    onChange={(e) => handleOverrideChange(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: 11,
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--foreground)',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
                {typeof field.maxLength === 'number' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, gap: 6 }}>
                    <span style={{ color: overLimit ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                      {field.description ?? ''}
                    </span>
                    <span style={{ color: overLimit ? 'var(--destructive)' : 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                      {charCount}/{field.maxLength}
                      {overLimit ? ' · 建议精简' : ''}
                    </span>
                  </div>
                )}
              </div>
            )
          })}

          {/* 动效速率控制 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: 'var(--muted-foreground)' }}>镜头播放速率</span>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                {element.rate || 1}x ({formatTimeCode(element.durationUs)})
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {rates.map((r) => {
                const active = (element.rate || 1) === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRateChange(r)}
                    style={{
                      flex: 1,
                      padding: '3px 0',
                      fontSize: 10,
                      borderRadius: 4,
                      border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: active ? 'var(--primary)' : 'var(--card)',
                      color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                      cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {r}x
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 【看板与图表全要素】 */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dashboardFields.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--muted-foreground)', fontSize: 11 }}>
              当前镜头为排版/转场动效，无需配置第二幕数据看板。
            </div>
          ) : (
            dashboardFields.map((field) => {
              const isCustomized = overrides[field.key] !== undefined && overrides[field.key] !== ''
              const displayValue = overrides[field.key] !== undefined ? overrides[field.key] : field.defaultValue || ''
              const charCount = Array.from(displayValue).length
              const overLimit = typeof field.maxLength === 'number' && charCount > field.maxLength

              return (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                    <span style={{ color: 'var(--muted-foreground)' }}>{field.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isCustomized && (
                        <button
                          type="button"
                          onClick={() => handleResetSingleField(field.key)}
                          style={{ fontSize: 9, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          默认
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    id={`shot-field-${field.key}`}
                    type="text"
                    value={displayValue}
                    placeholder={field.placeholder || field.defaultValue}
                    onChange={(e) => handleOverrideChange(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      fontSize: 11,
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--foreground)',
                      boxSizing: 'border-box',
                    }}
                  />
                  {typeof field.maxLength === 'number' && (
                    <span style={{ fontSize: 9, textAlign: 'right', color: overLimit ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                      {charCount}/{field.maxLength}{overLimit ? ' · 建议精简' : ''}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab 3: 【视觉配色】 */}
      {activeTab === 'style' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!hasColorKeys && (
            <div style={{ fontSize: 9, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
              {definition?.colorFixed
                ? '该镜头配色随素材固定：画面主体是整页截图或共享界面素材，改色没有可落地的位置，因此不提供配色控件。'
                : '该镜头尚未接入配色槽位，暂不提供改色控件。'}
            </div>
          )}
          {hasColorKeys && definition?.colorMode === 'palette' && (
            <div style={{ fontSize: 9, lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
              该镜头自带色板：预设主题只替换「底色 / 主强调 / 次强调 / 墨色」4 个槽位，光影、材质与专色保持不变。
            </div>
          )}
          {/* 预设色盘卡片网格 */}
          {hasColorKeys && (
          <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>经典预设主题</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PRESET_PALETTES.map((palette) => {
                const isSelected = currentColorTheme === palette.id
                return (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => handleOverrideChange('colorTheme', palette.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: isSelected
                        ? 'color-mix(in srgb, var(--primary) 10%, var(--card))'
                        : 'var(--card)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: palette.primary,
                          border: '1px solid color-mix(in srgb, var(--foreground) 12%, transparent)',
                        }}
                      />
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: palette.secondary,
                          border: '1px solid color-mix(in srgb, var(--foreground) 12%, transparent)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>{palette.name}</span>
                      <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{palette.id}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 5 路高级自定义拾色器 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>5 路高级自定义拾色</span>
              {(overrides.customBg || overrides.customPrimary || overrides.customSecondary || overrides.customPanel || overrides.customInk) && (
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...overrides }
                    delete next.customBg
                    delete next.customPrimary
                    delete next.customSecondary
                    delete next.customPanel
                    delete next.customInk
                    editor.executeCommand(new UpdateShotClipCommand(element.id, { overrides: next }, fps))
                  }}
                  style={{ fontSize: 9, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  重置自定义色
                </button>
              )}
            </div>

            {[
              { key: 'customBg', label: '背景底色', defaultVal: '#0a0f1e' },
              { key: 'customPrimary', label: '主发光线条色', defaultVal: '#4d7cff' },
              { key: 'customSecondary', label: '次级高光亮点色', defaultVal: '#19d3b4' },
              { key: 'customPanel', label: '卡片面板底色', defaultVal: '#0f1730' },
              { key: 'customInk', label: '文字墨水色', defaultVal: '#eef3ff' },
            ].map((picker) => {
              const val = overrides[picker.key] || picker.defaultVal
              return (
                <div key={picker.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>{picker.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="color"
                      value={val}
                      onChange={(e) => handleOverrideChange(picker.key, e.target.value)}
                      style={{
                        width: 24,
                        height: 20,
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        cursor: 'pointer',
                        padding: 0,
                        background: 'transparent',
                      }}
                    />
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => handleOverrideChange(picker.key, e.target.value)}
                      style={{
                        width: 60,
                        padding: '2px 4px',
                        fontSize: 10,
                        background: 'var(--card)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          </>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}
