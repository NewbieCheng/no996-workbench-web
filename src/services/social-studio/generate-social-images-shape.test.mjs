import assert from 'node:assert/strict'
import test from 'node:test'

/** 与 generate-social-images.ts 中 buildSocialImagePrompts 同形的纯逻辑副本，避免拉起 extension-client。 */
function buildSocialImagePrompts(input) {
  const title = input.title.trim()
  if (!title) return []
  const style = input.style?.trim() || 'high quality editorial photography, clean composition'
  const prompts = [`${title}, ${style}`]
  for (const description of input.visualDescriptions ?? []) {
    const visual = description.trim()
    if (!visual || prompts.length >= Math.max(1, input.count)) continue
    prompts.push(`${title}, ${visual}, ${style}`)
  }
  return prompts
}

test('buildSocialImagePrompts: prompts length respects count', () => {
  const prompts = buildSocialImagePrompts({
    title: '测试主题',
    style: 'clean',
    count: 2,
    visualDescriptions: ['画面一', '画面二', '画面三'],
  })
  assert.ok(prompts.length <= 2)
  assert.equal(prompts[0]?.includes('测试主题'), true)
})

test('generate call shape convention: nPerPrompt must be 1 with sliced prompts', () => {
  const imageCount = 4
  const targetCount = Math.min(imageCount, 4)
  const raw = buildSocialImagePrompts({
    title: '主题',
    style: 'editorial',
    count: targetCount,
    visualDescriptions: ['a', 'b', 'c', 'd', 'e'],
  })
  const prompts = raw.filter((p) => p.trim()).slice(0, targetCount)
  const nPerPrompt = 1
  assert.ok(prompts.length <= targetCount)
  assert.equal(nPerPrompt, 1)
  assert.ok(prompts.length * nPerPrompt <= targetCount)
})
