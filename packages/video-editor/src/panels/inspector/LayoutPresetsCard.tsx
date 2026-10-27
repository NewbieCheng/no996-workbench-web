/**
 * 业务与通用构图布局预设（微型线框矩阵版）
 * 对标剪映/FCP 紧凑视觉选择器，大幅节省检视器垂直空间
 */

import React, { useEffect, useState } from 'react'
import type { TransformBox } from '../../core/project.ts'
import '../shared/panel-chrome.css'
import { matchLayoutPresetFromTransform, type LayoutPresetType } from './layout-preset-match.ts'

export type { LayoutPresetType } from './layout-preset-match.ts'

export type LayoutPresetsCardProps = {
  canvasWidth: number
  canvasHeight: number
  transform?: TransformBox
  onApplyLayout: (transform: Partial<TransformBox>) => void
}

interface PresetItem {
  id: LayoutPresetType
  title: string
  desc: string
  compute: () => Partial<TransformBox>
  renderIcon: () => React.ReactNode
}

const fillClass = 've-layout-preset-fill'

export function LayoutPresetsCard({
  canvasWidth,
  canvasHeight,
  transform,
  onApplyLayout,
}: LayoutPresetsCardProps) {
  const [activeId, setActiveId] = useState<LayoutPresetType | null>(null)

  useEffect(() => {
    if (!transform) return
    setActiveId(matchLayoutPresetFromTransform(transform, canvasWidth, canvasHeight))
  }, [transform, canvasWidth, canvasHeight])

  const presets: PresetItem[] = [
    {
      id: 'fullscreen',
      title: '铺满全屏',
      desc: '贴合画幅覆盖 (Cover)',
      compute: () => ({
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        rotationDeg: 0,
        cropMode: 'cover',
        contentFocusX: 0.5,
        contentFocusY: 0.5,
      }),
      renderIcon: () => (
        <div className={fillClass} style={{ width: '100%', height: '100%', borderRadius: 1 }} />
      ),
    },
    {
      id: 'fit-contain',
      title: '自适应',
      desc: '居中完整不裁剪 (Contain)',
      compute: () => ({
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        rotationDeg: 0,
        cropMode: 'contain',
        contentFocusX: 0.5,
        contentFocusY: 0.5,
        round: 0,
      }),
      renderIcon: () => (
        <div
          className={fillClass}
          style={{
            width: '65%',
            height: '75%',
            margin: 'auto',
            borderRadius: 1,
          }}
        />
      ),
    },
    {
      id: 'pip-top-right',
      title: '右上画中画',
      desc: '右上角小浮窗 (35%)',
      compute: () => {
        const w = Math.round(canvasWidth * 0.35)
        const h = Math.round(canvasHeight * 0.35)
        return {
          x: canvasWidth - w - 40,
          y: 40,
          width: w,
          height: h,
          round: 16,
          cropMode: 'cover',
          contentFocusX: 0.5,
          contentFocusY: 0.5,
        }
      },
      renderIcon: () => (
        <div
          className={fillClass}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: '40%',
            height: '40%',
            borderRadius: 2,
          }}
        />
      ),
    },
    {
      id: 'pip-bottom-right',
      title: '右下画中画',
      desc: '右下角解说窗 (35%)',
      compute: () => {
        const w = Math.round(canvasWidth * 0.35)
        const h = Math.round(canvasHeight * 0.35)
        return {
          x: canvasWidth - w - 40,
          y: canvasHeight - h - 40,
          width: w,
          height: h,
          round: 16,
          cropMode: 'cover',
          contentFocusX: 0.5,
          contentFocusY: 0.5,
        }
      },
      renderIcon: () => (
        <div
          className={fillClass}
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: '40%',
            height: '40%',
            borderRadius: 2,
          }}
        />
      ),
    },
    {
      id: 'split-vertical-top',
      title: '上半屏',
      desc: '知识对比/课件分屏',
      compute: () => ({
        x: 0,
        y: 0,
        width: canvasWidth,
        height: Math.round(canvasHeight / 2),
        cropMode: 'cover',
        contentFocusX: 0.5,
        contentFocusY: 0.5,
      }),
      renderIcon: () => (
        <div
          className={fillClass}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '50%',
            borderRadius: '1px 1px 0 0',
          }}
        />
      ),
    },
    {
      id: 'split-vertical-bottom',
      title: '下半屏',
      desc: '口播人物出镜分屏',
      compute: () => ({
        x: 0,
        y: Math.round(canvasHeight / 2),
        width: canvasWidth,
        height: Math.round(canvasHeight / 2),
        cropMode: 'cover',
        contentFocusX: 0.5,
        contentFocusY: 0.5,
      }),
      renderIcon: () => (
        <div
          className={fillClass}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50%',
            borderRadius: '0 0 1px 1px',
          }}
        />
      ),
    },
    {
      id: 'center-card',
      title: '居中卡片',
      desc: '内嵌留白展台 (80%)',
      compute: () => {
        const w = Math.round(canvasWidth * 0.8)
        const h = Math.round(canvasHeight * 0.8)
        return {
          x: Math.round((canvasWidth - w) / 2),
          y: Math.round((canvasHeight - h) / 2),
          width: w,
          height: h,
          round: 24,
          cropMode: 'cover',
          contentFocusX: 0.5,
          contentFocusY: 0.5,
        }
      },
      renderIcon: () => (
        <div
          className={fillClass}
          style={{
            width: '70%',
            height: '70%',
            margin: 'auto',
            borderRadius: 3,
          }}
        />
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>构图布局预设</span>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>一键对齐画幅</span>
      </div>

      <div className="ve-layout-presets__grid">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="ve-layout-preset-btn"
            data-active={activeId === p.id}
            aria-pressed={activeId === p.id}
            onClick={() => {
              setActiveId(p.id)
              onApplyLayout(p.compute())
            }}
            title={`${p.title} - ${p.desc}`}
          >
            <div className="ve-layout-preset-btn__frame">{p.renderIcon()}</div>
            <span className="ve-layout-preset-btn__label">{p.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
