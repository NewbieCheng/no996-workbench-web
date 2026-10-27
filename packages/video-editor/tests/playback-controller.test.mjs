import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'
import { PlaybackController } from '../src/core/playback/controller.ts'

test('playback: play, pause and tick duration capping', () => {
  const doc = createEmptyDocument('doc-p', '播放测试')
  doc.durationUs = 2_000_000 // 2 秒

  const editor = createEditor({ document: doc })
  const controller = new PlaybackController({ editor })

  assert.equal(editor.getIsPlaying(), false)
  controller.play()
  assert.equal(editor.getIsPlaying(), true)

  // 手动模拟时钟步进 500ms
  controller.tick(500)
  assert.equal(editor.getPlayheadUs(), 500_000)

  // 步进超过总时长 -> 自动暂停并锁定在 2_000_000
  controller.tick(2000)
  assert.equal(editor.getPlayheadUs(), 2_000_000)
  assert.equal(editor.getIsPlaying(), false)

  controller.dispose()
  editor.dispose()
})

test('playback: concurrent seek requests ensure only latest seek wins', async () => {
  const doc = createEmptyDocument('doc-seek', 'Seek测试')
  doc.durationUs = 10_000_000

  const editor = createEditor({ document: doc })
  const controller = new PlaybackController({ editor })

  // 连续发起三个 Seek 请求
  const p1 = controller.seek(1_000_000)
  const p2 = controller.seek(5_000_000)
  const p3 = controller.seek(3_000_000) // 最终时间应该是 3 秒

  await Promise.all([p1, p2, p3])

  assert.equal(editor.getPlayheadUs(), 3_000_000)

  controller.dispose()
  editor.dispose()
})
