import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  layoutChineseText,
  getCharWidth,
} from '../src/panels/captions/typography.ts'
import {
  parseSrt,
  exportSrt,
  timeUsToSrtTimestamp,
  srtTimestampToTimeUs,
} from '../src/panels/captions/srt.ts'
import {
  shiftCaptions,
  splitCaptionAt,
  mergeCaptions,
  remapCaptionsAfterClipTrim,
} from '../src/panels/captions/caption-ops.ts'
import { buildCaptionCuesFromBeats } from '../src/panels/captions/script-bound.ts'

test('captions-typography: layoutChineseText wraps text and NEVER truncates user content', () => {
  const text = '这是一个非常长的测试文本用于验证中文排版引擎是否会在折行时保留全部正文，绝对不会掐头去尾，即使超出限制也会如实返回。'
  const res = layoutChineseText(text, {
    fontSize: 20,
    maxWidth: 200, // 每行约 10 个全角字
    maxLines: 2,
  })

  // 1. 验证没有正文被截断
  const combined = res.lines.join('')
  assert.equal(combined, text)

  // 2. 验证行数与溢出检测
  assert.ok(res.lines.length > 2)
  assert.equal(res.isOverflow, true)
  assert.ok(res.overflowChars > 0)
})

test('captions-typography: punctuation avoidance at start of line', () => {
  const text = '你好吗？很好！'
  // 若正好在标点处换行，避头法则会将上一行末字拉到新行，标点不单独成首
  const res = layoutChineseText(text, {
    fontSize: 20,
    maxWidth: 70, // 约容纳 3 个字
    maxLines: 4,
  })

  // 任何一行的第一个字都不能是避头标点
  for (let i = 1; i < res.lines.length; i++) {
    const firstChar = res.lines[i][0]
    assert.ok(!['？', '！', '，', '。'].includes(firstChar), `行首不应为避头标点: ${firstChar}`)
  }
})

test('captions-typography: SRT parse and export roundtrip fidelity', () => {
  const originalSrt = `1
00:00:01,000 --> 00:00:03,500
第一句测试字幕

2
00:00:04,200 --> 00:00:07,800
第二句测试字幕，包含标点！`

  const parsed = parseSrt(originalSrt)
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].startUs, 1_000_000)
  assert.equal(parsed[0].durationUs, 2_500_000)
  assert.equal(parsed[0].text, '第一句测试字幕')
  assert.equal(parsed[0].timingSource, 'srt')

  assert.equal(parsed[1].startUs, 4_200_000)
  assert.equal(parsed[1].durationUs, 3_600_000)
  assert.equal(parsed[1].text, '第二句测试字幕，包含标点！')

  // 导出回 SRT
  const exported = exportSrt(parsed)
  assert.equal(exported.trim(), originalSrt.trim())

  // 二次解析验证幂等无损
  const secondParsed = parseSrt(exported)
  assert.equal(secondParsed.length, 2)
  assert.equal(secondParsed[0].startUs, 1_000_000)
  assert.equal(secondParsed[1].startUs, 4_200_000)
})

test('captions-typography: splitCaptionAt preserves estimated timingSource flag', () => {
  const cues = [
    {
      id: 'cue-est-1',
      startUs: 1_000_000,
      durationUs: 4_000_000,
      text: '前半句内容和后半句内容',
      timingSource: 'estimated', // 估算来源
    },
  ]

  // 在 3_000_000 处切分
  const split = splitCaptionAt(cues, 'cue-est-1', 3_000_000, 5)
  assert.equal(split.length, 2)

  // 严格断言：两半都必须显式保留 estimated 标志，不能伪造为精确
  assert.equal(split[0].timingSource, 'estimated')
  assert.equal(split[1].timingSource, 'estimated')
  assert.equal(split[0].durationUs, 2_000_000)
  assert.equal(split[1].durationUs, 2_000_000)
})

test('captions-typography: shiftCaptions prevents negative time and mergeCaptions combines duration', () => {
  const cues = [
    { id: 'c1', startUs: 500_000, durationUs: 1_000_000, text: '第一句', timingSource: 'manual' },
    { id: 'c2', startUs: 1_500_000, durationUs: 1_000_000, text: '第二句', timingSource: 'estimated' },
  ]

  // 向左平移超出 500_000，应被安全截断到 0
  const shifted = shiftCaptions(cues, -1_000_000)
  assert.equal(shifted[0].startUs, 0)
  assert.equal(shifted[1].startUs, 1_000_000)

  // 合并 c1 和 c2，若其中有 estimated，合并后仍应标记为 estimated
  const merged = mergeCaptions(cues, 'c1', 'c2')
  assert.equal(merged.length, 1)
  assert.equal(merged[0].startUs, 500_000)
  assert.equal(merged[0].durationUs, 2_000_000)
  assert.equal(merged[0].text, '第一句 第二句')
  assert.equal(merged[0].timingSource, 'estimated')
})

test('script-bound: buildCaptionCuesFromBeats skips transition beats without text', () => {
  const beats = [
    { segment: { text: '开场一句。' } },
    { segment: { text: '' } },
    { segment: { text: '收尾。' } },
  ]
  const shots = [
    { id: 's1', startUs: 0, durationUs: 2_000_000 },
    { id: 's2', startUs: 2_000_000, durationUs: 400_000 },
    { id: 's3', startUs: 2_400_000, durationUs: 1_500_000 },
  ]
  const cues = buildCaptionCuesFromBeats(beats, shots)
  assert.equal(cues.length, 2)
  assert.equal(cues[0].text, '开场一句。')
  assert.equal(cues[0].boundClipId, 's1')
  assert.equal(cues[1].text, '收尾。')
  assert.equal(cues[1].boundClipId, 's3')
})
