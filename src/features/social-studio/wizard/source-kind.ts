import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import type { SocialComposeSourceKind } from '../agent/task-types'

type SourceItem = Pick<
  WorkbenchBridgeCollectedItem,
  'platformId' | 'imageUrls' | 'playUrl' | 'content' | 'mediaLayout'
> & {
  /** 插件后续补充的笔记形式；当前桥接契约还没有这个字段。 */
  noteType?: string
}

/**
 * 判断一条采集/解析结果能不能作为图文模板母本。
 *
 * 契约里目前没有 `noteType`，所以先用 `playUrl` / `videoUrls` / `imageUrls` 推断；
 * 插件以后回传 `noteType` 时优先采用。这里只做纯判断，不发请求。
 */
export function classifySocialSource(item: SourceItem | null | undefined): SocialComposeSourceKind {
  if (!item) return 'unknown'
  if (item.platformId === 'weixin') return 'article'

  const noteType = item.noteType?.trim().toLowerCase()
  if (noteType === 'video') return 'video'
  if (noteType === 'image-text' || noteType === 'image_text') return 'image_text'
  if (noteType === 'text') return 'text_only'

  const videoCount = item.mediaLayout?.videoUrls?.length ?? 0
  const bodyImages = item.mediaLayout?.bodyImageUrls?.length ?? 0
  const imageCount = item.imageUrls?.length ?? 0
  const hasVideo = Boolean(item.playUrl) || videoCount > 0
  const hasImages = imageCount > 0 || bodyImages > 0

  if (hasVideo) return 'video'
  if (hasImages) return 'image_text'
  if (item.content?.trim()) return 'text_only'
  return 'unknown'
}

/** 模板排版只接受真正的图文素材；纯文本可以走“只复刻文案”。 */
export function supportsImageTemplate(kind: SocialComposeSourceKind): boolean {
  return kind === 'image_text' || kind === 'article'
}

export function sourceKindLabel(kind: SocialComposeSourceKind): string {
  switch (kind) {
    case 'image_text':
      return '图文笔记'
    case 'video':
      return '视频笔记'
    case 'text_only':
      return '纯文本'
    case 'article':
      return '文章'
    default:
      return '未知素材'
  }
}
