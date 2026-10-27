import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isWechatArticleUrl,
  titleFromFetchedMarkdown,
} from './wechat-article-link-parse.ts'

test('isWechatArticleUrl accepts mp.weixin.qq.com article links', () => {
  assert.equal(isWechatArticleUrl('https://mp.weixin.qq.com/s/abc'), true)
  assert.equal(isWechatArticleUrl('http://mp.weixin.qq.com/s/abc'), true)
  assert.equal(isWechatArticleUrl('https://www.xiaohongshu.com/explore/x'), false)
  assert.equal(isWechatArticleUrl('not-a-url'), false)
})

test('titleFromFetchedMarkdown prefers markdown h1', () => {
  const title = titleFromFetchedMarkdown('# 金鸡奖提名名单\n\n正文段落')
  assert.equal(title, '金鸡奖提名名单')
})
