import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'

test('react-contract: document updates trigger listener and increment revision', () => {
  const initial = createEmptyDocument('doc-test-1', '测试工程', 'scope-1', '9:16')
  const editor = createEditor({ document: initial })

  let updateCount = 0
  const unsubscribe = editor.subscribe(() => {
    updateCount++
  })

  assert.equal(editor.getDocument().revision, 1)

  editor.updateDocument((prev) => ({
    ...prev,
    name: '重命名后的工程',
  }))

  assert.equal(updateCount, 1)
  assert.equal(editor.getDocument().name, '重命名后的工程')
  assert.equal(editor.getDocument().revision, 2)

  // 播放头调整
  editor.setPlayheadUs(3_000_000)
  assert.equal(updateCount, 2)
  assert.equal(editor.getPlayheadUs(), 3_000_000)

  // 播放状态切换
  editor.setIsPlaying(true)
  assert.equal(updateCount, 3)
  assert.equal(editor.getIsPlaying(), true)

  // 选中项设置
  editor.setSelection(['clip-1', 'clip-2'])
  assert.equal(updateCount, 4)
  assert.deepEqual(editor.getSelectedElementIds(), ['clip-1', 'clip-2'])

  unsubscribe()
  editor.dispose()
})

test('react-contract: updateDocument auto-updates updatedAt timestamp', async () => {
  const initial = createEmptyDocument('doc-test-2', '时间戳工程')
  const editor = createEditor({ document: initial })
  const firstTimestamp = editor.getDocument().updatedAt

  await new Promise((resolve) => setTimeout(resolve, 10))

  editor.updateDocument((prev) => ({
    ...prev,
    name: '新标题',
  }))

  const nextTimestamp = editor.getDocument().updatedAt
  assert.ok(nextTimestamp > firstTimestamp, 'updatedAt 必须递增')
  editor.dispose()
})
