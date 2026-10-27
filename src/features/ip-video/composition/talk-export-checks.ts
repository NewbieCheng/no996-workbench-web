import type { EditorDocument } from '@no996/video-editor'
import { captionTextNeedsReview, talkSettings, validateTalkCaptions, voiceDuration } from './talk-model'

export function talkExportIssues(doc: EditorDocument): string[] {
  const issues: string[] = []
  if (!doc.durationUs) issues.push('请先提供想法、文稿或音视频，制作可预览的作品。')
  if (doc.durationUs > 300_000_000) issues.push('口播作品需控制在 5 分钟内，请缩短文稿或素材。')
  const settings = talkSettings(doc)
  if (!voiceDuration(doc) && Array.from(settings.script.replace(/\s/gu, '')).length / (2.8 * (settings.speed ?? 1)) > 300) issues.push('当前文稿粗估超过 5 分钟，请缩短文稿；不会通过压缩字幕时间冒充合格时长。')
  if (captionTextNeedsReview(doc)) issues.push('文稿与已校时字幕不同，请在字幕设置中选择同步文字或保留字幕。')
  try { validateTalkCaptions(doc.captions, doc.durationUs) } catch (error) { issues.push(error instanceof Error ? error.message : String(error)) }
  return issues
}
