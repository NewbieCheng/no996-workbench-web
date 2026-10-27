export type PhoneFrameSize = { width: number; height: number }

export const PHONE_WIDTH_MIN = 300
export const PHONE_WIDTH_MAX = 440
export const PHONE_HEIGHT_MIN = 480
export const PHONE_HEIGHT_MAX = 820

export const DEFAULT_PHONE_FRAME_SIZE: PhoneFrameSize = { width: 393, height: 640 }

const STORAGE_KEY = 'no996-studio-preview-phone-size'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function normalizePhoneFrameSize(size: Partial<PhoneFrameSize> | null | undefined): PhoneFrameSize {
  const width = clamp(
    typeof size?.width === 'number' ? size.width : DEFAULT_PHONE_FRAME_SIZE.width,
    PHONE_WIDTH_MIN,
    PHONE_WIDTH_MAX,
  )
  const height = clamp(
    typeof size?.height === 'number' ? size.height : DEFAULT_PHONE_FRAME_SIZE.height,
    PHONE_HEIGHT_MIN,
    PHONE_HEIGHT_MAX,
  )
  return { width, height }
}

export function readPhoneFrameSize(): PhoneFrameSize {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PHONE_FRAME_SIZE
    return normalizePhoneFrameSize(JSON.parse(raw) as PhoneFrameSize)
  } catch {
    return DEFAULT_PHONE_FRAME_SIZE
  }
}

export function writePhoneFrameSize(size: PhoneFrameSize) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePhoneFrameSize(size)))
}
