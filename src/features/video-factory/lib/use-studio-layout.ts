import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react'

export const VF_RAIL_LEFT_EXPANDED = 256
export const VF_RAIL_RIGHT_EXPANDED = 300
export const VF_RAIL_COLLAPSED = 40
export const VF_TRANSPORT_HEIGHT = 44
export const VF_STAGE_MIN_WIDTH = 240
/** 中间监视器与左右栏之间的水平间距（左右各一份） */
export const VF_CENTER_GUTTER = 12

export type StudioLayoutInput = {
  mainWidth: number
  mainHeight: number
  canvasWidth: number
  canvasHeight: number
  leftCollapsed: boolean
  rightCollapsed: boolean
  railLeftExpanded?: number
  railRightExpanded?: number
  transportHeight?: number
}

export type StudioLayoutResult = {
  stageWidthPx: number
  stageHeightPx: number
  cssVars: Record<string, string>
  style: CSSProperties
}

/** 在给定主区尺寸与侧栏宽度下，计算紧贴画幅的舞台像素尺寸 */
export function computeStudioLayout(input: StudioLayoutInput): StudioLayoutResult {
  const {
    mainWidth,
    mainHeight,
    canvasWidth,
    canvasHeight,
    leftCollapsed,
    rightCollapsed,
  } = input

  const leftExpanded = input.railLeftExpanded ?? VF_RAIL_LEFT_EXPANDED
  const rightExpanded = input.railRightExpanded ?? VF_RAIL_RIGHT_EXPANDED
  let leftRail = leftCollapsed ? VF_RAIL_COLLAPSED : leftExpanded
  let rightRail = rightCollapsed ? VF_RAIL_COLLAPSED : rightExpanded
  const aspect = canvasWidth > 0 && canvasHeight > 0 ? canvasWidth / canvasHeight : 16 / 9

  const transportH = input.transportHeight ?? VF_TRANSPORT_HEIGHT
  const availH = Math.max(1, mainHeight - transportH)
  const gutters = VF_CENTER_GUTTER * 2
  const maxCenterW = Math.max(VF_STAGE_MIN_WIDTH, mainWidth - leftRail - rightRail - gutters)

  let stageW = Math.min(maxCenterW, availH * aspect)
  let stageH = stageW / aspect

  if (stageH > availH) {
    stageH = availH
    stageW = stageH * aspect
  }

  stageW = Math.max(VF_STAGE_MIN_WIDTH, Math.floor(stageW))
  stageH = Math.max(1, Math.floor(stageH))

  // 画幅变窄后，把主区剩余宽度分给左右栏，避免监视器两侧出现大块留白
  const slack = mainWidth - stageW - gutters - leftRail - rightRail
  if (slack > 0) {
    if (!leftCollapsed && !rightCollapsed) {
      const weight = leftExpanded + rightExpanded
      const addLeft = Math.floor((slack * leftExpanded) / weight)
      leftRail += addLeft
      rightRail += slack - addLeft
    } else if (!leftCollapsed) {
      leftRail += slack
    } else if (!rightCollapsed) {
      rightRail += slack
    }
  }

  const cssVars: Record<string, string> = {
    '--vf-stage-w': `${stageW}px`,
    '--vf-stage-h': `${stageH}px`,
    '--vf-rail-left': `${leftRail}px`,
    '--vf-rail-right': `${rightRail}px`,
    '--vf-rail-collapsed': `${VF_RAIL_COLLAPSED}px`,
    '--vf-rail-left-expanded': `${leftExpanded}px`,
    '--vf-rail-right-expanded': `${rightExpanded}px`,
    '--vf-center-gutter': `${VF_CENTER_GUTTER}px`,
  }

  return {
    stageWidthPx: stageW,
    stageHeightPx: stageH,
    cssVars,
    style: cssVars as CSSProperties,
  }
}

export function useStudioLayout(
  mainRef: RefObject<HTMLElement | null>,
  canvasWidth: number,
  canvasHeight: number,
  leftCollapsed: boolean,
  rightCollapsed: boolean,
  transportHeight: number = VF_TRANSPORT_HEIGHT,
  railLeftExpanded: number = VF_RAIL_LEFT_EXPANDED,
  railRightExpanded: number = VF_RAIL_RIGHT_EXPANDED,
): StudioLayoutResult {
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const update = () => {
      setBox({ width: el.clientWidth, height: el.clientHeight })
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mainRef])

  return useMemo(
    () =>
      computeStudioLayout({
        mainWidth: box.width,
        mainHeight: box.height,
        canvasWidth,
        canvasHeight,
        leftCollapsed,
        rightCollapsed,
        railLeftExpanded,
        railRightExpanded,
        transportHeight,
      }),
    [
      box.width,
      box.height,
      canvasWidth,
      canvasHeight,
      leftCollapsed,
      rightCollapsed,
      railLeftExpanded,
      railRightExpanded,
      transportHeight,
    ],
  )
}

const PANEL_STORAGE_KEY = 'vf-studio-panels'

export type StudioPanelPrefs = {
  leftCollapsed: boolean
  rightCollapsed: boolean
  timelineCollapsed: boolean
  /** 展开时时间轴区域高度（px），上限由 vf-body 的 50% 约束 */
  timelineHeightPx?: number
  /** 用户拖动的左/右栏基准宽度（px），未设则用 VF_RAIL_*_EXPANDED */
  railLeftExpandedPx?: number
  railRightExpandedPx?: number
}

export function readStudioPanelPrefs(): StudioPanelPrefs {
  try {
    const raw = sessionStorage.getItem(PANEL_STORAGE_KEY)
    if (!raw) return { leftCollapsed: false, rightCollapsed: false, timelineCollapsed: false }
    const parsed = JSON.parse(raw) as Partial<StudioPanelPrefs>
    const timelineHeightPx =
      typeof parsed.timelineHeightPx === 'number' && Number.isFinite(parsed.timelineHeightPx)
        ? parsed.timelineHeightPx
        : undefined
    const railLeftExpandedPx =
      typeof parsed.railLeftExpandedPx === 'number' && Number.isFinite(parsed.railLeftExpandedPx)
        ? parsed.railLeftExpandedPx
        : undefined
    const railRightExpandedPx =
      typeof parsed.railRightExpandedPx === 'number' && Number.isFinite(parsed.railRightExpandedPx)
        ? parsed.railRightExpandedPx
        : undefined
    return {
      leftCollapsed: Boolean(parsed.leftCollapsed),
      rightCollapsed: Boolean(parsed.rightCollapsed),
      timelineCollapsed: Boolean(parsed.timelineCollapsed),
      timelineHeightPx,
      railLeftExpandedPx,
      railRightExpandedPx,
    }
  } catch {
    return { leftCollapsed: false, rightCollapsed: false, timelineCollapsed: false }
  }
}

export function writeStudioPanelPrefs(prefs: StudioPanelPrefs): void {
  try {
    sessionStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore quota */
  }
}
