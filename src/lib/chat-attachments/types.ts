export type StoredChatAttachment =
  | { kind: 'image'; name: string; mimeType: string; dataUri: string }
  | { kind: 'document'; name: string; text: string }

export type ParsedImage = Extract<StoredChatAttachment, { kind: 'image' }>
export type ParsedDocument = Extract<StoredChatAttachment, { kind: 'document' }>
