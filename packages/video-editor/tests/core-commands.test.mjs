import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import {
  InsertElementCommand,
  MoveElementsCommand,
  TrimElementCommand,
  SplitElementCommand,
  DeleteElementsCommand,
  UpdateElementTransformCommand,
  UpdateCaptionsCommand,
  BatchCommand,
} from '../src/core/commands/index.ts'
import { CommandManager } from '../src/core/commands/manager.ts'

test('commands: InsertElementCommand adds element and updates duration', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const elem = {
    id: 'clip-1',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'asset-1',
    startUs: 0,
    durationUs: 3_000_000,
    sourceInUs: 0,
    sourceOutUs: 3_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 1080, height: 1920, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }

  const cmd = new InsertElementCommand('track-main-video', elem)
  const result = cmd.execute(doc)

  assert.equal(result.document.tracks[0].elements.length, 1)
  assert.equal(result.document.durationUs, 3_000_000)
  assert.deepEqual(result.selectionOverride, ['clip-1'])

  const undone = cmd.undo(result.document)
  assert.equal(undone.document.tracks[0].elements.length, 0)
  assert.equal(undone.document.durationUs, 0)
})

test('commands: SplitElementCommand cuts video cleanly into two continuous halves', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const elem = {
    id: 'clip-1',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'asset-1',
    startUs: 0,
    durationUs: 4_000_000,
    sourceInUs: 1_000_000,
    sourceOutUs: 5_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 1080, height: 1920, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }

  const insertCmd = new InsertElementCommand('track-main-video', elem)
  const inserted = insertCmd.execute(doc).document

  // 在 1.5 秒 (1_500_000 微秒) 处分割
  const splitCmd = new SplitElementCommand('clip-1', 1_500_000, 'clip-2')
  const splitRes = splitCmd.execute(inserted)
  const elements = splitRes.document.tracks[0].elements

  assert.equal(elements.length, 2)
  const left = elements[0]
  const right = elements[1]

  assert.equal(left.id, 'clip-1')
  assert.equal(left.startUs, 0)
  assert.equal(left.durationUs, 1_500_000)
  assert.equal(left.sourceInUs, 1_000_000)
  assert.equal(left.sourceOutUs, 2_500_000)

  assert.equal(right.id, 'clip-2')
  assert.equal(right.startUs, 1_500_000)
  assert.equal(right.durationUs, 2_500_000)
  assert.equal(right.sourceInUs, 2_500_000)
  assert.equal(right.sourceOutUs, 5_000_000)

  // 撤销分割，两半合并回原来完整片段
  const undone = splitCmd.undo(splitRes.document)
  const restoredElements = undone.document.tracks[0].elements
  assert.equal(restoredElements.length, 1)
  assert.equal(restoredElements[0].durationUs, 4_000_000)
  assert.equal(restoredElements[0].sourceOutUs, 5_000_000)
})

test('commands: DeleteElementsCommand with ripple shifts trailing clips', () => {
  const doc = createEmptyDocument('doc-1', '测试工程')
  const track = doc.tracks[0]

  const clip1 = {
    id: 'clip-1',
    trackId: track.id,
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 2_000_000,
    sourceInUs: 0,
    sourceOutUs: 2_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }
  const clip2 = {
    ...clip1,
    id: 'clip-2',
    startUs: 2_000_000,
    durationUs: 3_000_000,
  }

  track.elements = [clip1, clip2]
  doc.durationUs = 5_000_000

  // 波纹删除 clip1
  const deleteCmd = new DeleteElementsCommand(['clip-1'], true)
  const deletedRes = deleteCmd.execute(doc)

  const elements = deletedRes.document.tracks[0].elements
  assert.equal(elements.length, 1)
  assert.equal(elements[0].id, 'clip-2')
  assert.equal(elements[0].startUs, 0) // 前移 2 秒
  assert.equal(deletedRes.document.durationUs, 3_000_000)

  // 撤销波纹删除，恢复原来位置
  const undone = deleteCmd.undo(deletedRes.document)
  const restored = undone.document.tracks[0].elements
  assert.equal(restored.length, 2)
  assert.equal(restored.find((e) => e.id === 'clip-2')?.startUs, 2_000_000)
  assert.equal(undone.document.durationUs, 5_000_000)
})

test('commands: CommandManager undo/redo lifecycle and revision increments', () => {
  const manager = new CommandManager()
  let currentDoc = createEmptyDocument('doc-1', '测试工程')

  const elem = {
    id: 'clip-1',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'asset-1',
    startUs: 0,
    durationUs: 1_000_000,
    sourceInUs: 0,
    sourceOutUs: 1_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }

  const res1 = manager.execute(new InsertElementCommand('track-main-video', elem), currentDoc)
  currentDoc = res1.document
  assert.equal(currentDoc.revision, 2)
  assert.equal(manager.canUndo(), true)

  const undoRes = manager.undo(currentDoc)
  assert.ok(undoRes)
  currentDoc = undoRes.document
  assert.equal(currentDoc.revision, 3)
  assert.equal(currentDoc.tracks[0].elements.length, 0)
  assert.equal(manager.canRedo(), true)

  const redoRes = manager.redo(currentDoc)
  assert.ok(redoRes)
  currentDoc = redoRes.document
  assert.equal(currentDoc.revision, 4)
  assert.equal(currentDoc.tracks[0].elements.length, 1)
})
