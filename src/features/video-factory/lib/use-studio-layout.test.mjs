import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeStudioLayout,
  VF_CENTER_GUTTER,
  VF_RAIL_LEFT_EXPANDED,
  VF_RAIL_RIGHT_EXPANDED,
  VF_TRANSPORT_HEIGHT,
} from './use-studio-layout.ts'

test('computeStudioLayout: 16:9 fits height first (no horizontal letterbox in stage)', () => {
  const mainW = 1200
  const mainH = 400
  const left = VF_RAIL_LEFT_EXPANDED
  const right = VF_RAIL_RIGHT_EXPANDED
  const availH = mainH - VF_TRANSPORT_HEIGHT
  const aspect = 16 / 9
  const maxCenterW = mainW - left - right - VF_CENTER_GUTTER * 2
  const expectedW = Math.min(maxCenterW, availH * aspect)

  const result = computeStudioLayout({
    mainWidth: mainW,
    mainHeight: mainH,
    canvasWidth: 1920,
    canvasHeight: 1080,
    leftCollapsed: false,
    rightCollapsed: false,
  })

  assert.equal(result.stageWidthPx, Math.floor(expectedW))
  assert.equal(result.stageHeightPx, Math.floor(result.stageWidthPx / aspect))
})

test('computeStudioLayout: 9:16 yields narrower center stage', () => {
  const wide = computeStudioLayout({
    mainWidth: 1200,
    mainHeight: 500,
    canvasWidth: 1920,
    canvasHeight: 1080,
    leftCollapsed: false,
    rightCollapsed: false,
  })
  const tall = computeStudioLayout({
    mainWidth: 1200,
    mainHeight: 500,
    canvasWidth: 1080,
    canvasHeight: 1920,
    leftCollapsed: false,
    rightCollapsed: false,
  })
  assert.ok(tall.stageWidthPx < wide.stageWidthPx)
})

test('computeStudioLayout: 竖屏时侧栏吃掉主区剩余宽度', () => {
  const mainW = 1290
  const mainH = 423
  const result = computeStudioLayout({
    mainWidth: mainW,
    mainHeight: mainH,
    canvasWidth: 1080,
    canvasHeight: 1920,
    leftCollapsed: false,
    rightCollapsed: false,
  })
  const left = Number.parseFloat(result.cssVars['--vf-rail-left'])
  const right = Number.parseFloat(result.cssVars['--vf-rail-right'])
  const stage = result.stageWidthPx
  const total = left + right + stage + VF_CENTER_GUTTER * 2
  assert.equal(total, mainW)
  assert.ok(left > VF_RAIL_LEFT_EXPANDED)
  assert.ok(right > VF_RAIL_RIGHT_EXPANDED)
})
