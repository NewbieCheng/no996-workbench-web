import type { AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import { CHAT_ATTACHMENT_MAX_COUNT, CHAT_DOC_MAX_BYTES, CHAT_DOC_MAX_CHARS, CHAT_TOTAL_MAX_CHARS } from './constants'
import { extractDocumentText, isSupportedDocumentFile } from './parse-document'
import { isPromptImageMime, readFileAsDataUri, validateImageBatch } from './parse-image'
import type { StoredChatAttachment } from './types'

export type { StoredChatAttachment } from './types'

export { extractDocumentText } from './parse-document'

/** 截断提示：正文里留痕（模型可见）+ 回调给界面（用户可见）。 */
function truncationMarker(kept: number, total: number): string {
  return `\n\n（资料已截断：仅提供前 ${kept} 字，原文共 ${total} 字。缺失部分请勿猜测。）`
}

export type PrepareAttachmentsOptions = {
  /**
   * 资料超限被截断时回调。
   *
   * 存在的理由：截断必须让用户看得见。之前只校验文件大小（4 MiB），
   * 解析出的正文原样拼进 user 消息，4 MiB 中文 txt 约 130 万字，
   * 模型侧直接超上下文，用户拿到的只是上游 400 的原文。
   */
  onNotice?: (message: string) => void
}

/** 将 AttachmentUploader 中的本地文件转为可随 chat 请求发送的结构。 */
export async function prepareAttachmentsFromItems(
  items: readonly AttachmentUploaderItem[],
  options: PrepareAttachmentsOptions = {},
): Promise<StoredChatAttachment[]> {
  const ready = items.filter((item) => item.file && item.status !== 'error')
  if (ready.length > CHAT_ATTACHMENT_MAX_COUNT) {
    throw new Error(`最多 ${CHAT_ATTACHMENT_MAX_COUNT} 个附件`)
  }

  const imageFiles = ready.map((item) => item.file!).filter((file) => isPromptImageMime(file.type))
  validateImageBatch(imageFiles)

  const out: StoredChatAttachment[] = []
  let usedChars = 0

  for (const item of ready) {
    const file = item.file!
    const mime = file.type || ''
    if (isPromptImageMime(mime)) {
      const dataUri = await readFileAsDataUri(file)
      out.push({ kind: 'image', name: item.name, mimeType: mime, dataUri })
      continue
    }
    if (await isSupportedDocumentFile(file)) {
      let text = await extractDocumentText(file, CHAT_DOC_MAX_BYTES)
      const total = [...text].length
      if (total > CHAT_DOC_MAX_CHARS) {
        throw new Error(
          `「${item.name}」正文 ${total} 字，超过单份资料上限 ${CHAT_DOC_MAX_CHARS} 字，请拆分或精简后再上传。`,
        )
      }
      const remaining = CHAT_TOTAL_MAX_CHARS - usedChars
      if (total > remaining) {
        // 留出标记的空间；剩得太少就没有使用价值，直接拒绝而不是给一段残句。
        const keep = remaining - 60
        if (keep < 500) {
          throw new Error(`资料合计超过 ${CHAT_TOTAL_MAX_CHARS} 字上限，请删减附件后重试。`)
        }
        text = `${text.slice(0, keep)}${truncationMarker(keep, total)}`
        usedChars += keep
        options.onNotice?.(`「${item.name}」超出单次资料上限，已截断到前 ${keep} 字。`)
      } else {
        usedChars += total
      }
      out.push({ kind: 'document', name: item.name, text })
      continue
    }
    throw new Error(`不支持的附件：${item.name}`)
  }
  return out
}

export function storedAttachmentsHaveImages(stored: readonly StoredChatAttachment[]): boolean {
  return stored.some((a) => a.kind === 'image')
}
