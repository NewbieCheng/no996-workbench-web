import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  CONTENT_WIDTH_EDGE_BUDGET,
  CONTENT_WIDTH_POLICY_REVISION,
  migrateContentWidthPreferences,
} from './content-width-policy.ts'

const POLICY_REVISION_KEY = 'no996.wb.contentWidth.policyRevision'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => store.get(String(key)) ?? null,
    setItem: (key, val) => store.set(String(key), String(val)),
    removeItem: (key) => store.delete(String(key)),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  }
}

describe('content-width-policy', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('clears module width prefs when revision bumps', () => {
    localStorage.setItem('no996.titles.contentWidth', '900')
    localStorage.setItem('no996.persona.contentWidth', '720')
    localStorage.setItem('no996.wb.sidebar.width', '200')

    migrateContentWidthPreferences()

    assert.equal(localStorage.getItem('no996.titles.contentWidth'), null)
    assert.equal(localStorage.getItem('no996.persona.contentWidth'), null)
    assert.equal(localStorage.getItem('no996.wb.sidebar.width'), '200')
    assert.equal(
      Number(localStorage.getItem(POLICY_REVISION_KEY)),
      CONTENT_WIDTH_POLICY_REVISION,
    )
  })

  it('drops digital-human width below module minimum when revision bumps to 3', () => {
    localStorage.setItem(POLICY_REVISION_KEY, '2')
    localStorage.setItem('no996.digital-human.contentWidth', '640')
    localStorage.setItem('no996.titles.contentWidth', '900')

    migrateContentWidthPreferences()

    assert.equal(localStorage.getItem('no996.digital-human.contentWidth'), null)
    assert.equal(localStorage.getItem('no996.titles.contentWidth'), '900')
    assert.equal(Number(localStorage.getItem(POLICY_REVISION_KEY)), CONTENT_WIDTH_POLICY_REVISION)
  })

  it('is idempotent after revision is recorded', () => {
    localStorage.setItem(POLICY_REVISION_KEY, String(CONTENT_WIDTH_POLICY_REVISION))
    localStorage.setItem('no996.titles.contentWidth', '880')

    migrateContentWidthPreferences()

    assert.equal(localStorage.getItem('no996.titles.contentWidth'), '880')
  })

  it('allows full column width at max drag', () => {
    assert.equal(CONTENT_WIDTH_EDGE_BUDGET, 0)
  })
})
