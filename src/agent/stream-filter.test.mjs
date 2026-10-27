import assert from 'node:assert/strict'
import test from 'node:test'
import { createDisplayDelta, createTextStreamFilter } from './stream-filter.ts'

/** 把 JSON 用「一刀切」外的方式切成 chunk，模拟模型逐 token 推送 */
function chunkize(text, sizes) {
  const out = []
  let i = 0
  let k = 0
  while (i < text.length) {
    const size = sizes[k % sizes.length]
    out.push(text.slice(i, i + size))
    i += size
    k += 1
  }
  return out
}

function feed(text, sizes, options) {
  const f = createTextStreamFilter(options)
  return chunkize(text, sizes).map((c) => f.push(c)).join('') + f.flush()
}

const WRITER_JSON = JSON.stringify({
  segments: [
    { id: '1', spoken: '你有没有过这种时候，早上出门前找不到钥匙？', visual: '手持钥匙特写' },
    { id: '2', spoken: '这个挂钩一贴就好，门后空间立刻多一半。', visual: '门后收纳演示' },
  ],
})

test('extracts only the requested field from JSON output', () => {
  const text = feed(WRITER_JSON, [8192])
  assert.equal(
    text,
    '你有没有过这种时候，早上出门前找不到钥匙？\n这个挂钩一贴就好，门后空间立刻多一半。',
  )
})

test('output never contains JSON syntax or field names', () => {
  // 这是产品硬约束：用户不该看到花括号、方括号、转义与 key 名
  const text = feed(WRITER_JSON, [3, 1, 7, 2])
  for (const bad of ['{', '}', '[', ']', '"', 'segments', 'spoken', 'visual', 'id']) {
    assert.equal(text.includes(bad), false, `输出里不应出现 ${bad}：${text}`)
  }
})

test('result is independent of how the stream is chunked', () => {
  // 模型逐 token 推送，半截 key / 半截转义都会出现，结果必须完全一致
  const expected = feed(WRITER_JSON, [8192])
  const patterns = [
    [1],
    [2],
    [3],
    [5],
    [1, 2, 3, 5, 8],
    [13, 1, 21, 4],
    [WRITER_JSON.length],
  ]
  for (const sizes of patterns) {
    const actual = feed(WRITER_JSON, sizes)
    assert.equal(actual, expected, `切分方式 ${JSON.stringify(sizes)} 下结果不一致`)
  }
})

test('decodes escapes across chunk boundaries', () => {
  // \n 与 \" 可能一个 chunk 里只有反斜杠，下一个才给 n / "
  const json = JSON.stringify({ spoken: '第一行\n第二行说"重点"' })
  const expected = feed(json, [8192])
  assert.equal(expected, '第一行\n第二行说"重点"')
  for (const sizes of [[1], [2], [3], [7]]) {
    assert.equal(feed(json, sizes), expected, `切分 ${JSON.stringify(sizes)} 下转义解码不一致`)
  }
})

test('ignores non-string fields', () => {
  const text = feed('{"id":7,"spoken":"要显示","ok":true,"other":null}', [2])
  assert.equal(text, '要显示')
})

test('supports extra keys and custom separator', () => {
  const json = JSON.stringify([
    { id: 1, title: '第一句' },
    { id: 2, title: '第二句' },
  ])
  const text = feed(json, [3], { keys: ['title'], separator: ' / ' })
  assert.equal(text, '第一句 / 第二句')
})

test('is robust to garbage and truncated input', () => {
  assert.equal(feed('', [1]), '')
  assert.equal(feed('不是 JSON，只是普通文本', [1]), '')
  assert.equal(feed('{"spoken":', [1]), '')
  // 值被中途截断：已解码的部分照常展示，不抛错
  assert.equal(feed('{"spoken":"说到一半就断了', [1]), '说到一半就断了')
})

test('createDisplayDelta only forwards non-empty display text', () => {
  const seen = []
  const fn = createDisplayDelta((c) => seen.push(c))
  for (const chunk of chunkize(WRITER_JSON, [4])) fn(chunk)
  assert.equal(seen.join(''), '你有没有过这种时候，早上出门前找不到钥匙？\n这个挂钩一贴就好，门后空间立刻多一半。')
  // 每次透出的都必须是可展示文本，不能有空串
  assert.equal(seen.every((s) => s.length > 0), true)
})

test('createDisplayDelta returns undefined when there is no consumer', () => {
  assert.equal(createDisplayDelta(undefined), undefined)
})
