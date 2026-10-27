import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePlannerStreamContent, parsePlannerStreamTitle } from './parse-planner-stream.ts'

describe('parsePlannerStreamContent', () => {
  it('parses complete JSON', () => {
    const raw = JSON.stringify({
      title: '口播',
      segments: [
        { id: 'seg_1', title: '开场', text: '你好', instruction: '沉稳' },
        { id: 'seg_2', title: '卖点', text: '好用', instruction: '轻快' },
      ],
    })
    const segs = parsePlannerStreamContent(raw)
    assert.equal(segs.length, 2)
    assert.equal(segs[0].title, '开场')
    assert.equal(segs[1].text, '好用')
    assert.equal(segs[0].partial, undefined)
  })

  it('extracts complete objects from partial stream', () => {
    const part =
      '{"title":"x","segments":[{"id":"seg_1","title":"A","text":"第一句","instruction":"自然"},{"id":"seg_2","title":"B","text":"第二'
    const segs = parsePlannerStreamContent(part)
    assert.equal(segs.length, 2)
    assert.equal(segs[0].text, '第一句')
    assert.equal(segs[1].partial, true)
    assert.ok(segs[1].text.length >= 1)
  })

  it('shows title placeholder before segments array appears', () => {
    const part = '{"title":"数字时代的人文精神","segments":'
    const title = parsePlannerStreamTitle(part)
    assert.equal(title, '数字时代的人文精神')
    const segs = parsePlannerStreamContent(part)
    assert.equal(segs.length, 1)
    assert.equal(segs[0].partial, true)
    assert.match(segs[0].text, /生成中/)
  })

  it('returns empty for non-json', () => {
    assert.deepEqual(parsePlannerStreamContent(''), [])
    assert.deepEqual(parsePlannerStreamContent('not json'), [])
  })
})
