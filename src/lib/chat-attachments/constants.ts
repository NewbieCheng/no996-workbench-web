/** 与桌面 Composer / module-sdk 对齐的识图 MIME。 */
export const PROMPT_IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

export const IMAGE_LIMITS = {
  maxImagesPerMessage: 20,
  maxImageBytes: 32 * 1024 * 1024,
  maxMessageImageBytes: 100 * 1024 * 1024,
  mediaTypes: PROMPT_IMAGE_MEDIA_TYPES,
} as const

export const CHAT_DOC_MAX_BYTES = 4 * 1024 * 1024

/**
 * 单份资料的正文字数上限。
 *
 * 文件大小（4 MiB）不等于模型能吃得下的正文：4 MiB 中文 txt 约 130 万字，
 * 任何上下文窗口都装不下，而后端**不校验输入长度**，只会把上游的 400 透传回来。
 * 所以在解析这一步就把正文卡住，并给出能看懂的原因。
 */
export const CHAT_DOC_MAX_CHARS = 50_000

/**
 * 单次请求所有资料的正文字数合计上限。
 *
 * 超出时按顺序截断，并在正文里留下「已截断」标记 —— 模型必须知道资料不完整，
 * 否则会把残缺资料当成全部事实。
 */
export const CHAT_TOTAL_MAX_CHARS = 80_000

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
