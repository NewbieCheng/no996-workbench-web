import type { AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import { CHAT_ATTACHMENT_MAX_COUNT, CHAT_DOC_MAX_BYTES } from './constants'
import { extractDocumentText, isSupportedDocumentFile } from './parse-document'
import { isPromptImageMime, readFileAsDataUri, validateImageBatch } from './parse-image'
import type { StoredChatAttachment } from './types'

export type { StoredChatAttachment } from './types'

export { extractDocumentText } from './parse-document'

/** 将 AttachmentUploader 中的本地文件转为可随 chat 请求发送的结构。 */
export async function prepareAttachmentsFromItems(
  items: readonly AttachmentUploaderItem[],
): Promise<StoredChatAttachment[]> {
  const ready = items.filter((item) => item.file && item.status !== 'error')
  if (ready.length > CHAT_ATTACHMENT_MAX_COUNT) {
    throw new Error(`最多 ${CHAT_ATTACHMENT_MAX_COUNT} 个附件`)
  }

  const imageFiles = ready.map((item) => item.file!).filter((file) => isPromptImageMime(file.type))
  validateImageBatch(imageFiles)

  const out: StoredChatAttachment[] = []
  for (const item of ready) {
    const file = item.file!
    const mime = file.type || ''
    if (isPromptImageMime(mime)) {
      const dataUri = await readFileAsDataUri(file)
      out.push({ kind: 'image', name: item.name, mimeType: mime, dataUri })
      continue
    }
    if (await isSupportedDocumentFile(file)) {
      const text = await extractDocumentText(file, CHAT_DOC_MAX_BYTES)
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
