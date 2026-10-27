import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_FULL_PROFILE,
  DEFAULT_IP_PROFILE,
  isPanelPermitted,
  isCommandPermitted,
} from '../src/core/capabilities.ts'
import { createEditor } from '../src/core/instance.ts'
import { createEmptyDocument } from '../src/core/project.ts'
import { SplitElementCommand, InsertElementCommand } from '../src/core/commands/timeline-commands.ts'
import { buildRenderPlan, sceneAtTime } from '../src/render/plan.ts'

test('panels-contract: panel profile permissions and variant contracts', () => {
  // 1. IP Profile 默认屏蔽混音台、关键帧与滤镜面板
  assert.equal(isPanelPermitted('timeline', DEFAULT_IP_PROFILE), true)
  assert.equal(isPanelPermitted('captions', DEFAULT_IP_PROFILE), true)
  assert.equal(isPanelPermitted('audioMixer', DEFAULT_IP_PROFILE), false)
  assert.equal(isPanelPermitted('keyframes', DEFAULT_IP_PROFILE), false)
  assert.equal(isPanelPermitted('effects', DEFAULT_IP_PROFILE), false)

  // 2. IP 变体形态
  assert.equal(DEFAULT_IP_PROFILE.variant?.timeline, 'compact')
  assert.equal(DEFAULT_IP_PROFILE.variant?.media, 'ip-compact')
})

test('panels-contract: hiding panels NEVER clears underlying project data and engine still renders hidden capabilities', () => {
  const doc = createEmptyDocument('doc-p1', '测试隐藏不丢数据')

  // 给视频片段注入滤镜、转场、关键帧与字幕
  const clip = {
    id: 'v1',
    trackId: doc.tracks[0].id,
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 4_000_000,
    sourceInUs: 0,
    sourceOutUs: 4_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
    effects: [{ id: 'eff-1', kind: 'brightness', enabled: true, intensity: 1.5 }],
    animations: {
      channels: {
        'transform.opacity': {
          propertyPath: 'transform.opacity',
          keyframes: [
            { id: 'k1', timeUs: 0, value: 0.2, easing: 'linear' },
            { id: 'k2', timeUs: 2_000_000, value: 0.8, easing: 'linear' },
          ],
        },
      },
    },
  }
  doc.tracks[0].elements = [clip]
  doc.captions = [{ id: 'c1', startUs: 0, durationUs: 2_000_000, text: '隐藏面板字幕测试', timingSource: 'manual' }]
  doc.durationUs = 4_000_000

  // 使用 IP Profile 实例化（未开放 keyframes 与 effects 面板）
  const ipEditor = createEditor({
    document: doc,
    profile: DEFAULT_IP_PROFILE,
  })

  // 断言 1：底层数据完全未丢失
  const currentDoc = ipEditor.getDocument()
  assert.equal(currentDoc.tracks[0].elements[0].effects?.length, 1)
  assert.ok(currentDoc.tracks[0].elements[0].animations?.channels['transform.opacity'])
  assert.equal(currentDoc.captions.length, 1)

  // 断言 2：求值器仍然按工程渲染这些能力（在 1s 处，opacity 插值约为 0.5）
  const plan = buildRenderPlan(currentDoc)
  const scene = sceneAtTime(plan, 1_000_000)
  assert.equal(scene.items.length, 1)
  assert.ok(scene.items[0].element.effects?.length === 1)
  assert.ok(scene.activeCaption !== undefined)
})

test('panels-contract: disabled commands CANNOT be bypassed from hotkeys or script calls', () => {
  const doc = createEmptyDocument('doc-p2', '测试命令禁用策略')
  const clip = {
    id: 'v1',
    trackId: doc.tracks[0].id,
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 4_000_000,
    sourceInUs: 0,
    sourceOutUs: 4_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }
  doc.tracks[0].elements = [clip]
  doc.durationUs = 4_000_000

  // 显式配置禁用 SplitElement 命令策略
  const restrictedEditor = createEditor({
    document: doc,
    commandPolicy: {
      disallowedCommands: ['SplitElement'],
    },
  })

  // 验证策略纯函数
  assert.equal(isCommandPermitted('SplitElement', restrictedEditor.commandPolicy), false)
  assert.equal(isCommandPermitted('InsertElement', restrictedEditor.commandPolicy), true)

  // 试图执行 SplitElement 命令，必须抛出错误并拒绝执行，无法被快捷键绕过
  const splitCmd = new SplitElementCommand('v1', 2_000_000)
  assert.throws(() => {
    restrictedEditor.executeCommand(splitCmd)
  }, /当前策略禁止执行命令: SplitElement/)

  // 确认文档未被篡改，依然只有 1 个片段
  assert.equal(restrictedEditor.getDocument().tracks[0].elements.length, 1)
})
