import assert from 'node:assert/strict'
import test from 'node:test'
import { assertValidProfileMarkdown, extractFencedMarkdown } from './profile-markdown.ts'

const validUser = `# User Profile

## 个人基础信息

- 所属行业：企业服务
- 职业身份：内容顾问
- 核心产品/服务：短视频陪跑
- 业务特色：面向本地商家做内容诊断与执行陪跑

## 目标用户画像

- 年龄段：28-45 岁经营者
- 客户单次消费水平：常见项目制服务，具体金额未提供
- 地域：服务地域未提供
- 职业特征：门店老板与运营负责人

## 用户特征

- 现状：有门店但线上内容不稳定
- 困扰：不知道每天拍什么
- 需求：获得可持续的内容流程
- 障碍：缺少时间与稳定方法`

test('valid user profile passes twelve-field validation', () => {
  assert.doesNotThrow(() => assertValidProfileMarkdown(validUser, 'user'))
})

test('missing, duplicate or reordered core fields fail', () => {
  assert.throws(() => assertValidProfileMarkdown(validUser.replace('- 职业身份：内容顾问\n', ''), 'user'))
  assert.throws(() => assertValidProfileMarkdown(validUser.replace('- 所属行业：企业服务', '- 所属行业：企业服务\n- 所属行业：企业服务'), 'user'))
  const reordered = validUser.replace('- 所属行业：企业服务\n- 职业身份：内容顾问', '- 职业身份：内容顾问\n- 所属行业：企业服务')
  assert.throws(() => assertValidProfileMarkdown(reordered, 'user'))
})

test('extra sections and too many extension fields fail', () => {
  assert.throws(() => assertValidProfileMarkdown(validUser + '\n\n## 额外章节\n\n- 字段：值', 'user'))
  const extra = validUser.replace('- 障碍：缺少时间与稳定方法', '- 障碍：缺少时间与稳定方法\n- 扩展一：a\n- 扩展二：b\n- 扩展三：c\n- 扩展四：d')
  assert.throws(() => assertValidProfileMarkdown(extra, 'user'))
})

test('fenced extraction requires the specified fence', () => {
  assert.match(extractFencedMarkdown('```userprofile\n# User Profile\n```', 'userprofile'), /# User Profile/)
  assert.throws(() => extractFencedMarkdown('```markdown\n# User Profile\n```', 'userprofile'))
})