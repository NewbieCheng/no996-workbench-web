/**
 * 裁切拖动会话：从按下时的原点 + 累计像素位移计算 start/duration（避免在已更新 elem 上累加）
 */

import type { TimeUs } from '../../core/time.ts'
import type { TrackElement } from '../../core/project.ts'
import { pixelsToTimeUs } from './zoom-scale.ts'

export const MIN_CLIP_DURATION_US = 33_333

export type TrimEdge = 'start' | 'end'

export type TrimSessionOrigin = {
  elementId: string
  edge: TrimEdge
  originStartUs: TimeUs
  originDurationUs: TimeUs
  sourceInUs?: TimeUs
  sourceOutUs?: TimeUs
}

export type TrimComputed = {
  startUs: TimeUs
  durationUs: TimeUs
  sourceInUs?: TimeUs
  sourceOutUs?: TimeUs
}

export function createTrimOrigin(element: TrackElement, edge: TrimEdge): TrimSessionOrigin {
  const base: TrimSessionOrigin = {
    elementId: element.id,
    edge,
    originStartUs: element.startUs,
    originDurationUs: element.durationUs,
  }
  if ('sourceInUs' in element && 'sourceOutUs' in element) {
    base.sourceInUs = element.sourceInUs
    base.sourceOutUs = element.sourceOutUs
  }
  return base
}

/**
 * 从原点与累计像素位移计算裁切结果（绝对值，不读当前文档状态）
 */
export function computeTrimFromOrigin(
  origin: TrimSessionOrigin,
  deltaPx: number,
  zoom: number,
): TrimComputed {
  const deltaUs = pixelsToTimeUs(deltaPx, zoom)

  if (origin.edge === 'start') {
    const rawStart = origin.originStartUs + deltaUs
    const maxStart = origin.originStartUs + origin.originDurationUs - MIN_CLIP_DURATION_US
    const startUs = Math.max(0, Math.min(Math.round(rawStart), Math.round(maxStart)))
    const durationUs = Math.max(
      MIN_CLIP_DURATION_US,
      Math.round(origin.originDurationUs - (startUs - origin.originStartUs)),
    )
    const trimDelta = startUs - origin.originStartUs
    const result: TrimComputed = { startUs, durationUs }
    if (origin.sourceInUs !== undefined && origin.sourceOutUs !== undefined) {
      result.sourceInUs = Math.max(0, Math.round(origin.sourceInUs + trimDelta))
      result.sourceOutUs = origin.sourceOutUs
    }
    return result
  }

  const durationUs = Math.max(MIN_CLIP_DURATION_US, Math.round(origin.originDurationUs + deltaUs))
  const result: TrimComputed = {
    startUs: origin.originStartUs,
    durationUs,
  }
  if (origin.sourceInUs !== undefined && origin.sourceOutUs !== undefined) {
    result.sourceInUs = origin.sourceInUs
    const durationDelta = durationUs - origin.originDurationUs
    result.sourceOutUs = Math.max(
      (result.sourceInUs ?? 0) + 1,
      Math.round(origin.sourceOutUs + durationDelta),
    )
  }
  return result
}

export function applySnapToTrim(
  computed: TrimComputed,
  edge: TrimEdge,
  snapTargetUs: TimeUs | undefined,
): TrimComputed {
  if (snapTargetUs === undefined) return computed

  if (edge === 'start') {
    const maxStart =
      computed.startUs + computed.durationUs - MIN_CLIP_DURATION_US
    const startUs = Math.max(0, Math.min(Math.round(snapTargetUs), Math.round(maxStart)))
    const durationUs = Math.max(
      MIN_CLIP_DURATION_US,
      computed.startUs + computed.durationUs - startUs,
    )
    return { ...computed, startUs, durationUs }
  }

  const endUs = snapTargetUs
  const durationUs = Math.max(MIN_CLIP_DURATION_US, Math.round(endUs - computed.startUs))
  const out: TrimComputed = { ...computed, durationUs }
  if (computed.sourceInUs !== undefined && computed.sourceOutUs !== undefined) {
    const durationDelta = durationUs - computed.durationUs
    out.sourceOutUs = Math.max(
      computed.sourceInUs + 1,
      Math.round(computed.sourceOutUs + durationDelta),
    )
  }
  return out
}

/** 预览阶段写回元素字段（镜头同步 sourceDurationFrames） */
export function applyTrimToElement(
  element: TrackElement,
  computed: TrimComputed,
  fps: number,
): TrackElement {
  if (element.type === 'shot') {
    const frames = Math.max(
      1,
      Math.round((computed.durationUs / 1_000_000) * fps * element.rate),
    )
    return {
      ...element,
      startUs: computed.startUs,
      durationUs: computed.durationUs,
      sourceDurationFrames: frames,
    }
  }
  if ('sourceInUs' in element && computed.sourceInUs !== undefined && computed.sourceOutUs !== undefined) {
    return {
      ...element,
      startUs: computed.startUs,
      durationUs: computed.durationUs,
      sourceInUs: computed.sourceInUs,
      sourceOutUs: computed.sourceOutUs,
    }
  }
  return {
    ...element,
    startUs: computed.startUs,
    durationUs: computed.durationUs,
  }
}
