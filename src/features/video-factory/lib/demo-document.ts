/**
 * 演示工程
 *
 * 「重置示例」用：一个本机确定性的演示工程，含若干镜头。
 * 严格遵守产品边界 —— 这是演示内容，界面上必须标注「演示」，
 * 不得冒充真实模型产物或用户素材。
 */

import {
  createEmptyDocument,
  shotDurationUs,
  SHOT_CATALOG,
  type CanvasRatio,
  type EditorDocument,
} from '@no996/video-editor'

/** 演示工程用到的镜头（按类别挑几个视觉差异大的） */
const DEMO_SHOT_IDS = [
  'opening/spotlight-hero-card',
  'opening/text-as-mask',
  'ui-entrance/deck-deal-flyin',
  'data/chart-live-moves~AxisRescaleShockV2',
  'outro/logo-shrink-wordmark-lockup',
]

export function buildDemoDocument(scope: string, ratio: CanvasRatio = '16:9'): EditorDocument {
  const doc = createEmptyDocument(`proj-vf-demo-${crypto.randomUUID()}`, '演示工程（演示）', scope, ratio)
  doc.templateMeta = { templateId: 'video-factory', presetName: '视频工厂 · 演示', category: 'general' }

  // 按画幅算出镜头元素框，保持铺满
  const picks = DEMO_SHOT_IDS.map((id) => SHOT_CATALOG.find((shot) => shot.shotId === id)).filter(
    Boolean,
  ) as (typeof SHOT_CATALOG)[number][]

  const shotTrack = doc.tracks.find((track) => track.type === 'shot') ?? doc.tracks[0]
  if (!shotTrack) return doc

  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  let cursorUs = 0
  for (const shot of picks.slice(0, 5)) {
    const durationUs = shotDurationUs(shot.durationInFrames, 1, fps)
    shotTrack.elements.push({
      id: `shot-demo-${crypto.randomUUID()}`,
      trackId: shotTrack.id,
      type: 'shot',
      shotId: shot.shotId,
      sourceDurationFrames: shot.durationInFrames,
      rate: 1,
      startUs: cursorUs,
      durationUs,
      transform: {
        x: 0,
        y: 0,
        width: doc.canvas.width,
        height: doc.canvas.height,
        rotationDeg: 0,
        opacity: 1,
        cropMode: 'cover',
        round: 0,
      },
    })
    cursorUs += durationUs
  }

  doc.durationUs = cursorUs
  return doc
}
