// @ts-nocheck
/**
 * VerticalFrame —— 竖屏 9:16 通用容器（V 阶段）
 *
 * 镜头源码全部按 1920×1080 绝对定位作画。这一层不要求重写镜头：
 *   cover  = 等比放大到填满竖屏，再按焦点取裁切窗口（默认中心；左右各裁掉约 31%）
 *   fit    = 等比缩小到高度填满，上下留底色（图表/时间轴这类"不能裁"的镜头）
 *   reflow = 镜头自己写竖屏重排（读 useVideoConfig 的 width/height），容器只留安全区变量
 *
 * 安全区：上方 180px（标题/状态）、下方 320px（口播字幕 + 进度）。reflow 变体必须自己遵守。
 */
import React from 'react'

export type VerticalMode = 'cover' | 'fit' | 'reflow'

export type VerticalFrameProps = {
  mode?: VerticalMode
  /** 裁切焦点（0–1，内容坐标系）：0.5/0.5 = 中心 */
  focusX?: number
  focusY?: number
  /** 输出画布尺寸（竖屏时通常是 1080×1920） */
  width: number
  height: number
  /** 内容设计尺寸，默认 1920×1080 */
  contentWidth?: number
  contentHeight?: number
  /** fit 模式下留边的底色 */
  background?: string
  children: React.ReactNode
}

/** 竖屏安全区（像素，相对输出画布） */
export const VERTICAL_SAFE = { top: 180, bottom: 320 } as const

export const VerticalFrame: React.FC<VerticalFrameProps> = ({
  mode = 'cover',
  focusX = 0.5,
  focusY = 0.5,
  width,
  height,
  contentWidth = 1920,
  contentHeight = 1080,
  background = '#0b0c10',
  children,
}) => {
  // reflow：镜头自己按竖屏重排，容器只负责铺满并暴露安全区变量
  if (mode === 'reflow') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width,
          height,
          overflow: 'hidden',
          background,
          ['--safe-top' as string]: `${VERTICAL_SAFE.top}px`,
          ['--safe-bottom' as string]: `${VERTICAL_SAFE.bottom}px`,
        }}
      >
        {children}
      </div>
    )
  }

  const scaleCover = Math.max(width / contentWidth, height / contentHeight)
  const scaleFit = Math.min(width / contentWidth, height / contentHeight)
  const scale = mode === 'fit' ? scaleFit : scaleCover

  const scaledW = contentWidth * scale
  const scaledH = contentHeight * scale

  // 焦点对齐画布中心；cover 时把位移夹在内容边界内，避免露出底色
  const clampOffset = (value: number, scaled: number, canvas: number) =>
    Math.min(0, Math.max(canvas - scaled, value))
  const rawX = width / 2 - focusX * scaledW
  const rawY = height / 2 - focusY * scaledH
  const offsetX = mode === 'fit' ? (width - scaledW) / 2 : clampOffset(rawX, scaledW, width)
  const offsetY = mode === 'fit' ? (height - scaledH) / 2 : clampOffset(rawY, scaledH, height)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width,
        height,
        overflow: 'hidden',
        background,
        ['--safe-top' as string]: `${VERTICAL_SAFE.top}px`,
        ['--safe-bottom' as string]: `${VERTICAL_SAFE.bottom}px`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: contentWidth,
          height: contentHeight,
          transformOrigin: '0 0',
          transform: `translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px) scale(${scale.toFixed(5)})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** 判断当前渲染是否竖屏（镜头内部做 reflow 分支时用） */
export const isVertical = (width: number, height: number) => height > width
