import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import {
  AddTrackCommand,
  DeleteTrackCommand,
  ReorderTracksCommand,
  SetTrackPropertiesCommand,
  PasteElementsCommand,
  DuplicateElementsCommand,
  GroupElementsCommand,
  UngroupElementsCommand,
} from '../src/core/commands/track-commands.ts'
import { InsertElementCommand } from '../src/core/commands/timeline-commands.ts'

test('track-commands: AddTrackCommand and DeleteTrackCommand', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const initialCount = doc.tracks.length

  const newTrack = {
    id: 'track-custom-audio',
    type: 'audio',
    name: '音效轨',
    muted: false,
    solo: false,
    hidden: false,
    locked: false,
    elements: [],
  }

  const addCmd = new AddTrackCommand(newTrack)
  const addRes = addCmd.execute(doc)
  assert.equal(addRes.document.tracks.length, initialCount + 1)
  assert.equal(addRes.document.tracks[addRes.document.tracks.length - 1].id, 'track-custom-audio')

  // 撤销添加
  const undone = addCmd.undo(addRes.document)
  assert.equal(undone.document.tracks.length, initialCount)
  assert.ok(!undone.document.tracks.some((t) => t.id === 'track-custom-audio'))

  // 删除已存在的非锁定轨道
  const targetId = doc.tracks[0].id
  const delCmd = new DeleteTrackCommand(targetId)
  const delRes = delCmd.execute(doc)
  assert.equal(delRes.document.tracks.length, initialCount - 1)
  assert.ok(!delRes.document.tracks.some((t) => t.id === targetId))

  // 撤销删除，轨道恢复
  const delUndone = delCmd.undo(delRes.document)
  assert.equal(delUndone.document.tracks.length, initialCount)
  assert.equal(delUndone.document.tracks[0].id, targetId)
})

test('track-commands: DeleteTrackCommand rejects locked track', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  doc.tracks[0].locked = true

  const delCmd = new DeleteTrackCommand(doc.tracks[0].id)
  assert.throws(() => delCmd.execute(doc), /轨道已锁定/)
})

test('track-commands: ReorderTracksCommand reorders tracks and undo restores them', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const originalOrder = doc.tracks.map((t) => t.id)
  const reversedOrder = [...originalOrder].reverse()

  const reorderCmd = new ReorderTracksCommand(reversedOrder)
  const res = reorderCmd.execute(doc)
  assert.deepEqual(
    res.document.tracks.map((t) => t.id),
    reversedOrder
  )

  const undone = reorderCmd.undo(res.document)
  assert.deepEqual(
    undone.document.tracks.map((t) => t.id),
    originalOrder
  )
})

test('track-commands: ReorderTracksCommand swaps shot track with video track', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const shotTrack = doc.tracks.find((t) => t.type === 'shot')
  assert.ok(shotTrack)
  const videoId = `track-video-test`
  doc.tracks.push({
    id: videoId,
    type: 'video',
    name: '视频轨 1',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  })
  const shotIndex = doc.tracks.findIndex((t) => t.id === shotTrack.id)
  const videoIndex = doc.tracks.findIndex((t) => t.id === videoId)
  const ids = doc.tracks.map((t) => t.id)
  ids[shotIndex] = videoId
  ids[videoIndex] = shotTrack.id

  const reorderCmd = new ReorderTracksCommand(ids)
  const res = reorderCmd.execute(doc)
  assert.equal(res.document.tracks[shotIndex]?.id, videoId)
  assert.equal(res.document.tracks[videoIndex]?.id, shotTrack.id)
})

test('track-commands: SetTrackPropertiesCommand toggles mute/solo/lock', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const trackId = doc.tracks[0].id

  const propCmd = new SetTrackPropertiesCommand(trackId, {
    muted: true,
    solo: true,
    locked: true,
  })

  const res = propCmd.execute(doc)
  const modified = res.document.tracks.find((t) => t.id === trackId)
  assert.equal(modified.muted, true)
  assert.equal(modified.solo, true)
  assert.equal(modified.locked, true)

  const undone = propCmd.undo(res.document)
  const restored = undone.document.tracks.find((t) => t.id === trackId)
  assert.equal(restored.muted, false)
  assert.equal(restored.solo, undefined)
  assert.equal(restored.locked, false)
})

