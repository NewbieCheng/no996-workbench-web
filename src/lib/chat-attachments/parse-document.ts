import mammoth from 'mammoth'
import { CHAT_DOC_MAX_BYTES } from './constants.ts'

const DOC_EXT = new Set(['md', 'txt', 'docx'])

const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroenabled.12',
])

export type DocumentKind = 'txt' | 'md' | 'docx'

export function extOfFileName(name: string): string {
  const i = name.lastIndexOf('.')
  return i > -1 ? name.slice(i + 1).toLowerCase() : ''
}

/** 按扩展名与 MIME 判断文档类型（不含 .doc 旧版 Word）。 */
export function resolveDocumentKind(file: File): DocumentKind | null {
  const ext = extOfFileName(file.name)
  if (ext === 'doc') return null
  if (DOC_EXT.has(ext)) return ext as DocumentKind

  const mime = file.type.toLowerCase().split(';')[0]?.trim() ?? ''
  if (mime === 'text/plain') return 'txt'
  if (mime === 'text/markdown') return 'md'
  if (DOCX_MIME_TYPES.has(mime)) return 'docx'

  return null
}

export async function isDocxZipArchive(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b
}

export async function isSupportedDocumentFile(file: File): Promise<boolean> {
  if (resolveDocumentKind(file)) return true
  if (DOC_EXT.has(extOfFileName(file.name))) return true
  return isDocxZipArchive(file)
}

function normalizeManuscriptText(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function hasSubstantiveText(text: string): boolean {
  return text.replace(/\s/g, '').length > 0
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** 仅解码 =XX 与软换行，保留已是 UTF-8 的明文（Word altChunk MHT 常见）。 */
function decodeQuotedPrintableLoose(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function htmlToPlainText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(stripped, 'text/html')
    return doc.body.textContent ?? ''
  }
  return stripped.replace(/<[^>]+>/g, ' ')
}

function extractTextFromMht(mht: string): string {
  const parts = mht.split('------=mhtDocumentPart')
  for (const part of parts) {
    if (!/Content-Type:\s*text\/html/i.test(part)) continue
    const sep = part.match(/\r?\n\r?\n/)
    if (!sep || sep.index === undefined) continue
    const qpBody = part.slice(sep.index + sep[0].length).trim()
    const html = decodeQuotedPrintableLoose(qpBody)
    const text = normalizeManuscriptText(htmlToPlainText(html))
    if (hasSubstantiveText(text)) return text
  }
  return ''
}

function extractPlainTextFromWordXml(xml: string): string {
  const paragraphs: string[] = []
  const paragraphRe = /<w:p[\s\S]*?<\/w:p>/g
  let paragraphMatch: RegExpExecArray | null
  while ((paragraphMatch = paragraphRe.exec(xml)) !== null) {
    const block = paragraphMatch[0]
    const runs: string[] = []
    const textRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
    let textMatch: RegExpExecArray | null
    while ((textMatch = textRe.exec(block)) !== null) {
      runs.push(decodeXmlEntities(textMatch[1]))
    }
    const line = runs.join('')
    if (line.trim()) paragraphs.push(line)
  }
  return paragraphs.join('\n')
}

async function extractDocxFromZipFallbacks(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(arrayBuffer)
    const main = await zip.file('word/document.xml')?.async('string')
    let text = main ? extractPlainTextFromWordXml(main) : ''
    if (!hasSubstantiveText(text)) {
      const header = await zip.file('word/header1.xml')?.async('string')
      const footer = await zip.file('word/footer1.xml')?.async('string')
      const extra = [header, footer].filter(Boolean).map((xml) => extractPlainTextFromWordXml(xml!))
      text = [text, ...extra].filter(Boolean).join('\n')
    }
    if (hasSubstantiveText(text)) return text

    const mht = await zip.file('word/afchunk.mht')?.async('string')
    if (mht) {
      text = extractTextFromMht(mht)
      if (hasSubstantiveText(text)) return text
    }
    return ''
  } catch {
    return ''
  }
}

async function extractDocxPlainText(arrayBuffer: ArrayBuffer): Promise<string> {
  let text = ''
  try {
    const rawResult = await mammoth.extractRawText({ arrayBuffer })
    text = normalizeManuscriptText(rawResult.value)
    if (hasSubstantiveText(text)) return text

    const htmlResult = await mammoth.convertToHtml({ arrayBuffer })
    text = normalizeManuscriptText(htmlToPlainText(htmlResult.value))
    if (hasSubstantiveText(text)) return text
  } catch {
    // 最小/兼容性 docx 可能让 mammoth 抛错，继续走 ZIP / MHT 回退。
  }

  text = normalizeManuscriptText(await extractDocxFromZipFallbacks(arrayBuffer))
  if (hasSubstantiveText(text)) return text

  throw new Error(
    '未能从 Word 中读出正文（可能是扫描件、纯图片或加密文档）。请用 Word 另存为 .txt，或直接复制正文粘贴。',
  )
}

/**
 * 浏览器内从本地文件抽取纯文本（txt / md / docx，含 Word 兼容性模式 MHT altChunk）。
 */
export async function extractDocumentText(file: File, maxBytes = CHAT_DOC_MAX_BYTES): Promise<string> {
  if (extOfFileName(file.name) === 'doc') {
    throw new Error('暂不支持旧版 .doc，请在 Word 中另存为 .docx 后上传。')
  }

  let kind = resolveDocumentKind(file)
  if (!kind && (await isDocxZipArchive(file))) {
    kind = 'docx'
  }
  if (!kind) {
    throw new Error('仅支持 TXT、Markdown 或 Word（.docx）文件。')
  }
  if (file.size > maxBytes) {
    throw new Error(`文件过大（上限 ${maxBytes / (1024 * 1024)} MiB）：${file.name}`)
  }

  if (kind === 'docx') {
    const arrayBuffer = await file.arrayBuffer()
    try {
      return await extractDocxPlainText(arrayBuffer)
    } catch (err) {
      if (err instanceof Error && err.message.includes('未能从 Word')) throw err
      throw new Error('无法解析该 Word 文档，请另存为 .docx 后重试，或导出为 TXT。')
    }
  }

  const text = await file.text()
  const cleaned = text.replace(/^\uFEFF/, '').trim()
  if (!cleaned) {
    throw new Error('文档内容为空，请换一份文稿重试。')
  }
  return cleaned
}
