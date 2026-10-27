import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_DOC_MAX_BYTES,
  DOCUMENT_ACCEPT,
  IMAGE_LIMITS,
} from './constants'

export type IngestProfileId = 'chatAttachment' | 'manuscriptTextOnly'

export type IngestProfile = {
  id: IngestProfileId
  accept: string
  maxDocBytes: number
  maxAttachmentCount?: number
  imageLimits?: typeof IMAGE_LIMITS
}

export const INGEST_PROFILES: Record<IngestProfileId, IngestProfile> = {
  chatAttachment: {
    id: 'chatAttachment',
    accept: CHAT_ATTACHMENT_ACCEPT,
    maxDocBytes: CHAT_DOC_MAX_BYTES,
    maxAttachmentCount: CHAT_ATTACHMENT_MAX_COUNT,
    imageLimits: IMAGE_LIMITS,
  },
  manuscriptTextOnly: {
    id: 'manuscriptTextOnly',
    accept: DOCUMENT_ACCEPT,
    maxDocBytes: CHAT_DOC_MAX_BYTES,
  },
}

export function getIngestProfile(id: IngestProfileId): IngestProfile {
  return INGEST_PROFILES[id]
}
