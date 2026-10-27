/**
 * 场景与工程预设库（包含 4 套确定性 IP 场景工程预设与 Fixtures）
 */

import type { EditorDocument, CanvasRatio } from '../core/project.ts'
import { createEmptyDocument } from '../core/project.ts'

export type PresetCategory = 'ip-speaker' | 'knowledge' | 'flash-sale' | 'unboxing' | 'general'

export type ProjectPreset = {
  id: string
  name: string
  description: string
  category: PresetCategory
  ratio: CanvasRatio
  createDocument: (options?: { name?: string; scope?: string }) => EditorDocument
}

/**
 * 预设 1：竖屏口播视频 (9:16)
 * 标配：人物主轨、底部爆款高亮黄字幕、居中顶部大标题
 */
export const IP_SPEAKER_VERTICAL_PRESET: ProjectPreset = {
  id: 'ip-speaker-vertical',
  name: '竖屏口播解说',
  description: '单人口播讲干货，经典 9:16 沉浸大画幅',
  category: 'ip-speaker',
  ratio: '9:16',
  createDocument: ({ name = '短视频口播文案', scope = 'default' } = {}) => {
    const doc = createEmptyDocument(`proj-${crypto.randomUUID()}`, name, scope, '9:16')
    doc.templateMeta = {
      templateId: 'ip-speaker-vertical',
      presetName: '竖屏口播解说',
      category: 'ip-speaker',
    }

    doc.captionStyle = {
      font: 'sans-serif',
      size: 38,
      color: '#FFD60A',
      outlineColor: '#000000',
      outlineWidth: 4,
      backgroundColor: 'transparent',
      align: 'center',
      yRatio: 0.82,
      burn: true,
    }

    // 预设主口播视频占位
    doc.tracks[0].name = '人物主视频轨'
    doc.tracks[0].elements.push({
      id: 'elem-speaker-main',
      trackId: doc.tracks[0].id,
      type: 'video',
      assetId: 'asset-speaker-placeholder',
      startUs: 0,
      durationUs: 6_000_000,
      sourceInUs: 0,
      sourceOutUs: 6_000_000,
      rate: 1,
      volume: 1,
      transform: { x: 0, y: 0, width: 1080, height: 1920, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
    })

    // 预置确定性字幕演示
    doc.captions = [
      { id: 'cue-1', startUs: 0, durationUs: 2_500_000, text: '每天一个职场高情商沟通秘籍', timingSource: 'estimated' },
      { id: 'cue-2', startUs: 2_600_000, durationUs: 3_200_000, text: '教你如何优雅拒绝不合理需求', timingSource: 'estimated' },
    ]

    doc.durationUs = 6_000_000
    return doc
  },
}

/**
 * 预设 2：横屏知识科普 (16:9)
 * 标配：画中画课件布局、白色标准字幕
 */
export const IP_KNOWLEDGE_HORIZONTAL_PRESET: ProjectPreset = {
  id: 'ip-knowledge-horizontal',
  name: '横屏知识科普',
  description: '课件/分屏讲解，专业 16:9 构图',
  category: 'knowledge',
  ratio: '16:9',
  createDocument: ({ name = '知识科普课件', scope = 'default' } = {}) => {
    const doc = createEmptyDocument(`proj-${crypto.randomUUID()}`, name, scope, '16:9')
    doc.templateMeta = {
      templateId: 'ip-knowledge-horizontal',
      presetName: '横屏知识科普',
      category: 'knowledge',
    }

    doc.captionStyle = {
      font: 'sans-serif',
      size: 34,
      color: '#FFFFFF',
      outlineColor: '#1A1A1A',
      outlineWidth: 3,
      backgroundColor: 'transparent',
      align: 'center',
      yRatio: 0.88,
      burn: true,
    }

    doc.tracks[0].name = '课件底板轨'
    doc.tracks[0].elements.push({
      id: 'elem-slide-bg',
      trackId: doc.tracks[0].id,
      type: 'image',
      assetId: 'asset-slide-placeholder',
      startUs: 0,
      durationUs: 8_000_000,
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, opacity: 1, cropMode: 'contain', round: 0 },
    })

    // 右上角画中画讲解人物
    const overlayTrack = doc.tracks.find((t) => t.type === 'overlay')
    if (overlayTrack) {
      overlayTrack.elements.push({
        id: 'elem-pip-speaker',
        trackId: overlayTrack.id,
        type: 'video',
        assetId: 'asset-speaker-pip',
        startUs: 0,
        durationUs: 8_000_000,
        sourceInUs: 0,
        sourceOutUs: 8_000_000,
        rate: 1,
        volume: 1,
        transform: { x: 1920 - 500 - 40, y: 40, width: 500, height: 320, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 16 },
      })
    }

    doc.captions = [
      { id: 'cue-k1', startUs: 500_000, durationUs: 3_000_000, text: '今天我们来深入拆解这个商业底层逻辑', timingSource: 'manual' },
      { id: 'cue-k2', startUs: 3_800_000, durationUs: 3_800_000, text: '先看第一点：用户需求的三层转化漏斗', timingSource: 'manual' },
    ]

    doc.durationUs = 8_000_000
    return doc
  },
}

