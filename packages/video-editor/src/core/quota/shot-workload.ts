/**
 * 动效镜头复合负荷与运行健康度评估引擎 (Shot Workload Model)
 *
 * 核心设计准则：
 * 1. 音频无罪：纯音频（即使长达 4~10 分钟）由 Web Audio 流式解码，不计入渲染卡顿负荷；
 * 2. 动效精准核算：以 Shot 镜头的数量、复杂滤镜权重（Blur、3D、高频 SVG）为计算基准；
 * 3. 拒绝死板硬性拦截，提供建议型分级与贴心自愈方案。
 */

import type { EditorDocument, ShotClipElement } from '../project.ts'

export type WorkloadLevel = 'healthy' | 'moderate' | 'heavy'

export type ProjectWorkloadReport = {
  /** 综合负荷等级 */
  level: WorkloadLevel
  /** 综合负荷得分 */
  score: number
  /** 动效镜头总数 */
  shotCount: number
  /** 高计算负荷动效镜头数 */
  heavyShotCount: number
  /** 普通图文与视频图层数 */
  mediaCount: number
  /** 音频轨道总时长（微秒） */
  audioDurationUs: number
  /** 状态标题 */
  title: string
  /** 针对创作者的贴心说明 */
  description: string
  /** 是否推荐开启草稿轻量预览模式 */
  recommendDraftPreview: boolean
  /** 具体提示条目 */
  tips: string[]
}

// 复杂动效镜头清单（包含复杂多层 Blur 滤镜、3D 空间变换、高频 SVG 流式渲染）
const HEAVY_SHOT_IDS = new Set([
  'opening/text-as-mask',
  'opening/spotlight-hero-card',
  'data/chart-live-moves~AxisRescaleShockV2',
  'data/chart-live-moves~UnitDotSwarmRegroupV2',
  'rhythm/quad-split-parallel-scenes',
  'typography/lead-word-zoom-assemble',
  'typography/blur-slide',
])

export function evaluateProjectWorkload(doc: EditorDocument): ProjectWorkloadReport {
  let shotCount = 0
  let heavyShotCount = 0
  let mediaCount = 0
  let audioDurationUs = 0

  for (const track of doc.tracks) {
    if (track.type === 'audio') {
      for (const elem of track.elements) {
        audioDurationUs = Math.max(audioDurationUs, elem.startUs + elem.durationUs)
      }
    } else {
      for (const elem of track.elements) {
        if (elem.type === 'shot') {
          shotCount++
          const shotElem = elem as ShotClipElement
          if (HEAVY_SHOT_IDS.has(shotElem.shotId)) {
            heavyShotCount++
          }
        } else {
          mediaCount++
        }
      }
    }
  }

  // 科学加权得分：普通镜头 1 分，高负荷复杂镜头 1.5 分，普通图层 0.2 分
  const score = Math.round(
    (shotCount - heavyShotCount) * 1.0 + heavyShotCount * 1.5 + mediaCount * 0.2
  )

  const tips: string[] = []

  if (audioDurationUs > 120_000_000) {
    tips.push('检测到较长背景音频或口播录音，纯音频流式播放对浏览器性能无额外压力，可放心编排。')
  }

  if (shotCount <= 12) {
    return {
      level: 'healthy',
      score,
      shotCount,
      heavyShotCount,
      mediaCount,
      audioDurationUs,
      title: '流畅良好',
      description: '当前动效负载轻量，浏览器可丝滑预览并快速导出成片。',
      recommendDraftPreview: false,
      tips,
    }
  }

  if (shotCount <= 18) {
    tips.push('当前工程动效较为丰富，若在低配设备或核显上播放偶有掉帧，可随时切换【草稿预览】模式。')
    return {
      level: 'moderate',
      score,
      shotCount,
      heavyShotCount,
      mediaCount,
      audioDurationUs,
      title: '适度动效',
      description: '分镜数量适中，预览若有微弱掉帧属正常现象，成片导出仍为全高清画质。',
      recommendDraftPreview: false,
      tips,
    }
  }

  tips.push('动效镜头数量较密集（超过 18 镜），建议开启【草稿预览模式】以保证 30FPS 丝滑播放，成片导出不受影响。')
  return {
    level: 'heavy',
    score,
    shotCount,
    heavyShotCount,
    mediaCount,
    audioDurationUs,
    title: '动效密集',
    description: '复杂动效较多，建议开启【草稿预览】降低实时计算负荷，成片导出依然保持 100% 原始超清全画质。',
    recommendDraftPreview: true,
    tips,
  }
}
