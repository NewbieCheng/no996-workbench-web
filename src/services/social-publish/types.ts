export type MaterialType = 'article' | 'image_text'

export type WeixinPublishMode = 'auto' | 'article' | 'image_draft'

export type XhsPublishMode = 'auto' | 'image_text' | 'article'

export type SourceArticle = {
  title: string
  html: string
  markdown: string
  summary: string
  cover?: string
  url: string
  capturedAt: number
  materialType?: MaterialType
}

export type ChannelPayload = {
  html: string
  markdown: string
}

export type UploadedImage = {
  url: string
  width: number
  height: number
  fileId?: string
  originalUrl?: string
  localUrl?: string
}

export type WorkbenchSyncDraft = {
  title: string
  html: string
  markdown: string
  summary?: string
  cover?: string
  url?: string
  materialType: MaterialType
}

export type BuildSyncDraftResult = {
  channelIds: string[]
  draft: WorkbenchSyncDraft
  weixinPublishMode?: WeixinPublishMode
}
