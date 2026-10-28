import assert from 'node:assert/strict'
import test from 'node:test'
import { BUILTIN_BANNED_WORDS, hardCheckSummary, runHardCheck } from './hard-check.ts'

test('runHardCheck flags builtin banned words and locates the segment', () => {
  const result = runHardCheck({
    text: '这是最好的产品',
    segments: [{ id: 's1', text: '这是最好的产品' }],
  })
  assert.equal(result.pass, false)
  assert.ok(result.hits.some((h) => h.label === '最好' && h.rule === 'banned'))
  assert.deepEqual(result.mustFixIds, ['s1'])
})

test('runHardCheck distinguishes user banned words from builtin ones', () => {
  const result = runHardCheck({ text: '本品绝不掺水', bannedWords: ['掺水'] })
  assert.equal(result.hits.length, 1)
  assert.equal(result.hits[0].rule, 'user-banned')
})

test('runHardCheck reports missing must-words', () => {
  const result = runHardCheck({ text: '普通文案', mustWords: ['限时'] })
  assert.equal(result.pass, false)
  assert.equal(result.hits[0].rule, 'must-word')
})

test('fake urgency is only checked in live mode', () => {
  const text = '只剩最后一件'
  assert.equal(runHardCheck({ text, mode: 'video' }).pass, true)
  const live = runHardCheck({ text, mode: 'live' })
  assert.ok(live.hits.some((h) => h.rule === 'fake-urgency'))
  // 用户提供了真实库存信息时不再判为虚假紧迫感
  assert.equal(runHardCheck({ text, mode: 'live', hasStockInfo: true }).pass, true)
})

test('unsupported numbers are flagged unless traceable to a source', () => {
  const text = '销量提升 300 倍'
  assert.ok(runHardCheck({ text, allowedNumberSources: '' }).hits.some((h) => h.rule === 'unsupported-number'))
  assert.equal(runHardCheck({ text, allowedNumberSources: '提升 300 倍' }).pass, true)
})

test('segmentCharTolerance=1 enforces a hard cap (titles), default allows 130%', () => {
  const over = 'x'.repeat(25)
  const strict = runHardCheck({
    text: over,
    segments: [{ id: '1', text: over }],
    segmentCharBudgets: [{ id: '1', budget: 20 }],
    segmentCharTolerance: 1,
  })
  assert.equal(strict.pass, false)
  assert.equal(strict.hits[0].rule, 'length')

  // 默认 1.3 倍容差下，25 / 20 = 125% 仍然合格
  const lenient = runHardCheck({
    text: over,
    segments: [{ id: '1', text: over }],
    segmentCharBudgets: [{ id: '1', budget: 20 }],
  })
  assert.equal(lenient.pass, true)
})

test('runHardCheck flags early selling in video first segment', () => {
  const result = runHardCheck({
    text: '这批货刚补的，想吃的别再犹豫，点下方小黄车！\n第二段正常讲。\n第三段正常讲。',
    mode: 'video',
    segments: [
      { id: 'seg-1', text: '这批货刚补的，想吃的别再犹豫，点下方小黄车！' },
      { id: 'seg-2', text: '第二段正常讲。' },
      { id: 'seg-3', text: '第三段正常讲。' },
    ],
  })
  assert.equal(result.pass, false)
  assert.ok(result.hits.some((h) => h.rule === 'early-selling'))
  assert.ok(result.mustFixIds.includes('seg-1'))
})

test('runHardCheck flags segment duplicate between head and tail', () => {
  const duplicateText = '这批货刚补的，数量有限，卖完下一波不知道等到什么时候。'
  const result = runHardCheck({
    text: `${duplicateText}\n第二段中间论述\n${duplicateText}`,
    segments: [
      { id: 'seg-1', text: duplicateText },
      { id: 'seg-2', text: '第二段中间论述' },
      { id: 'seg-3', text: duplicateText },
    ],
  })
  assert.equal(result.pass, false)
  assert.ok(result.hits.some((h) => h.rule === 'segment-duplicate'))
})

test('runHardCheck flags fake offer when user has no stock/offer info', () => {
  const result = runHardCheck({
    text: '这包调料非常好，今天下单活动价只保今天，抢完恢复原价！',
    hasStockInfo: false,
    segments: [{ id: 'seg-1', text: '这包调料非常好，今天下单活动价只保今天，抢完恢复原价！' }],
  })
  assert.equal(result.pass, false)
  assert.ok(result.hits.some((h) => h.rule === 'fake-offer'))
})

test('hardCheckSummary never claims pass on failures', () => {
  assert.equal(hardCheckSummary({ pass: true, hits: [], mustFixIds: [], charCount: 0 }), '通过')
  const summary = hardCheckSummary(runHardCheck({ text: '最好的' }))
  assert.notEqual(summary, '通过')
  assert.match(summary, /最好/)
})