test('track-commands: PasteElementsCommand preserves relative offset and generates fresh IDs', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const trackId = doc.tracks[0].id

  const elem1 = {
    id: 'clip-orig-1',
    trackId,
    type: 'video',
    assetId: 'a1',
    startUs: 1_000_000,
    durationUs: 2_000_000,
    sourceInUs: 0,
    sourceOutUs: 2_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }

  const elem2 = {
    ...elem1,
    id: 'clip-orig-2',
    startUs: 4_000_000, // 相对于 elem1 偏移 3_000_000
    durationUs: 1_500_000,
  }

  // 粘贴到 10 秒 (10_000_000 us) 的位置
  const pasteCmd = new PasteElementsCommand([elem1, elem2], 10_000_000)
  const res = pasteCmd.execute(doc)

  const pastedElems = res.document.tracks[0].elements
  assert.equal(pastedElems.length, 2)
  assert.notEqual(pastedElems[0].id, 'clip-orig-1')
  assert.notEqual(pastedElems[1].id, 'clip-orig-2')

  assert.equal(pastedElems[0].startUs, 10_000_000)
  assert.equal(pastedElems[1].startUs, 13_000_000) // 保持了 3s 的相对偏移
  assert.equal(res.document.durationUs, 14_500_000)

  // 撤销粘贴
  const undone = pasteCmd.undo(res.document)
  assert.equal(undone.document.tracks[0].elements.length, 0)
})

test('track-commands: DuplicateElementsCommand clones right after source', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const track = doc.tracks[0]

  const elem1 = {
    id: 'clip-1',
    trackId: track.id,
    type: 'video',
    assetId: 'a1',
    startUs: 500_000,
    durationUs: 2_000_000,
    sourceInUs: 0,
    sourceOutUs: 2_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }
  track.elements = [elem1]

  const dupCmd = new DuplicateElementsCommand(['clip-1'])
  const res = dupCmd.execute(doc)

  const elements = res.document.tracks[0].elements
  assert.equal(elements.length, 2)
  assert.equal(elements[0].id, 'clip-1')
  assert.notEqual(elements[1].id, 'clip-1')
  assert.equal(elements[1].startUs, 2_500_000) // 500k + 2000k = 2500k
  assert.equal(elements[1].durationUs, 2_000_000)

  // 撤销
  const undone = dupCmd.undo(res.document)
  assert.equal(undone.document.tracks[0].elements.length, 1)
  assert.equal(undone.document.tracks[0].elements[0].id, 'clip-1')
})

test('track-commands: GroupElementsCommand and UngroupElementsCommand', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const track = doc.tracks[0]

  const elem1 = {
    id: 'clip-1',
    trackId: track.id,
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 1_000_000,
    sourceInUs: 0,
    sourceOutUs: 1_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }
  const elem2 = { ...elem1, id: 'clip-2', startUs: 1_000_000 }
  track.elements = [elem1, elem2]

  const groupCmd = new GroupElementsCommand(['clip-1', 'clip-2'], 'grp-shared')
  const groupRes = groupCmd.execute(doc)
  assert.equal(groupRes.document.tracks[0].elements[0].groupId, 'grp-shared')
  assert.equal(groupRes.document.tracks[0].elements[1].groupId, 'grp-shared')

  // 解组
  const ungroupCmd = new UngroupElementsCommand(['clip-1', 'clip-2'])
  const ungroupRes = ungroupCmd.execute(groupRes.document)
  assert.equal(ungroupRes.document.tracks[0].elements[0].groupId, undefined)
  assert.equal(ungroupRes.document.tracks[0].elements[1].groupId, undefined)

  // 撤销解组恢复成组
  const restoreGroup = ungroupCmd.undo(ungroupRes.document)
  assert.equal(restoreGroup.document.tracks[0].elements[0].groupId, 'grp-shared')
})