/**
 * 预设 3：爆款促销快闪 (9:16)
 * 标配：高饱和黑金胶囊板字幕、快节奏标题
 */
export const IP_FLASH_SALE_PRESET: ProjectPreset = {
  id: 'ip-flash-sale',
  name: '爆款促销快闪',
  description: '带货促销，视觉冲击力强的快节奏模板',
  category: 'flash-sale',
  ratio: '9:16',
  createDocument: ({ name = '爆款促销快闪', scope = 'default' } = {}) => {
    const doc = createEmptyDocument(`proj-${crypto.randomUUID()}`, name, scope, '9:16')
    doc.templateMeta = {
      templateId: 'ip-flash-sale',
      presetName: '爆款促销快闪',
      category: 'flash-sale',
    }

    doc.captionStyle = {
      font: 'sans-serif',
      size: 36,
      color: '#FDE047',
      outlineColor: 'transparent',
      outlineWidth: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      align: 'center',
      yRatio: 0.78,
      burn: true,
    }

    doc.tracks[0].name = '商品展示主轨'
    doc.tracks[0].elements.push({
      id: 'elem-product-video',
      trackId: doc.tracks[0].id,
      type: 'video',
      assetId: 'asset-product-showcase',
      startUs: 0,
      durationUs: 4_500_000,
      sourceInUs: 0,
      sourceOutUs: 4_500_000,
      rate: 1,
      volume: 1,
      transform: { x: 0, y: 0, width: 1080, height: 1920, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
    })

    doc.captions = [
      { id: 'cue-fs1', startUs: 0, durationUs: 2_000_000, text: '限时 3 天！全网首发超值特惠', timingSource: 'manual' },
      { id: 'cue-fs2', startUs: 2_100_000, durationUs: 2_200_000, text: '点击下方链接，限量仅有 100 份', timingSource: 'manual' },
    ]

    doc.durationUs = 4_500_000
    return doc
  },
}

/**
 * 预设 4：产品好物开箱 (1:1)
 * 标配：正方形构图、居中卡片展台
 */
export const IP_UNBOXING_SQUARE_PRESET: ProjectPreset = {
  id: 'ip-unboxing-square',
  name: '好物开箱方屏',
  description: '1:1 正方形图文/开箱精选展示',
  category: 'unboxing',
  ratio: '1:1',
  createDocument: ({ name = '好物开箱评测', scope = 'default' } = {}) => {
    const doc = createEmptyDocument(`proj-${crypto.randomUUID()}`, name, scope, '1:1')
    doc.templateMeta = {
      templateId: 'ip-unboxing-square',
      presetName: '好物开箱方屏',
      category: 'unboxing',
    }

    doc.captionStyle = {
      font: 'sans-serif',
      size: 32,
      color: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      backgroundColor: 'transparent',
      align: 'center',
      yRatio: 0.85,
      burn: true,
    }

    doc.tracks[0].name = '开箱实拍轨'
    doc.tracks[0].elements.push({
      id: 'elem-unbox-video',
      trackId: doc.tracks[0].id,
      type: 'video',
      assetId: 'asset-unboxing',
      startUs: 0,
      durationUs: 5_000_000,
      sourceInUs: 0,
      sourceOutUs: 5_000_000,
      rate: 1,
      volume: 1,
      transform: { x: 0, y: 0, width: 1080, height: 1080, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
    })

    doc.captions = [
      { id: 'cue-ub1', startUs: 0, durationUs: 2_200_000, text: '今天终于收到期待已久的桌面神器', timingSource: 'estimated' },
      { id: 'cue-ub2', startUs: 2_400_000, durationUs: 2_400_000, text: '质感完全超出预期，马上开箱实测', timingSource: 'estimated' },
    ]

    doc.durationUs = 5_000_000
    return doc
  },
}

export const ALL_PRESETS: ProjectPreset[] = [
  IP_SPEAKER_VERTICAL_PRESET,
  IP_KNOWLEDGE_HORIZONTAL_PRESET,
  IP_FLASH_SALE_PRESET,
  IP_UNBOXING_SQUARE_PRESET,
]