test('banned word table has no duplicates and includes absolute-claim terms', () => {
  assert.ok(BUILTIN_BANNED_WORDS.length > 0)
  assert.equal(new Set(BUILTIN_BANNED_WORDS).size, BUILTIN_BANNED_WORDS.length)
  for (const word of ['最好', '第一', '100%', '保证']) {
    assert.ok(BUILTIN_BANNED_WORDS.includes(word), `缺少违禁词：${word}`)
  }
})

test('「第一」的序数用法不算绝对化用语，极限宣称仍然命中', () => {
  const isBanned = (text) =>
    runHardCheck({ text }).hits.some((h) => h.label === '第一' && h.rule === 'banned')

  // 序数：叙述顺序，没有极限宣称的意思
  assert.equal(isBanned('第一步，先记录一周你实际遇到的场景。'), false)
  assert.equal(isBanned('第一次买也不踩坑。'), false)
  assert.equal(isBanned('第一版和第二版差别不大。'), false)

  // 绝对化：仍然必须命中
  assert.equal(isBanned('这是全网销量第一的品牌。'), true)
  assert.equal(isBanned('第一，先说结论。'), true)

  // 混排：不能因为出现了「第一步」就放过真正违规的那一处
  assert.equal(isBanned('第一步先这样做，但我们是行业第一。'), true)
})

test('序数豁免不适用于用户自设的禁用词', () => {
  const result = runHardCheck({ text: '第一步很重要', bannedWords: ['第一'] })
  assert.ok(result.hits.some((h) => h.label === '第一' && h.rule === 'user-banned'))
})

test('「第一个月 / 第一时间 / 第一反应」是正常叙述，不算绝对化用语', () => {
  const isBanned = (text) =>
    runHardCheck({ text }).hits.some((h) => h.label === '第一' && h.rule === 'banned')
  assert.equal(isBanned('第一个月先别急着换方法。'), false)
  assert.equal(isBanned('第一时间把问题记下来。'), false)
  assert.equal(isBanned('我的第一反应是先去复盘。'), false)
  assert.equal(isBanned('第一位顾客进来的时候，我还在备料。'), false)
})

test('宣称语境里的「第一」即使跟量词也仍然命中', () => {
  const isBanned = (text) =>
    runHardCheck({ text }).hits.some((h) => h.label === '第一' && h.rule === 'banned')
  assert.equal(isBanned('我们是行业第一位。'), true)
  assert.equal(isBanned('这是全网销量第一的品牌。'), true)
  assert.equal(isBanned('第一品牌就是这么做的。'), true)
})

test('同一个违禁词出现在多段时，每段都要被点名（mustFixIds 不能只收第一段）', () => {
  const result = runHardCheck({
    text: '这是我们行业第一的做法。\n中间段正常讲方法。\n第一步照样做，但结果还是行业第一。',
    segments: [
      { id: 'seg-1', text: '这是我们行业第一的做法。' },
      { id: 'seg-2', text: '中间段正常讲方法。' },
      { id: 'seg-3', text: '第一步照样做，但结果还是行业第一。' },
    ],
  })
  const firstHits = result.hits.filter((h) => h.label === '第一')
  assert.equal(firstHits.length, 2)
  assert.deepEqual(firstHits.map((h) => h.segmentId), ['seg-1', 'seg-3'])
  assert.deepEqual(result.mustFixIds.sort(), ['seg-1', 'seg-3'])
})

test('口播字数口径不计标点，且命中说明带目标区间与差额', () => {
  // 每段 9 个字符里 1 个是逗号：35 段 = 原始 315 字 / 口播 280 字。
  // 目标 250（区间 213–288）：原始口径超限，口播口径合格。
  const body = '这是口播正文内容，'.repeat(35)
  const raw = runHardCheck({ text: body, targetChars: 250 })
  const spoken = runHardCheck({ text: body, targetChars: 250, lengthCountMode: 'spoken' })
  assert.equal(raw.hits.some((h) => h.rule === 'length'), true)
  assert.equal(spoken.hits.some((h) => h.rule === 'length'), false)

  const over = runHardCheck({
    text: '字'.repeat(300),
    targetChars: 250,
    lengthCountMode: 'spoken',
  })
  const hit = over.hits.find((h) => h.rule === 'length')
  assert.ok(hit)
  assert.equal(hit.length.target, 250)
  assert.equal(hit.length.low, 213)
  assert.equal(hit.length.high, 288)
  assert.equal(hit.length.direction, 'over')
  assert.equal(hit.length.delta, 12)
  assert.match(hit.detail, /合格区间 213–288/)
})

