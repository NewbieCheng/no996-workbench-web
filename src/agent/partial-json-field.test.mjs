import assert from 'node:assert/strict'
import test from 'node:test'
import { extractPartialFirstArrayString, extractPartialJsonField } from './partial-json-field.ts'

test('从完整 JSON 里取字符串字段', () => {
  assert.equal(extractPartialJsonField('{"hook":"先别急着换工具"}', 'hook'), '先别急着换工具')
})

test('流式截断时返回已经拿到的半截文本', () => {
  assert.equal(extractPartialJsonField('{"hook":"先别急着', 'hook'), '先别急着')
})

test('转义引号与换行不会漏出 JSON 语法', () => {
  assert.equal(
    extractPartialJsonField('{"hook":"第一行\\n他说\\"别急\\""}', 'hook'),
    '第一行\n他说"别急"',
  )
})

test('取数组第一个字符串，适合候选标题的早期反馈', () => {
  assert.equal(
    extractPartialFirstArrayString('{"suggestedTitles":["标题一","标题二"]}', 'suggestedTitles'),
    '标题一',
  )
  assert.equal(
    extractPartialFirstArrayString('{"suggestedTitles":["标题一', 'suggestedTitles'),
    '标题一',
  )
})

test('字段不存在时返回空串，不抛错', () => {
  assert.equal(extractPartialJsonField('', 'hook'), '')
  assert.equal(extractPartialJsonField('{"other":1}', 'hook'), '')
  assert.equal(extractPartialFirstArrayString('{}', 'suggestedTitles'), '')
})
