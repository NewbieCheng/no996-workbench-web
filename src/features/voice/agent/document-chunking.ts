import type { VoiceDubSegment } from './types'

/** 按中文句读与换行切句，保留句末标点。 */
export function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const sentences: string[] = []
  for (const para of normalized.split(/\n+/)) {
    const trimmed = para.trim()
    if (!trimmed) continue
    const matched = trimmed.match(/[^。！？!?；;]+[。！？!?；;]*/gu)
    if (matched?.length) {
      for (const s of matched) {
        const piece = s.trim()
        if (piece) sentences.push(piece)
      }
    } else {
      sentences.push(trimmed)
    }
  }
  return sentences
}

/** 贪心装箱：只在句边界拼接，单批不超过 maxChars。 */
export function packSentencesIntoChunks(sentences: string[], maxChars: number): string[] {
  if (!sentences.length) return []
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current)
        current = ''
      }
      chunks.push(sentence)
      continue
    }
    const candidate = current ? `${current}${sentence}` : sentence
    if (candidate.length > maxChars) {
      if (current) chunks.push(current)
      current = sentence
    } else {
      current = candidate
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export function packDocumentIntoPlannerChunks(documentText: string, maxChars: number): string[] {
  const sentences = splitIntoSentences(documentText)
  if (!sentences.length) return documentText.trim() ? [documentText.trim()] : []
  const packed = packSentencesIntoChunks(sentences, maxChars)
  return packed.length ? packed : [documentText.trim()]
}

export type PlannerBatchResult = {
  title?: string
  segments: VoiceDubSegment[]
}

export function mergePlannerSegments(batchResults: PlannerBatchResult[]): {
  title: string
  segments: VoiceDubSegment[]
} {
  let title = '产品口播'
  const merged: VoiceDubSegment[] = []

  for (const batch of batchResults) {
    const batchTitle = batch.title?.trim()
    if (batchTitle) {
      if (merged.length === 0 || batchTitle.length < title.length) {
        title = batchTitle
      }
    }
    merged.push(...batch.segments)
  }

  const segments = merged.map((seg, idx) => ({
    ...seg,
    id: `seg_${idx + 1}`,
  }))
  return { title, segments }
}

export function enforceAdvancedSegmentTextLimits(
  segments: VoiceDubSegment[],
  softMax: number,
  hardMax: number,
): { segments: VoiceDubSegment[]; hadSplit: boolean } {
  const expanded: VoiceDubSegment[] = []
  let hadSplit = false

  for (const seg of segments) {
    const pieces = splitSegmentTextForTts(seg.text, softMax, hardMax)
    if (pieces.length > 1) hadSplit = true
    pieces.forEach((text, index) => {
      expanded.push({
        ...seg,
        title: index === 0 ? seg.title : `${seg.title}（续）`,
        text,
        estimatedSeconds: Math.max(2, Math.round(text.length / 3.5)),
      })
    })
  }

  const segmentsOut = expanded.map((seg, idx) => ({
    ...seg,
    id: `seg_${idx + 1}`,
  }))
  return { segments: segmentsOut, hadSplit }
}

function splitSegmentTextForTts(text: string, softMax: number, hardMax: number): string[] {
  const trimmed = text.trim()
  if (!trimmed) return ['']
  if (trimmed.length <= softMax) return [trimmed]

  const sentences = splitIntoSentences(trimmed)
  if (!sentences.length) {
    return splitAtHardMax(trimmed, hardMax)
  }

  const parts: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (sentence.length > hardMax) {
      if (current) {
        parts.push(current)
        current = ''
      }
      parts.push(...splitAtHardMax(sentence, hardMax))
      continue
    }

    const candidate = current ? `${current}${sentence}` : sentence
    if (candidate.length > softMax) {
      if (current) parts.push(current)
      current = sentence
      if (current.length > softMax) {
        parts.push(current)
        current = ''
      }
    } else {
      current = candidate
    }
  }
  if (current) parts.push(current)
  return parts.length ? parts : [trimmed]
}

function splitAtHardMax(text: string, hardMax: number): string[] {
  const parts: string[] = []
  let remaining = text
  while (remaining.length > hardMax) {
    parts.push(remaining.slice(0, hardMax))
    remaining = remaining.slice(hardMax)
  }
  if (remaining) parts.push(remaining)
  return parts
}
