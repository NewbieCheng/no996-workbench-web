import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'
import { isPanelPermitted, isCommandPermitted, DEFAULT_IP_PROFILE, DEFAULT_FULL_PROFILE } from '../src/core/capabilities.ts'

test('instance: multiple editors operate independently', () => {
  const doc1 = createEmptyDocument('doc-1', '工程一')
  const doc2 = createEmptyDocument('doc-2', '工程二')

  const editor1 = createEditor({ document: doc1 })
  const editor2 = createEditor({ document: doc2 })

  assert.notEqual(editor1.id, editor2.id)

  editor1.setPlayheadUs(1_000_000)
  editor2.setPlayheadUs(5_000_000)

  assert.equal(editor1.getPlayheadUs(), 1_000_000)
  assert.equal(editor2.getPlayheadUs(), 5_000_000)

  editor1.setSelection(['clip-a'])
  editor2.setSelection(['clip-b', 'clip-c'])

  assert.deepEqual(editor1.getSelectedElementIds(), ['clip-a'])
  assert.deepEqual(editor2.getSelectedElementIds(), ['clip-b', 'clip-c'])

  editor1.dispose()
  editor2.dispose()
})

test('capabilities: IP profile restricts panel list without modifying underlying capabilities', () => {
  // IP 专属配置只开放口播必要面板
  assert.equal(isPanelPermitted('media', DEFAULT_IP_PROFILE), true)
  assert.equal(isPanelPermitted('canvas', DEFAULT_IP_PROFILE), true)
  assert.equal(isPanelPermitted('timeline', DEFAULT_IP_PROFILE), true)
  assert.equal(isPanelPermitted('captions', DEFAULT_IP_PROFILE), true)
  assert.equal(isPanelPermitted('export', DEFAULT_IP_PROFILE), true)

  // 默认屏蔽高级曲线与全功能混音台面板
  assert.equal(isPanelPermitted('keyframes', DEFAULT_IP_PROFILE), false)
  assert.equal(isPanelPermitted('audioMixer', DEFAULT_IP_PROFILE), false)
  assert.equal(isPanelPermitted('effects', DEFAULT_IP_PROFILE), false)

  // 完整专业配置全部开放
  assert.equal(isPanelPermitted('keyframes', DEFAULT_FULL_PROFILE), true)
  assert.equal(isPanelPermitted('audioMixer', DEFAULT_FULL_PROFILE), true)
  assert.equal(isPanelPermitted('effects', DEFAULT_FULL_PROFILE), true)
})

test('capabilities: command permission check obeys policy', () => {
  const policy = {
    allowedCommands: ['InsertElement', 'TrimElement', 'SplitElement'],
    disallowedCommands: ['DeleteTrack'],
  }

  assert.equal(isCommandPermitted('TrimElement', policy), true)
  assert.equal(isCommandPermitted('DeleteTrack', policy), false)
  assert.equal(isCommandPermitted('UnknownCommand', policy), false)
})
