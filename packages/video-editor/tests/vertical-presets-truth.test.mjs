/**
 * 竖屏构图元数据的真值回归（V 阶段防线）。
 *
 * 守四件事：
 *  A. 注册表里每个镜头都在 vertical-presets.json 里有登记（漏登记 = 悄悄走默认 cover）。
 *  B. mode 只能是 cover / fit / reflow，focus 落在 0–1。
 *  C. presets 里没有注册表之外的死条目。
 *  D. 标了 reflow 的镜头，源码里必须真的读 useVideoConfig() 并做 height/width 分支，
 *     否则它拿到的是 1080×1920 画布却按 1920 布局画，成片一定被裁。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { SHOT_CATALOG } from '../src/demos/registry.generated.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const DEMOS = path.join(here, '../src/demos')
const presets = JSON.parse(readFileSync(path.join(DEMOS, 'vertical-presets.json'), 'utf8'))

const MODES = new Set(['cover', 'fit', 'reflow'])

test('每个镜头都有竖屏构图登记', () => {
  const missing = SHOT_CATALOG.filter((shot) => !presets[shot.shotId]).map((shot) => shot.shotId)
  assert.deepEqual(missing, [], `以下镜头没有竖屏登记：${missing.join('、')}`)
})

test('构图模式与焦点合法', () => {
  for (const [shotId, preset] of Object.entries(presets)) {
    assert.ok(MODES.has(preset.mode), `${shotId} 的 mode 非法：${preset.mode}`)
    assert.ok(
      Number.isFinite(preset.focusX) && preset.focusX >= 0 && preset.focusX <= 1,
      `${shotId} 的 focusX 非法：${preset.focusX}`,
    )
    assert.ok(
      Number.isFinite(preset.focusY) && preset.focusY >= 0 && preset.focusY <= 1,
      `${shotId} 的 focusY 非法：${preset.focusY}`,
    )
  }
})

test('没有注册表之外的死条目', () => {
  const known = new Set(SHOT_CATALOG.map((shot) => shot.shotId))
  const dead = Object.keys(presets).filter((shotId) => !known.has(shotId))
  assert.deepEqual(dead, [], `这些 shotId 已不在注册表里：${dead.join('、')}`)
})

test('标了 reflow 的镜头源码真的做了竖屏分支', () => {
  const broken = []
  for (const shot of SHOT_CATALOG) {
    if (presets[shot.shotId]?.mode !== 'reflow') continue
    const file = path.join(DEMOS, `${shot.importPath.replace('./', '')}.tsx`)
    const source = readFileSync(file, 'utf8')
    const usesConfig = /useVideoConfig\s*\(/.test(source)
    // 允许 `height > width`、`width < height`、`const vertical =` 三种等价写法
    const branches =
      /height\s*>\s*width/.test(source) ||
      /width\s*<\s*height/.test(source) ||
      /vertical\s*=/.test(source)
    if (!usesConfig || !branches) broken.push(shot.shotId)
  }
  assert.deepEqual(broken, [], `这些 reflow 镜头没有真的竖屏分支：${broken.join('、')}`)
})

test('横屏镜头没有被误标成 reflow（数量对得上注册表）', () => {
  const reflow = Object.values(presets).filter((preset) => preset.mode === 'reflow').length
  const registered = SHOT_CATALOG.filter((shot) => shot.vertical?.mode === 'reflow').length
  assert.equal(reflow, registered, 'json 与注册表里的 reflow 数量不一致，先跑 generate-shot-registry.mjs')
})
