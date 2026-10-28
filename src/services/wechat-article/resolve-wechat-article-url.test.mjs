import assert from 'node:assert/strict'
import test from 'node:test'
import { mapWechatDocumentToItem } from './map-wechat-document.ts'

test('mapWechatDocumentToItem uses first image as cover', () => {
  const item = mapWechatDocumentToItem(
    {
      kind: 'article',
      title: '测试标题',
      account: '测试号',
      content: '正文一段',
      images: ['https://mmbiz.qpic.cn/a.jpg', 'https://mmbiz.qpic.cn/b.jpg'],
      image_count: 2,
    },
    'https://mp.weixin.qq.com/s/demo',
  )
  assert.equal(item.platformId, 'weixin')
  assert.equal(item.coverUrl, 'https://mmbiz.qpic.cn/a.jpg')
  assert.deepEqual(item.imageUrls, [
    'https://mmbiz.qpic.cn/a.jpg',
    'https://mmbiz.qpic.cn/b.jpg',
  ])
  assert.equal(item.author, '测试号')
  assert.equal(item.likes, undefined)
  assert.equal(item.collects, undefined)
})

test('mapWechatDocumentToItem allows image-only posts', () => {
  const item = mapWechatDocumentToItem(
    {
      kind: 'image_post',
      title: '贴图',
      images: ['https://mmbiz.qpic.cn/only.jpg'],
      image_count: 1,
    },
    'https://mp.weixin.qq.com/s/img',
  )
  assert.equal(item.coverUrl, 'https://mmbiz.qpic.cn/only.jpg')
  assert.equal(item.content, undefined)
})

test('mapWechatDocumentToItem rejects empty document', () => {
  assert.throws(
    () => mapWechatDocumentToItem({ kind: 'article' }, 'https://mp.weixin.qq.com/s/x'),
    /未抓取到正文或图片/,
  )
})
