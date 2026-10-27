export type AttachmentKind = 'image' | 'video' | 'audio' | 'doc' | 'all';
export type AttachmentLayout = 'auto' | 'grid' | 'list' | 'inline' | 'composer';

export interface AttachmentUploaderItem {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  kind?: AttachmentKind;
  previewUrl?: string | null;
  thumbUrl?: string | null;
  status?: 'ready' | 'uploading' | 'pending' | 'error' | 'cancelled';
  progress?: number;
  error?: string;
  file?: File;
}

/** @deprecated Use AttachmentUploaderItem */
export interface AttachmentDisplayItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  previewUrl: string | null;
  status?: 'uploading' | 'ready' | 'error' | 'cancelled';
  progress?: number;
  error?: string;
}

export interface AttachmentDraft extends AttachmentUploaderItem {
  file: File;
}

export const KIND_RULES: Record<Exclude<AttachmentKind, 'all'>, { accept: string; label: string }> = {
  image: { accept: 'image/*', label: '图片' },
  video: { accept: 'video/*', label: '视频' },
  audio: { accept: 'audio/*', label: '音频' },
  doc: {
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.zip,.rar,.7z',
    label: '文档',
  },
};

const EXT_MAP: Record<'image' | 'video' | 'audio', string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'heic'],
  video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'wma', 'amr'],
};

const EXT_COLOR: Record<string, string> = {
  pdf: '#e5484d',
  doc: '#2b7fff',
  docx: '#2b7fff',
  rtf: '#2b7fff',
  xls: '#12a150',
  xlsx: '#12a150',
  csv: '#12a150',
  ppt: '#f76b15',
  pptx: '#f76b15',
  key: '#f76b15',
  zip: '#8e4ec6',
  rar: '#8e4ec6',
  '7z': '#8e4ec6',
  tar: '#8e4ec6',
  gz: '#8e4ec6',
  md: '#6e56cf',
  markdown: '#6e56cf',
  txt: '#64748b',
  json: '#64748b',
  xml: '#64748b',
  log: '#64748b',
  mp3: '#0ea5e9',
  wav: '#0ea5e9',
  flac: '#0ea5e9',
  mp4: '#f43f5e',
  mov: '#f43f5e',
};

export const TEXT_PREVIEW_EXTS = [
  'txt', 'md', 'markdown', 'json', 'csv', 'xml', 'log', 'js', 'ts', 'css', 'html', 'yml', 'yaml',
];

export function getFileExt(name: string): string {
  const index = name.lastIndexOf('.');
  return index > -1 ? name.slice(index + 1).toLowerCase() : '';
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function extColor(ext: string): string {
  return EXT_COLOR[ext.toLowerCase()] ?? '#94a3b8';
}

export function detectKind(file: Pick<File, 'name' | 'type'>): AttachmentKind {
  const mime = file.type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = getFileExt(file.name);
  for (const kind of ['image', 'video', 'audio'] as const) {
    if (EXT_MAP[kind].includes(ext)) return kind;
  }
  return 'doc';
}

export function resolveLayout(
  kind: AttachmentKind,
  layout: AttachmentLayout,
): 'grid' | 'list' | 'inline' | 'composer' {
  if (layout === 'inline') return 'inline';
  if (layout === 'composer') return 'composer';
  if (layout === 'grid' || layout === 'list') return layout;
  if (kind === 'audio' || kind === 'doc') return 'list';
  return 'grid';
}

export function resolveAccept(kind: AttachmentKind, accept?: string): string {
  if (accept) return accept;
  if (kind === 'all') return '';
  return KIND_RULES[kind].accept;
}

export function resolveKindLabel(kind: AttachmentKind): string {
  if (kind === 'all') return '文件';
  return KIND_RULES[kind].label;
}

/** 按 accept 与 maxFiles 切分文件：每个文件恰出现一次（先类型过滤，再截上限）。 */
export function splitAcceptedFiles(
  files: readonly File[],
  accept?: string,
  maxFiles?: number,
): { valid: File[]; invalid: File[] } {
  const acceptedTypes = accept?.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  const accepts = (file: File) => {
    if (!acceptedTypes?.length || acceptedTypes.includes('*/*')) return true;
    const name = file.name.toLowerCase();
    return acceptedTypes.some((type) => {
      if (type.startsWith('.')) return name.endsWith(type);
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -1);
        if (file.type.toLowerCase().startsWith(prefix)) return true;
        return !file.type && prefix === 'image/' && /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(name);
      }
      if (type === file.type.toLowerCase()) return true;
      if (!file.type) {
        const mimeExtensions: Record<string, RegExp> = {
          'image/png': /\.png$/i,
          'image/jpeg': /\.jpe?g$/i,
          'image/webp': /\.webp$/i,
          'image/gif': /\.gif$/i,
          'application/pdf': /\.pdf$/i,
          'text/plain': /\.(txt|md)$/i,
          'application/msword': /\.doc$/i,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': /\.docx$/i,
          'application/vnd.ms-excel': /\.xls$/i,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': /\.xlsx$/i,
          'application/vnd.ms-powerpoint': /\.ppt$/i,
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': /\.pptx$/i,
        };
        return mimeExtensions[type]?.test(name) ?? false;
      }
      return false;
    });
  };
  const matched = files.filter(accepts);
  const mismatched = files.filter((file) => !accepts(file));
  const limit = maxFiles ?? matched.length;
  return { valid: matched.slice(0, limit), invalid: [...mismatched, ...matched.slice(limit)] };
}

