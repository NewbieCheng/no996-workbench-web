import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEditor } from '../src/core/instance.ts'
import { createEmptyDocument } from '../src/core/project.ts'
import {
  applyVideoAssemblyPlan,
  prepareVideoAssemblyPlan,
  validateVideoAssemblyPlan,
  VideoAssemblyPlanError,
} from '../src/core/assembly/index.ts'

function makePlan(document, overrides = {}) {
  return {
    version: 1,
    planId: 'knowledge-plan-1',
    documentId: document.id,
    baseRevision: document.revision,
    styleId: 'style.knowledge-editorial',
    scenes: [
      {
        id: 'scene-opening',
        startUs: 0,
        durationUs: 3_000_000,
        layoutId: 'layout.type-led',
        components: [
          {
            id: 'opening-title',
            componentId: 'title.opening',
            startOffsetUs: 0,
            durationUs: 1_500_000,
            text: '三个步骤做好口播视频',
            motionId: 'motion.fade-in',
          },
          {
            id: 'steps-card',
            componentId: 'info.steps',
            startOffsetUs: 500_000,
            durationUs: 2_000_000,
            title: '执行步骤',
            items: ['先写清主题', '选择画面组件'],
            motionId: 'motion.step-focus',
          },
          {
            id: 'caption-one',
            componentId: 'caption.sentence',
            startOffsetUs: 300_000,
            durationUs: 900_000,
            text: '这是用户提供的口播字幕。',
            timingSource: 'estimated',
          },
        ],
      },
    ],
    ...overrides,
  }
}

function codeOf(fn) {
  assert.throws(fn, (error) => error instanceof VideoAssemblyPlanError && Boolean(error.code))
}

test('assembly: registry-only plan compiles native text and subtitle data without running code', () => {
  const doc = createEmptyDocument('video-project', '口播工程', 'user-1')
  const plan = makePlan(doc)
  const validated = validateVideoAssemblyPlan(plan)
  const prepared = prepareVideoAssemblyPlan(doc, validated)

  assert.equal(prepared.summary.sceneCount, 1)
  assert.equal(prepared.summary.componentCount, 3)
  assert.equal(prepared.summary.textElementCount, 4)
  assert.equal(prepared.summary.captionCount, 1)
  assert.equal(doc.tracks[3].elements.length, 0)
  assert.equal(doc.captions.length, 0)

  const candidateText = prepared.previewDocument.tracks[3].elements
  assert.equal(candidateText.length, 4)
  assert.equal(candidateText[0].type, 'text')
  assert.equal(candidateText[0].text, '三个步骤做好口播视频')
  assert.equal(candidateText[0].animations.channels['transform.opacity'].propertyPath, 'transform.opacity')
  assert.equal(prepared.previewDocument.groups['assembly:video-project:steps-card'].elementIds.length, 3)
  assert.equal(prepared.previewDocument.captions[0].timingSource, 'estimated')
  assert.equal(prepared.previewDocument.captionStyle.size, doc.captionStyle.size)

  // 验证 info.steps 标题与行坐标绝对递增，不落在同一 y
  const stepElements = candidateText.slice(1, 4)
  assert.equal(stepElements.length, 3)
  const y0 = stepElements[0].transform.y
  const y1 = stepElements[1].transform.y
  const y2 = stepElements[2].transform.y
  assert.ok(y1 > y0, `第 1 行坐标 y1 (${y1}) 必须严格大于标题 y0 (${y0})`)
  assert.ok(y2 > y1, `第 2 行坐标 y2 (${y2}) 必须严格大于第 1 行 y1 (${y1})`)
})

test('assembly: apply uses one undoable command and undo/redo preserve the generated project state', () => {
  const doc = createEmptyDocument('video-project', '口播工程', 'user-1')
  const editor = createEditor({ document: doc })
  const prepared = prepareVideoAssemblyPlan(editor.getDocument(), makePlan(doc))

  const applied = applyVideoAssemblyPlan(editor, prepared)
  assert.equal(applied.document.revision, 2)
  assert.equal(editor.getDocument().tracks[3].elements.length, 4)
  assert.equal(editor.getDocument().captions.length, 1)
  assert.equal(editor.canUndo(), true)

  const undone = editor.undo()
  assert.ok(undone)
  assert.equal(editor.getDocument().tracks[3].elements.length, 0)
  assert.equal(editor.getDocument().captions.length, 0)
  assert.equal(editor.getDocument().groups['assembly:video-project:steps-card'], undefined)

  assert.ok(editor.redo())
  assert.equal(editor.getDocument().tracks[3].elements.length, 4)
  assert.equal(editor.getDocument().captions.length, 1)
  editor.dispose()
})

