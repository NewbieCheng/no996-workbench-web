import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSocialStudioPrompt, extractUrlFromText } from './build-social-studio-prompt.ts'
import { createDefaultBrief } from './social-studio-brief-types.ts'

test('extractUrlFromText finds http link in topic', () => {
  const url = extractUrlFromText('看看这个 https://www.xiaohongshu.com/explore/abc 不错')
  assert.equal(url, 'https://www.xiaohongshu.com/explore/abc')
})

test('buildSocialStudioPrompt includes brief fields and reference block', () => {
  const brief = createDefaultBrief('xhs')
  brief.topic = '通勤好物'
  brief.audience = '打工人'
  brief.creativeRequirements = '强调性价比'
  const { user, system } = buildSocialStudioPrompt({
    platform: 'xhs',
    brief,
    contentMode: 'image_text',
    reference: {
      title: '原标题',
      content: '参考正文',
      platform: 'xiaohongshu',
      sourceUrl: 'https://example.com/note',
    },
  })
  assert.match(system, /小红书/)
  assert.match(user, /通勤好物/)
  assert.match(user, /打工人/)
  assert.match(user, /性价比/)
  assert.match(user, /参考来源内容/)
  assert.match(user, /参考正文/)
})
