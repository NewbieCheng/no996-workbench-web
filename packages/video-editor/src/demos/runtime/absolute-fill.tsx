/**
 * Remotion 兼容运行时 —— 容器与时间轴组件
 *
 * AbsoluteFill / Sequence / Freeze 三个原语。参考项目里 AbsoluteFill 用了 130 次、
 * Freeze 3 次、Sequence 1 次。
 */

import type { CSSProperties, ReactNode } from 'react'
import { FrameProvider, useCurrentFrame, useVideoConfig } from './frame-context.tsx'

export type AbsoluteFillProps = CSSProperties & {
  style?: CSSProperties
  className?: string
  children?: ReactNode
}

/** 铺满父容器的绝对定位层。demos 常把 style 直接展开在组件上，这里兼容两种写法。 */
export function AbsoluteFill({
  style,
  className,
  children,
  ...rest
}: AbsoluteFillProps) {
  const merged: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    ...rest,
    ...style,
  }
  return (
    <div className={className} style={merged}>
      {children}
    </div>
  )
}

/** 便于 `AbsoluteFill.row` 之类写法（参考项目未用，稳妥起见提供）。 */
export const absoluteFillStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
}

export type SequenceProps = {
  from?: number
  durationInFrames?: number
  layout?: 'absolute-fill' | 'none'
  name?: string
  children?: ReactNode
  style?: CSSProperties
}

/**
 * 时间轴片段容器：内部帧号相对起点偏移，超出范围不渲染。
 * 参考项目用法：`<Sequence name="short-shot" from={0} durationInFrames={120} layout="none">`
 */
export function Sequence({
  from = 0,
  durationInFrames,
  layout = 'absolute-fill',
  children,
  style,
}: SequenceProps) {
  const parentFrame = useCurrentFrame()
  const parentConfig = useVideoConfig()
  const relative = parentFrame - from
  const span = durationInFrames ?? Math.max(0, parentConfig.durationInFrames - from)

  if (relative < 0 || relative >= span) return null

  const content = (
    <FrameProvider
      frame={relative}
      durationInFrames={span}
      fps={parentConfig.fps}
      width={parentConfig.width}
      height={parentConfig.height}
    >
      {children}
    </FrameProvider>
  )

  if (layout === 'none') return content
  return <div style={{ position: 'absolute', inset: 0, ...style }}>{content}</div>
}

export type FreezeProps = {
  frame: number
  active?: boolean
  children?: ReactNode
}

/**
 * 冻结子树的帧号。
 * 参考项目两种用法：
 *   <Freeze frame={f}>…</Freeze>                     —— 常冻结
 *   <Freeze frame={f} active={cond}>…</Freeze>       —— 条件冻结
 * 关键点：active 切换时不能重挂载子树，否则内部 spring 状态会重置。
 */
export function Freeze({ frame, active = true, children }: FreezeProps) {
  const current = useCurrentFrame()
  const config = useVideoConfig()
  const effective = active ? frame : current
  return (
    <FrameProvider
      frame={effective}
      durationInFrames={Math.max(1, config.durationInFrames)}
      fps={config.fps}
      width={config.width}
      height={config.height}
    >
      {children}
    </FrameProvider>
  )
}
