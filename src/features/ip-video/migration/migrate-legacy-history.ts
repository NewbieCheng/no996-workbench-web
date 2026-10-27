/**
 * 旧版 IPVideoHistory 数据平滑迁移至通用 EditorDocument v1 纯模块
 * 遵循 S8-03 规则：
 * 1. 账号隔离：两个账号使用相同默认封面/视频 ID 时严格隔离；
 * 2. 幂等与报告：不伪造无损，明确报告差异；
 * 3. 旧主键缺失或覆盖只报告缺失。
 */

import type { EditorDocument } from '../../../../packages/video-editor/src/core/project.ts'
import { createEmptyDocument } from '../../../../packages/video-editor/src/core/project.ts'
import type { IPVideoHistory } from '../lib/history.ts'

export type MigrationReport = {
  legacyId: string
  newDocumentId?: string
  status: 'migrated' | 'already_migrated' | 'rejected_cross_account' | 'missing_data'
  differences: string[]
  audioPreserved: boolean
  videoPreserved: boolean
}

/**
 * 将单个旧版 IPVideoHistory 转换为通用规范的 EditorDocument v1
 */
export function migrateLegacyHistoryToDocument(
  record: IPVideoHistory,
  currentUserId: number,
  existingMigratedMap: Map<string, string> = new Map() // legacyId -> newDocId
): { document?: EditorDocument; report: MigrationReport } {
  // 1. 严格账号隔离检查
  if (record.ownerUserId !== currentUserId) {
    return {
      report: {
        legacyId: record.id,
        status: 'rejected_cross_account',
        differences: [`试图跨账号导入属于用户 ${record.ownerUserId} 的旧数据，被安全策略拒绝`],
        audioPreserved: false,
        videoPreserved: false,
      },
    }
  }

  // 2. 幂等性检查：若已经迁入过，直接返回已有映射
  if (existingMigratedMap.has(record.id)) {
    return {
      report: {
        legacyId: record.id,
        newDocumentId: existingMigratedMap.get(record.id),
        status: 'already_migrated',
        differences: ['该历史记录已在先前完成迁入，已重定向至既有工程副本'],
        audioPreserved: true,
        videoPreserved: true,
      },
    }
  }

  // 3. 基础有效性核对
  if (!record.video && !record.audio) {
    return {
      report: {
        legacyId: record.id,
        status: 'missing_data',
        differences: ['旧记录缺少有效的音视频二进制媒体数据，无法恢复为可编辑工程'],
        audioPreserved: false,
        videoPreserved: false,
      },
    }
  }

  const durationUs = Math.max(1_000_000, Math.round((record.duration || 5) * 1_000_000))
  const newDocId = `proj-migrated-${record.id}`
  const doc = createEmptyDocument(newDocId, record.title || '已迁入的旧版口播视频', String(currentUserId), '9:16')
  doc.durationUs = durationUs
  doc.createdAt = record.createdAt || Date.now()

  const differences: string[] = []

  // 4. 挂载视频素材与主轨
  if (record.video) {
    const videoAssetId = `asset-migrated-video-${record.id}`
    doc.assets[videoAssetId] = {
      id: videoAssetId,
      kind: 'video',
      name: `成片素材_${record.title}`,
      mimeType: record.video.type || 'video/mp4',
      sizeBytes: record.video.size,
      durationUs,
      createdAt: record.createdAt || Date.now(),
    }

    doc.tracks[0].elements = [
      {
        id: `elem-v-${record.id}`,
        trackId: doc.tracks[0].id,
        type: 'video',
        assetId: videoAssetId,
        startUs: 0,
        durationUs,
        sourceInUs: 0,
        sourceOutUs: durationUs,
        rate: record.speed || 1,
        volume: 1,
        transform: {
          x: 0,
          y: 0,
          width: 1080,
          height: 1920,
          rotationDeg: 0,
          opacity: 1,
          cropMode: 'cover',
          round: 0,
        },
      },
    ]
  }

  // 5. 挂载音频素材与音频轨
  if (record.audio) {
    const audioAssetId = `asset-migrated-audio-${record.id}`
    doc.assets[audioAssetId] = {
      id: audioAssetId,
      kind: 'audio',
      name: `配音_${record.voiceLabel || '标准'}`,
      mimeType: record.audio.type || 'audio/mp3',
      sizeBytes: record.audio.size,
      durationUs,
      createdAt: record.createdAt || Date.now(),
    }

    const audioTrack = doc.tracks.find((t) => t.type === 'audio')
    if (audioTrack) {
      audioTrack.elements = [
        {
          id: `elem-a-${record.id}`,
          trackId: audioTrack.id,
          type: 'audio',
          assetId: audioAssetId,
          startUs: 0,
          durationUs,
          sourceInUs: 0,
          sourceOutUs: durationUs,
          rate: record.speed || 1,
          volume: 1,
        },
      ]
    }
  }

  // 6. 转化字幕
  if (record.script) {
    const lines = record.script.split(/[\n。！？]/).map((s) => s.trim()).filter(Boolean)
    if (lines.length > 0) {
      const perLine = Math.round(durationUs / lines.length)
      doc.captions = lines.map((text, i) => ({
        id: `cue-migrated-${i + 1}`,
        startUs: i * perLine,
        durationUs: perLine,
        text,
        timingSource: 'estimated',
      }))
    }
  }

  // 7. 映射字幕样式与模板元数据
  doc.templateMeta = {
    templateId: record.templateId || 'legacy-template',
    presetName: `旧版模板 (${record.templateId})`,
    category: 'ip-speaker',
  }

  differences.push('旧版专有 CSS 动态滤镜已平滑降级为标准 Canvas 渲染，不伪造无损')
  if (!record.templateProject) {
    differences.push('该历史记录未包含完整图层编排快照，已按主音视频与字幕重构工程')
  }

  return {
    document: doc,
    report: {
      legacyId: record.id,
      newDocumentId: newDocId,
      status: 'migrated',
      differences,
      audioPreserved: !!record.audio,
      videoPreserved: !!record.video,
    },
  }
}
