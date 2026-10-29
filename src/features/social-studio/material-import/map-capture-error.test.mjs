import assert from 'node:assert/strict'
import test from 'node:test'
import { mapCaptureErrorMessage } from './map-capture-error.ts'

test('mapCaptureErrorMessage: 已观察响应 empty page is not extension-missing', () => {
  const out = mapCaptureErrorMessage(
    '关键词抓取失败：当前页面没有可用的已观察响应或可见字段；请等待页面加载完成、手动完成对应搜索/打开详情后重试。',
  )
  assert.match(out, /小红书页面尚未就绪/)
  assert.doesNotMatch(out, /未检测到知源扩展/)
})

test('mapCaptureErrorMessage: search timeout is distinct from extension missing', () => {
  const out = mapCaptureErrorMessage('等待插件响应超时，请确认是否已安装并启用知源扩展')
  assert.match(out, /小红书采集等待超时/)
  assert.doesNotMatch(out, /未检测到知源扩展/)
})

test('mapCaptureErrorMessage: explicit extension connection failure shows install hint', () => {
  const out = mapCaptureErrorMessage('请确认是否已安装并启用知源扩展')
  assert.match(out, /未检测到知源扩展/)
})

test('mapCaptureErrorMessage: login mapped', () => {
  const out = mapCaptureErrorMessage('关键词抓取失败：请先登录小红书')
  assert.match(out, /登录/)
})
