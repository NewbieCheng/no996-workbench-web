/**
 * 导出前静态能力与媒体预检报告
 */

import type { EditorDocument } from '../project.ts'
import { EDITOR_LIMITS } from '../schema.ts'
import { abortable, throwIfAborted } from '../../media/pcm.ts'

export type PreflightIssueLevel = 'error' | 'warning'

export type PreflightIssue = {
  level: PreflightIssueLevel
  code: string
  message: string
}

export type PreflightReport = {
  valid: boolean
  issues: PreflightIssue[]
  estimatedDurationUs: number
}

export async function runExportPreflight(
  document: EditorDocument,
  assetChecker: (assetId: string) => Promise<boolean>,
  options: { width?: number; height?: number; format?: 'mp4' | 'webm'; checkEncoding?: boolean; signal?: AbortSignal } = {},
): Promise<PreflightReport> {
  const issues: PreflightIssue[] = []

  if (options.checkEncoding ?? (typeof globalThis.document !== 'undefined')) {
    try {
      const { assertBrowserEncodingSupport } = await import('../../media/mediabunny-adapter.ts')
      await assertBrowserEncodingSupport({
        width: options.width ?? document.canvas.width,
        height: options.height ?? document.canvas.height,
        frameRate: document.canvas.fps,
        format: options.format ?? 'mp4',
      })
    } catch (error) {
      issues.push({ level: 'error', code: 'UNSUPPORTED_ENCODING', message: error instanceof Error ? error.message : '当前浏览器不支持视频编码' })
    }
  }

  // 1. 时长检查
  if (document.durationUs <= 0) {
    issues.push({
      level: 'error',
      code: 'EMPTY_DURATION',
      message: '工程时长为 0，无可导出内容',
    })
  }

  if (document.durationUs > EDITOR_LIMITS.maxDurationUs) {
    issues.push({
      level: 'error',
      code: 'DURATION_EXCEEDED',
      message: `时长超限（上限 300 秒，当前 ${Math.round(document.durationUs / 1_000_000)} 秒）`,
    })
  }

  // 2. 检查引用的媒体资源是否存在
  const usedAssetIds = new Set<string>()
  for (const track of document.tracks) {
    for (const elem of track.elements) {
      if ('assetId' in elem && elem.assetId) {
        usedAssetIds.add(elem.assetId)
      }
    }
  }

  for (const assetId of usedAssetIds) {
    throwIfAborted(options.signal)
    const assetMeta = document.assets[assetId]
    if (!assetMeta) {
      issues.push({
        level: 'error',
        code: 'MISSING_ASSET_METADATA',
        message: `缺少资产定义: ${assetId}`,
      })
      continue
    }

    let exists = false
    try {
      exists = await abortable(assetChecker(assetId), options.signal)
    } catch (error) {
      throwIfAborted(options.signal)
      issues.push({ level: 'error', code: 'MEDIA_READ_FAILED', message: `无法读取媒体「${assetMeta.name || assetId}」：${error instanceof Error ? error.message : String(error)}` })
      continue
    }
    if (!exists) {
      issues.push({
        level: 'error',
        code: 'MISSING_MEDIA_BLOB',
        message: `媒体文件缺失或已过期: ${assetMeta.name || assetId}`,
      })
    }
  }

  // 3. 字幕检查
  for (const cue of document.captions) {
    if (cue.startUs + cue.durationUs > document.durationUs + 33333) {
      issues.push({
        level: 'warning',
        code: 'CAPTION_OUT_OF_BOUNDS',
        message: `字幕「${cue.text.slice(0, 10)}…」超出工程时长`,
      })
    }
  }

  const valid = !issues.some((i) => i.level === 'error')

  return {
    valid,
    issues,
    estimatedDurationUs: document.durationUs,
  }
}
