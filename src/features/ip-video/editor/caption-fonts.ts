/** Local caption fonts: catalog from video-editor; CSS load stays in the workbench host. */
export {
  CAPTION_FONTS,
  captionFontByFamily,
  captionFontById,
  type CaptionFont,
} from '@no996/video-editor'

import { CAPTION_FONTS, type CaptionFont } from '@no996/video-editor'

const fontStyles: Record<string, () => Promise<unknown>> = {
  'alibaba-puhuiti': () => import('../../../fonts/alibaba-puhuiti.css'),
  'noto-sans-sc': () => import('@fontsource/noto-sans-sc/chinese-simplified-400.css'),
  'noto-serif-sc': () => import('@fontsource/noto-serif-sc/chinese-simplified-400.css'),
  'zcool-qingke-huangyou': () => import('@fontsource/zcool-qingke-huangyou/chinese-simplified-400.css'),
  'zcool-kuaile': () => import('@fontsource/zcool-kuaile/chinese-simplified-400.css'),
  'ma-shan-zheng': () => import('@fontsource/ma-shan-zheng/chinese-simplified-400.css'),
  'zcool-xiaowei': () => import('@fontsource/zcool-xiaowei/chinese-simplified-400.css'),
  'liu-jian-mao-cao': () => import('@fontsource/liu-jian-mao-cao/chinese-simplified-400.css'),
  'zhi-mang-xing': () => import('@fontsource/zhi-mang-xing/chinese-simplified-400.css'),
  'long-cang': () => import('@fontsource/long-cang/chinese-simplified-400.css'),
}

const loadPromises = new Map<string, Promise<void>>()
const FONT_LOAD_TIMEOUT_MS = 20_000
const READINESS_TEXT = '中文口播字幕，。！？ABCabc0123456789'

/**
 * Await before preview/export. Only the selected family's local CSS is imported.
 * Concurrent requests share work; failures/timeouts are evicted so callers can retry.
 */
export function loadCaptionFont(id: string): Promise<void> {
  const font = CAPTION_FONTS.find((entry: CaptionFont) => entry.id === id)
  const importStyle = Object.hasOwn(fontStyles, id) ? fontStyles[id] : undefined
  if (!font || !importStyle) return Promise.reject(new Error(`未知字幕字体：${id}`))
  if (typeof document === 'undefined' || !document.fonts) {
    return Promise.reject(new Error('当前环境不支持本地字幕字体加载'))
  }

  const cached = loadPromises.get(id)
  if (cached) return cached

  const fontSet = document.fonts
  let timer: ReturnType<typeof setTimeout> | undefined
  const loading = (async () => {
    await importStyle()
    const descriptor = `${font.weight} 32px "${font.family}"`
    const faces = await fontSet.load(descriptor, READINESS_TEXT)
    if (
      faces.length === 0 ||
      faces.some((face) => face.status !== 'loaded') ||
      !fontSet.check(descriptor, READINESS_TEXT)
    ) {
      throw new Error(`字幕字体未就绪：${font.label}`)
    }
  })()
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`字幕字体加载超时（${FONT_LOAD_TIMEOUT_MS / 1000} 秒）：${font.label}，请重试`))
    }, FONT_LOAD_TIMEOUT_MS)
  })
  const pending = Promise.race([loading, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
  loadPromises.set(id, pending)
  void pending.catch(() => {
    if (loadPromises.get(id) === pending) loadPromises.delete(id)
  })
  return pending
}

export function loadCaptionFontByFamily(family: string): Promise<void> {
  const normalized = family.trim().replace(/^(['"])(.*)\1$/, '$2')
  const font = CAPTION_FONTS.find((entry) => entry.family === normalized)
  if (!font) return Promise.reject(new Error(`未知字幕字体族：${family}`))
  return loadCaptionFont(font.id)
}
