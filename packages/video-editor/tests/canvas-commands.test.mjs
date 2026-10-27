import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { SetCanvasRatioCommand } from '../src/core/commands/canvas-commands.ts'
import { InsertElementCommand } from '../src/core/commands/timeline-commands.ts'

test('SetCanvasRatioCommand scales transform when switching 16:9 to 9:16', () => {
  const doc = createEmptyDocument('p1', 'test', 'scope', '16:9')
  const trackId = doc.tracks[0]?.id ?? 'track-main'
  const element = {
    id: 'text-1',
    trackId,
    type: 'text',
    startUs: 0,
    durationUs: 1_000_000,
    text: 'hi',
    style: {
      font: 'sans-serif',
      size: 48,
      weight: 600,
      color: '#fff',
      backgroundColor: '',
      outlineColor: '#000',
      outlineWidth: 0,
      align: 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
    },
    transform: { x: 960, y: 540, width: 400, height: 120, rotationDeg: 0 },
  }
  const insert = new InsertElementCommand(trackId, element)
  const afterInsert = insert.execute(doc).document

  const cmd = new SetCanvasRatioCommand('9:16')
  const afterRatio = cmd.execute(afterInsert).document

  const sx = afterRatio.canvas.width / afterInsert.canvas.width
  const sy = afterRatio.canvas.height / afterInsert.canvas.height
  const scaled = afterRatio.tracks.flatMap((t) => t.elements).find((e) => e.id === 'text-1')
  assert.ok(scaled && scaled.type === 'text')
  assert.equal(scaled.transform.x, element.transform.x * sx)
  assert.equal(scaled.transform.y, element.transform.y * sy)
  assert.equal(afterRatio.canvas.ratio, '9:16')
})
