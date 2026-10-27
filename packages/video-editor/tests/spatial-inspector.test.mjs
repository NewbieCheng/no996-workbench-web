import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  alignElements,
  distributeElements,
  computeProportionalSize,
} from '../src/panels/inspector/transform-math.ts'
import {
  focusToFrameAnchor,
  frameAnchorToFocus,
} from '../src/panels/inspector/frame-position.ts'
import { matchLayoutPresetFromTransform } from '../src/panels/inspector/layout-preset-match.ts'
import {
  AlignElementsCommand,
  DistributeElementsCommand,
  UpdateElementMaskCommand,
} from '../src/core/commands/spatial-commands.ts'
import { createEmptyDocument } from '../src/core/project.ts'

test('spatial-inspector: alignElements calculates correct coordinates', () => {
  const items = [
    { id: 'item-1', transform: { x: 100, y: 50, width: 200, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 } },
    { id: 'item-2', transform: { x: 400, y: 150, width: 300, height: 150, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 } },
  ]
  // 包围盒: minX=100, maxX=700 (400+300)

  // 1. 左对齐：都应该移动到 minX=100
  const leftAligned = alignElements(items, 'left')
  assert.equal(leftAligned[0].transform.x, 100)
  assert.equal(leftAligned[1].transform.x, 100)

  // 2. 右对齐：item-1 应该在 700 - 200 = 500；item-2 应该在 700 - 300 = 400
  const rightAligned = alignElements(items, 'right')
  assert.equal(rightAligned[0].transform.x, 500)
  assert.equal(rightAligned[1].transform.x, 400)

  // 3. 水平居中：中心在 100 + (600)/2 = 400。item-1 在 400 - 100 = 300；item-2 在 400 - 150 = 250
  const centerAligned = alignElements(items, 'center')
  assert.equal(centerAligned[0].transform.x, 300)
  assert.equal(centerAligned[1].transform.x, 250)
})

test('spatial-inspector: distributeElements creates uniform gaps', () => {
  const items = [
    { id: 'i1', transform: { x: 0, y: 0, width: 100, height: 50, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 } },
    { id: 'i2', transform: { x: 150, y: 0, width: 100, height: 50, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 } },
    { id: 'i3', transform: { x: 500, y: 0, width: 100, height: 50, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 } },
  ]
  // minX=0, maxX=600 (500+100). 3 elements total width = 300. Available = 300. gaps = 2 => gap = 150.
  // i1: 0, i2: 0 + 100 + 150 = 250, i3: 250 + 100 + 150 = 500

  const res = distributeElements(items, 'horizontal')
  assert.equal(res[0].transform.x, 0)
  assert.equal(res[1].transform.x, 250)
  assert.equal(res[2].transform.x, 500)
})

test('spatial-inspector: computeProportionalSize preserves aspect ratio', () => {
  const origW = 1920
  const origH = 1080 // aspect 16:9 = 1.7777...

  // 改变宽度为 960，高度应等比为 540
  const scaled = computeProportionalSize(origW, origH, 960, undefined, true)
  assert.equal(scaled.width, 960)
  assert.equal(scaled.height, 540)

  // 关闭比例锁，高度不跟随
  const unlocked = computeProportionalSize(origW, origH, 960, 300, false)
  assert.equal(unlocked.width, 960)
  assert.equal(unlocked.height, 300)
})

test('spatial-inspector: AlignElementsCommand and UpdateElementMaskCommand execute and undo', () => {
  const doc = createEmptyDocument('doc-test', '测试')
  const track = doc.tracks[0]

  const v1 = {
    id: 'v1',
    trackId: track.id,
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 3_000_000,
    sourceInUs: 0,
    sourceOutUs: 3_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 50, y: 50, width: 200, height: 200, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }
  const v2 = {
    ...v1,
    id: 'v2',
    transform: { x: 500, y: 50, width: 200, height: 200, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }

  track.elements = [v1, v2]

  // 对齐命令
  const alignCmd = new AlignElementsCommand(['v1', 'v2'], 'left')
  const alignRes = alignCmd.execute(doc)
  assert.equal(alignRes.document.tracks[0].elements[0].transform.x, 50)
  assert.equal(alignRes.document.tracks[0].elements[1].transform.x, 50)

  // 撤销对齐
  const alignUndo = alignCmd.undo(alignRes.document)
  assert.equal(alignUndo.document.tracks[0].elements[0].transform.x, 50)
  assert.equal(alignUndo.document.tracks[0].elements[1].transform.x, 500)

  // 蒙版命令
  const mask = { kind: 'circle', x: 0, y: 0, width: 100, height: 100, inverted: true, feather: 10 }
  const maskCmd = new UpdateElementMaskCommand('v1', mask)
  const maskRes = maskCmd.execute(doc)
  assert.deepEqual(maskRes.document.tracks[0].elements[0].mask, mask)

  // 撤销蒙版
  const maskUndo = maskCmd.undo(maskRes.document)
  assert.equal(maskUndo.document.tracks[0].elements[0].mask, undefined)
})

test('spatial-inspector: frame position anchor maps to normalized focus', () => {
  const { x, y } = frameAnchorToFocus('top-right')
  assert.equal(x, 1)
  assert.equal(y, 0)
  assert.equal(focusToFrameAnchor(x, y), 'top-right')
  assert.equal(focusToFrameAnchor(0.5, 0.5), 'center')
})

test('spatial-inspector: layout preset matcher recognizes fullscreen', () => {
  const transform = {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotationDeg: 0,
    opacity: 1,
    cropMode: 'cover',
    round: 0,
  }
  assert.equal(matchLayoutPresetFromTransform(transform, 1920, 1080), 'fullscreen')
})