test('assembly: stale revision and command policy reject without changing the editor', () => {
  const doc = createEmptyDocument('video-project', '口播工程', 'user-1')
  const editor = createEditor({ document: doc })
  const prepared = prepareVideoAssemblyPlan(editor.getDocument(), makePlan(doc))
  // Emulate a concurrent edit between preview and apply.
  editor.setDocument({ ...editor.getDocument(), revision: editor.getDocument().revision + 1 })
  const beforeApply = editor.getDocument()
  codeOf(() => applyVideoAssemblyPlan(editor, prepared))
  assert.equal(editor.getDocument(), beforeApply)
  editor.dispose()

  const blocked = createEditor({ document: doc, commandPolicy: { disallowedCommands: ['ApplyVideoAssemblyPlan'] } })
  const blockedPrepared = prepareVideoAssemblyPlan(blocked.getDocument(), makePlan(doc))
  assert.throws(
    () => applyVideoAssemblyPlan(blocked, blockedPrepared),
    /当前策略禁止执行命令/,
  )
  assert.equal(blocked.getDocument().tracks[3].elements.length, 0)
  blocked.dispose()
})

test('assembly: rejects executable/unknown fields, unknown IDs, free-form styles, and invalid timing', () => {
  const doc = createEmptyDocument('video-project', '口播工程')
  const unknownField = makePlan(doc)
  unknownField.scenes[0].components[0].code = 'alert(1)'
  codeOf(() => validateVideoAssemblyPlan(unknownField))

  const unknownComponent = makePlan(doc)
  unknownComponent.scenes[0].components[0].componentId = 'user-provided-module'
  codeOf(() => validateVideoAssemblyPlan(unknownComponent))

  const freeFormStyle = makePlan(doc)
  freeFormStyle.color = 'url(https://example.invalid)'
  codeOf(() => validateVideoAssemblyPlan(freeFormStyle))

  const badDuration = makePlan(doc)
  badDuration.scenes[0].components[0].durationUs = Number.MAX_SAFE_INTEGER
  codeOf(() => validateVideoAssemblyPlan(badDuration))

  const multiline = makePlan(doc)
  multiline.scenes[0].components[0].text = 'title\n<script>'
  codeOf(() => validateVideoAssemblyPlan(multiline))
})

test('assembly: rejects oversized JSON, overlapping scenes, unsupported layouts, and fabricated chart IDs', () => {
  const doc = createEmptyDocument('video-project', '口播工程')
  const oversized = JSON.stringify({ payload: 'x'.repeat(70_000) })
  codeOf(() => validateVideoAssemblyPlan(oversized))

  const overlap = makePlan(doc)
  overlap.scenes.push({ ...overlap.scenes[0], id: 'scene-two', startUs: 1_000_000 })
  codeOf(() => validateVideoAssemblyPlan(overlap))

  const layout = makePlan(doc)
  layout.scenes[0].layoutId = 'layout.some-new-code'
  codeOf(() => validateVideoAssemblyPlan(layout))

  const chart = makePlan(doc)
  chart.scenes[0].components[0].componentId = 'chart.fabricated-nonexistent'
  codeOf(() => validateVideoAssemblyPlan(chart))
})

test('assembly: preparation is bound to a document identity/revision and cannot be forged', () => {
  const doc = createEmptyDocument('video-project', '口播工程')
  const other = createEmptyDocument('other-project', '另一个工程')
  codeOf(() => prepareVideoAssemblyPlan(other, makePlan(doc)))

  const editor = createEditor({ document: doc })
  const prepared = prepareVideoAssemblyPlan(editor.getDocument(), makePlan(doc))
  const forged = { ...prepared }
  codeOf(() => applyVideoAssemblyPlan(editor, forged))
  assert.equal(editor.getDocument().tracks[3].elements.length, 0)
  editor.dispose()
})
