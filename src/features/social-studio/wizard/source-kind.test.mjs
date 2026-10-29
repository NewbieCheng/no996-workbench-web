import assert from 'node:assert/strict'
import test from 'node:test'
import { classifySocialSource, supportsImageTemplate } from './source-kind.ts'

test('图文笔记可以直接套模板', () => {
  const kind = classifySocialSource({
    platformId: 'xiaohongshu',
    imageUrls: ['https://example.com/1.jpg'],
    collectedAt: 1,
  })
  assert.equal(kind, 'image_text')
  assert.equal(supportsImageTemplate(kind), true)
})

test('视频笔记即使带封图也不能套图文模板', () => {
  const kind = classifySocialSource({
    platformId: 'xiaohongshu',
    playUrl: 'https://example.com/video.mp4',
    imageUrls: ['https://example.com/cover.jpg'],
    collectedAt: 1,
  })
  assert.equal(kind, 'video')
  assert.equal(supportsImageTemplate(kind), false)
})

test('只有正文的素材走纯文本，而不是强行配图', () => {
  const kind = classifySocialSource({
    platformId: 'xiaohongshu',
    content: '这是一篇纯文字笔记',
    collectedAt: 1,
  })
  assert.equal(kind, 'text_only')
  assert.equal(supportsImageTemplate(kind), false)
})

test('插件回传 noteType 时优先采用，不被封面图误导', () => {
  const kind = classifySocialSource({
    platformId: 'xiaohongshu',
    noteType: 'video',
    imageUrls: ['https://example.com/cover.jpg'],
    collectedAt: 1,
  })
  assert.equal(kind, 'video')
})

test('公众号文章按文章处理', () => {
  const kind = classifySocialSource({
    platformId: 'weixin',
    content: '文章正文',
    collectedAt: 1,
  })
  assert.equal(kind, 'article')
  assert.equal(supportsImageTemplate(kind), true)
})
