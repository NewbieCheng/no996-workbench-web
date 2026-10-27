export type SubtitleSegment = { text: string; start: number; end: number }

function stamp(value: number): string {
  const ms = Math.round(value * 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}
export function exportSrt(lines: SubtitleSegment[]): string {
  return lines.map((line, index) => `${index + 1}\n${stamp(line.start)} --> ${stamp(line.end)}\n${line.text}\n`).join('\n')
}
export function parseSrt(content: string): SubtitleSegment[] {
  if (content.length > 1_000_000) throw new Error('assetLimit')
  const seconds = (value: string) => { const parts = value.replace(',', '.').split(':').map(Number); return parts[0] * 3600 + parts[1] * 60 + parts[2] }
  return content.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/).filter(Boolean).map(block => {
    const lines = block.split('\n'); if (/^\d+$/.test(lines[0])) lines.shift()
    const match = /^(\d{2,}:[0-5]\d:[0-5]\d[,.]\d{3})\s*-->\s*(\d{2,}:[0-5]\d:[0-5]\d[,.]\d{3})$/.exec(lines.shift() ?? '')
    if (!match || !lines.join('').trim()) throw new Error('invalidSubtitle')
    const start = seconds(match[1]); const end = seconds(match[2]); if (end <= start) throw new Error('invalidSubtitle')
    return { start, end, text: lines.join('\n') }
  })
}
export function validateCaptions(lines: SubtitleSegment[], duration: number): void {
  let previousEnd = 0
  for (const line of lines) {
    if (!line.text.trim() || !Number.isFinite(line.start) || !Number.isFinite(line.end) || line.start < previousEnd - 0.000001 || line.end <= line.start || line.end > duration + 0.000001) throw new Error('invalidSubtitle')
    previousEnd = line.end
  }
}
