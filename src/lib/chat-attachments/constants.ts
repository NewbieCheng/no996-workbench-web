/** 与桌面 Composer / module-sdk 对齐的识图 MIME。 */
export const PROMPT_IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

export const IMAGE_LIMITS = {
  maxImagesPerMessage: 20,
  maxImageBytes: 32 * 1024 * 1024,
  maxMessageImageBytes: 100 * 1024 * 1024,
  mediaTypes: PROMPT_IMAGE_MEDIA_TYPES,
} as const

export const CHAT_DOC_MAX_BYTES = 4 * 1024 * 1024

/** TXT / Markdown / Word（.docx）— 单文档导入与聊天附件文档部分共用。 */
export const DOCUMENT_ACCEPT =
  '.txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-word.document.macroenabled.12'

/** 网页聊天附件：识图 + 文档。 */
export const CHAT_ATTACHMENT_ACCEPT = [
  ...PROMPT_IMAGE_MEDIA_TYPES,
  '.md',
  '.txt',
  '.docx',
].join(',')

export const CHAT_ATTACHMENT_MAX_COUNT = 8
