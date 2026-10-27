import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveVideoFactoryToastKind } from './page-notice-kind.ts'

test('resolveVideoFactoryToastKind', () => {
  assert.equal(resolveVideoFactoryToastKind('先在时间轴上放一段音乐，再检测节拍'), 'warning')
  assert.equal(resolveVideoFactoryToastKind('已从 IP 口播视频导入镜头与音频'), 'success')
  assert.equal(resolveVideoFactoryToastKind('导入口播工程失败'), 'error')
  assert.equal(resolveVideoFactoryToastKind('正在检测节拍…'), 'info')
})
