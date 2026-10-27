import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  taskDrawerContext,
  taskDrawerSubject,
  truncateTaskDrawerText,
} from './task-drawer-label-core.ts'

const base = {
  id: '1',
  ownerUserId: 'u',
  status: 'succeeded',
  route: '/',
  createdAt: 0,
  payloadId: 'p',
}

describe('task-drawer-label-core', () => {
  it('persona: subject title, context subtitle', () => {
    const task = {
      ...base,
      kind: 'persona_generate',
      title: '默认分身',
      subtitle: '首次生成',
    }
    assert.equal(taskDrawerSubject(task), '默认分身')
    assert.equal(taskDrawerContext(task), '首次生成')
  })

  it('voice: subject voice label, context truncated script', () => {
    const script =
      '嗨，欢迎来到今天的运营分享。接下来我会用更好懂、更有画面感的方式，把一个实用方法讲清楚，咱们现在就开始吧。'
    const task = {
      ...base,
      kind: 'voice_tts',
      title: script,
      subtitle: '林博士声音',
    }
    assert.equal(taskDrawerSubject(task), '林博士声音')
    assert.ok(taskDrawerContext(task)?.startsWith('嗨，欢迎来到'))
    assert.ok(taskDrawerContext(task)?.endsWith('…'))
  })

  it('titles: subject title, context platform line', () => {
    const task = {
      ...base,
      kind: 'titles_generate',
      title: '秋季护肤选题',
      subtitle: '小红书 · 年轻女性',
      meta: {},
    }
    assert.equal(taskDrawerSubject(task), '秋季护肤选题')
    assert.equal(taskDrawerContext(task), '小红书 · 年轻女性')
  })

  it('truncateTaskDrawerText', () => {
    assert.equal(truncateTaskDrawerText('短'), '短')
    assert.equal(truncateTaskDrawerText('x'.repeat(50)).length, 49)
  })
})
