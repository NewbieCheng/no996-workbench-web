import { useCallback, useEffect, useState } from 'react'
import {
  AttachmentUploader,
  createAttachmentDrafts,
  releaseAttachmentDrafts,
  type AttachmentUploaderItem,
} from '@no996/ui/attachment-uploader'
import {
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_DOC_MAX_BYTES,
  IMAGE_LIMITS,
} from '../lib/chat-attachments/constants'
import { INGEST_PROFILES } from '../lib/chat-attachments/ingest-profiles'

const CHAT_ATTACHMENT_ACCEPT = INGEST_PROFILES.chatAttachment.accept

type Props = {
  disabled?: boolean
  items: AttachmentUploaderItem[]
  onChange: (items: AttachmentUploaderItem[]) => void
  className?: string
}

/** 聊天/生成提示用的本地附件条（无服务端分块上传）。 */
export function ChatPromptAttachments({ disabled, items, onChange, className }: Props) {
  const onAdd = useCallback(
    (files: File[]) => {
      const drafts = createAttachmentDrafts(files).map((draft) => ({
        ...draft,
        status: 'ready' as const,
        progress: draft.size,
      }))
      onChange([...items, ...drafts].slice(0, CHAT_ATTACHMENT_MAX_COUNT))
    },
    [items, onChange],
  )

  const onRemove = useCallback(
    (id: string) => {
      const removed = items.find((item) => item.id === id)
      if (removed?.previewUrl) {
        releaseAttachmentDrafts([removed])
      }
      onChange(items.filter((item) => item.id !== id))
    },
    [items, onChange],
  )

  return (
    <AttachmentUploader
      className={className}
      kind="all"
      layout="composer"
      accept={CHAT_ATTACHMENT_ACCEPT}
      multiple
      maxCount={CHAT_ATTACHMENT_MAX_COUNT}
      maxBytes={IMAGE_LIMITS.maxImageBytes}
      maxTotalBytes={IMAGE_LIMITS.maxMessageImageBytes}
      items={items}
      onAdd={onAdd}
      onRemove={onRemove}
      disabled={disabled}
      addLabel="添加图片或文档"
      emptyDescription="支持 PNG/JPEG/WebP/GIF、Markdown、TXT、Word（.docx）"
    />
  )
}

/** 受控附件列表的便捷 hook。 */
export function useChatPromptAttachments() {
  const [items, setItems] = useState<AttachmentUploaderItem[]>([])

  useEffect(() => {
    return () => {
      releaseAttachmentDrafts(items)
    }
  }, [items])

  const clear = useCallback(() => {
    releaseAttachmentDrafts(items)
    setItems([])
  }, [items])

  return { items, setItems, clear }
}

export { CHAT_DOC_MAX_BYTES }