export function validateKind(file: File, kind: AttachmentKind): boolean {
  if (kind === 'all') return true;
  return detectKind(file) === kind;
}

function nextDraftId(): string {
  const randomUUID = (globalThis.crypto as Crypto | undefined)?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createAttachmentDrafts(files: readonly File[]): AttachmentDraft[] {
  const canObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  return files.map((file) => {
    const kind = detectKind(file);
    const canPreviewInBrowser = kind === 'image' || kind === 'video' || kind === 'audio';
    const previewUrl = canPreviewInBrowser && canObjectUrl ? URL.createObjectURL(file) : null;
    return {
      id: nextDraftId(),
      file,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      kind,
      previewUrl,
      // 视频缩略图需异步抽帧，不能复用 video blob URL
      thumbUrl: kind === 'image' ? previewUrl : null,
    };
  });
}

export function releaseAttachmentDrafts(drafts: readonly Pick<AttachmentDraft, 'previewUrl' | 'thumbUrl'>[]): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  for (const draft of drafts) {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    if (draft.thumbUrl && draft.thumbUrl !== draft.previewUrl) URL.revokeObjectURL(draft.thumbUrl);
  }
}

export function encodeAttachmentDraft(
  draft: Pick<AttachmentDraft, 'file' | 'name'>,
): Promise<{ dataBase64: string; mimeType: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('read failed'));
        return;
      }
      const comma = result.indexOf(',');
      resolve({
        dataBase64: comma >= 0 ? result.slice(comma + 1) : result,
        mimeType: draft.file.type,
        name: draft.name,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(draft.file);
  });
}

export function grabVideoFrame(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let done = false;

    const finish = (result: string | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), 6000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.15, video.duration || 0.15);
      } catch {
        window.clearTimeout(timer);
        finish(null);
      }
    };
    video.onseeked = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob ? URL.createObjectURL(blob) : null), 'image/jpeg', 0.82);
      } catch {
        finish(null);
      }
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
  });
}

export function itemKind(item: AttachmentUploaderItem): AttachmentKind {
  if (item.kind) return item.kind;
  if (item.mimeType?.startsWith('image/')) return 'image';
  if (item.mimeType?.startsWith('video/')) return 'video';
  if (item.mimeType?.startsWith('audio/')) return 'audio';
  const ext = getFileExt(item.name);
  for (const kind of ['image', 'video', 'audio'] as const) {
    if (EXT_MAP[kind].includes(ext)) return kind;
  }
  return 'doc';
}

export function itemThumb(item: AttachmentUploaderItem): string | null {
  return item.thumbUrl ?? item.previewUrl ?? null;
}

export function itemPreviewUrl(item: AttachmentUploaderItem): string | null {
  const kind = itemKind(item);
  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    return item.previewUrl ?? item.thumbUrl ?? null;
  }
  return null;
}
