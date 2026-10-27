import assert from 'node:assert/strict'
import test from 'node:test'
import {
  personaReadyForInjection,
  reconcilePersonaRecords,
} from './store-maintenance.ts'
import { EMPTY_USER_FORM, nowIso } from './types.ts'

function userRecord(overrides = {}) {
  return {
    id: overrides.id ?? 'a',
    kind: 'user',
    name: overrides.name ?? '个人分身 1',
    summary: '',
    content: overrides.content ?? '',
    formData: { ...EMPTY_USER_FORM, ...(overrides.formData ?? {}) },
    isActive: overrides.isActive ?? true,
    updatedAt: overrides.updatedAt ?? nowIso(),
  }
}

test('personaReadyForInjection requires saved profile body', () => {
  assert.equal(personaReadyForInjection(userRecord()), false)
  assert.equal(personaReadyForInjection(userRecord({ content: '# 档案' })), true)
})

test('reconcilePersonaRecords drops duplicate fingerprints', () => {
  const a = userRecord({
    id: '1',
    formData: { industry: '内容营销', role: '内容运营顾问' },
    updatedAt: '2026-01-01T00:00:00.000Z',
  })
  const b = userRecord({
    id: '2',
    formData: { industry: '内容营销', role: '内容运营顾问' },
    updatedAt: '2026-01-02T00:00:00.000Z',
  })
  const out = reconcilePersonaRecords([a, b])
  assert.equal(out.length, 1)
  assert.equal(out[0].id, '2')
})

test('reconcilePersonaRecords removes empty shells', () => {
  const shell = userRecord({ id: 'x', content: '', formData: { ...EMPTY_USER_FORM } })
  const real = userRecord({ id: 'y', content: '正文' })
  const out = reconcilePersonaRecords([shell, real])
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'y')
})
