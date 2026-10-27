/**
 * Remotion 兼容运行时 —— 帧上下文
 *
 * 参考项目 video-shotcraft 的 152 个 demo 全部通过 `useCurrentFrame()` 取时间。
 * 这里提供同名同签名的本地实现，让 demo 源码可以逐字运行在浏览器里。
 *
 * 约束：本目录禁止 import 'remotion' 真包，只允许 react / react-dom。
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type FrameState = {
  /** 当前帧号（相对于最近的 FrameProvider） */
  frame: number
  /** 合成总帧数 */
  durationInFrames: number
  fps: number
  width: number
  height: number
}

const FALLBACK: FrameState = {
  frame: 0,
  durationInFrames: 1,
  fps: 30,
  width: 1920,
  height: 1080,
}

const FrameContext = createContext<FrameState>(FALLBACK)
const ShotPropsContext = createContext<Record<string, any>>({})
const EMPTY_PROPS: Record<string, any> = {}

export function FrameProvider({
  frame,
  durationInFrames,
  fps,
  width,
  height,
  props,
  children,
}: FrameState & { props?: Record<string, any>; children: ReactNode }) {
  // 稳定对象引用，避免 146 处 useCurrentFrame 触发无谓重渲染
  const value = useMemo<FrameState>(
    () => ({ frame, durationInFrames, fps, width, height }),
    [frame, durationInFrames, fps, width, height],
  )
  const propsValue = props ?? EMPTY_PROPS
  return (
    <FrameContext.Provider value={value}>
      <ShotPropsContext.Provider value={propsValue}>{children}</ShotPropsContext.Provider>
    </FrameContext.Provider>
  )
}

/** 获取注入给当前镜头的 props/overrides/slots */
export function useShotProps(): Record<string, any> {
  return useContext(ShotPropsContext)
}

/** 智能获取某个镜头参数，当外部有 overrides/slots 时取外部值，否则回退到默认常量 */
export function useShotProp<T = string>(key: string, fallback: T): T {
  const props = useContext(ShotPropsContext)
  if (props && props[key] !== undefined && props[key] !== null && props[key] !== '') {
    return props[key] as T
  }
  return fallback
}


/** 无 Provider 时返回 0，不抛错 —— 便于单测与静态预览。 */
export function useCurrentFrame(): number {
  return useContext(FrameContext).frame
}

export function useVideoConfig(): { fps: number; width: number; height: number; durationInFrames: number } {
  const state = useContext(FrameContext)
  return useMemo(
    () => ({
      fps: state.fps,
      width: state.width,
      height: state.height,
      durationInFrames: state.durationInFrames,
    }),
    [state.fps, state.width, state.height, state.durationInFrames],
  )
}

/**
 * 全片归一化进度 t∈[0,1]，末帧恰为 1。
 * 参考项目 `_fixtures/Motion.tsx` 的 useT 语义：`frame / (durationInFrames - 1)`。
 */
export function useT(): number {
  const state = useContext(FrameContext)
  return Math.min(1, state.frame / Math.max(1, state.durationInFrames - 1))
}

/** 供管线读取当前 Provider 状态（非 hook，避免在渲染循环中破坏 hook 规则）。 */
export function readFrameState(): FrameState {
  return useContext(FrameContext)
}
