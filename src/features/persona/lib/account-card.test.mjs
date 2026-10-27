import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertValidAccountCardMarkdown,
  composeMainProfile,
  fieldValue,
  parseAccountCard,
  parseMainProfile,
  migrateLegacyProfile,
  patchMainProfileModule,
} from './account-card.ts'

const candidates = `# 人设定位 Profile

## 一、人物优势

- 真实优势：十年餐饮代运营实操
- 可放大的竞争力：能把门店团购做成可复制流程

## 二、目标人群与需求

- 核心客户：本地餐饮老板
- 典型场景：想做短视频却不知道拍什么
- 三大痛点：没选题、没人手、转化不稳
- 当前替代方案及其不足：找剪辑师只能出片不能获客
- 购买动机：希望有稳定到店线索

## 三、3 套人设定位方案

### 定位方案 A：专业权威型

- 基础身份：餐饮短视频陪跑顾问
- 核心优势：从选题到投放的完整交付
- 精准用户：有门店、愿意付费优化获客的老板
- 核心需求：把内容变成到店订单
- 细分赛道：本地生活团购内容
- 差异化价值：按周复盘而不是一次性剪辑
- 可信背书：陪跑过十余家本地餐饮
- 产品承接：陪跑套餐与单店诊断
- 一句话专业定位：帮餐饮老板把短视频做成到店系统
- 三个人格标签：务实、清晰、可核对
- 一句记忆点表达：先把到店跑通，再谈爆款

### 定位方案 B：垂直细分型

- 基础身份：团购短视频教练
- 核心优势：熟悉团购链路
- 精准用户：刚上线团购的新店
- 核心需求：尽快跑出第一单
- 细分赛道：新店冷启动
- 差异化价值：用门店真实场景代替摆拍
- 可信背书：自己做过冷启动案例
- 产品承接：冷启动陪跑
- 一句话专业定位：专门帮新店跑通团购内容
- 三个人格标签：细、稳、落地
- 一句记忆点表达：新店也能按周出片

### 定位方案 C：实战差异化型

- 基础身份：门店内容操盘手
- 核心优势：现场指导拍摄
- 精准用户：人手少的夫妻店
- 核心需求：老板自己也能拍
- 细分赛道：超小团队内容
- 差异化价值：给话术和机位而不是空概念
- 可信背书：现场陪拍记录
- 产品承接：到店陪拍日
- 一句话专业定位：让老板自己拍也能获客
- 三个人格标签：陪跑、直给、好学
- 一句记忆点表达：手机就能拍，拍完就能发

## 四、3 套账号包装建议

### 专业型

- 账号昵称建议：店长获客课
- 账号简介：帮餐饮老板把短视频做成到店系统。
- 置顶内容主题：一周内容排期方法

### 亲和型

- 账号昵称建议：小店拍拍陪跑
- 账号简介：和老板一起把今天该拍的拍完。
- 置顶内容主题：夫妻店也能拍的三条日常

### 差异化型

- 账号昵称建议：先到店再爆款
- 账号简介：不谈虚的播放量，只核对到店。
- 置顶内容主题：到店线索复盘

## 五、禁止事项与表达红线

- 人设红线：不能暗示未有的专家认证
- 内容红线：不能承诺具体营收数字
- 风格红线：不贩卖焦虑、不攻击同行
`

test('parses candidate account card and composes selected main profile', () => {
  const parsed = parseAccountCard(candidates)
  assert.ok(parsed)
  assertValidAccountCardMarkdown(candidates)
  const main = composeMainProfile(parsed, 'A', 'warm')
  assert.match(main, /方案 A：专业权威型/)
  assert.match(main, /账号包装建议｜亲和型/)
  assert.doesNotMatch(main, /定位方案 B/)
  assert.doesNotMatch(main, /差异化型/)
  assert.equal(fieldValue(parsed.positioning.A, '一句话专业定位'), '帮餐饮老板把短视频做成到店系统')
})

test('patching one module leaves other modules intact', () => {
  const parsed = parseAccountCard(candidates)
  const main = composeMainProfile(parsed, 'B', 'professional')
  const next = patchMainProfileModule(main, 'redlines', [
    { label: '人设红线', value: '不能虚构学历' },
    { label: '内容红线', value: '不能承诺疗效' },
    { label: '风格红线', value: '不说教' },
  ])
  assert.match(next, /不能虚构学历/)
  assert.match(next, /方案 B：垂直细分型/)
  assert.match(next, /账号包装建议｜专业型/)
})

test('legacy profile is not treated as an empty account card', () => {
  const legacy = '# User Profile\n\n## 个人基础信息\n- 所属行业：餐饮\n- 职业身份：厨师\n\n## 目标用户画像\n- 年龄段：30岁以上\n\n## 用户特征\n- 困扰：不知道如何做菜'
  assert.equal(parseMainProfile(legacy), null)
  assert.equal(patchMainProfileModule(legacy, 'advantages', [{ label: '真实优势', value: '测试' }]), legacy)
  const main = composeMainProfile(parseAccountCard(candidates), 'A', 'warm')
  assert.ok(parseMainProfile(main))
})

test('maps legacy user data into editable account-card fields without inventing missing content', () => {
  const legacy = `# User Profile

## 个人基础信息
- 所属行业：内容创作与营销
- 职业身份：市场营销人员
- 核心产品/服务：营销推广与品牌经营
- 业务特色：提供内容策划与推广支持

## 目标用户画像
- 年龄段：具体年龄未提供
- 客户单次消费水平：具体金额未提供
- 地域：服务地域未提供
- 职业特征：市场与运营团队

## 用户特征
- 现状：人手有限
- 困扰：获客难、转化低
- 需求：改善获客效率
- 障碍：投入回报不确定
- 希望建立的形象：有创意、有辨识度
- 其他内容：保留在原文中`
  const converted = migrateLegacyProfile(legacy)
  assert.ok(converted)
  const parsed = parseMainProfile(converted)
  assert.ok(parsed)
  assert.equal(fieldValue(parsed.positioning, '基础身份'), '市场营销人员；内容创作与营销')
  assert.equal(fieldValue(parsed.audience, '三大痛点'), '获客难、转化低')
  assert.equal(fieldValue(parsed.packaging, '账号简介'), '待补充')
  assert.equal(fieldValue(parsed.redlines, '人设红线'), '待补充')
  assert.equal(migrateLegacyProfile(converted), null)
  assert.equal(migrateLegacyProfile('# Other\n\n## 个人基础信息\n- 职业身份：厨师'), null)
  assert.match(patchMainProfileModule(converted, 'redlines', [{ label: '人设红线', value: '不夸大' }]), /获客难、转化低/)
})

test('module edit preserves unknown fields, sections and multiline values', () => {
  const main = `${composeMainProfile(parseAccountCard(candidates), 'A', 'warm')}\n\n## 附加资料\n原始内容不应删除\n`
    .replace('- 人设红线：不能暗示未有的专家认证', '- 人设红线：原值\n- 自定义要求：保留此项')
  const next = patchMainProfileModule(main, 'redlines', [{ label: '人设红线', value: '第一行\n第二行' }])
  assert.match(next, /自定义要求：保留此项/)
  assert.match(next, /## 附加资料\n原始内容不应删除/)
  assert.equal(fieldValue(parseMainProfile(next).redlines, '人设红线'), '第一行\n第二行')
})

test('source or status labels fail validation', () => {
  assert.throws(() =>
    assertValidAccountCardMarkdown(candidates.replace('- 核心客户：本地餐饮老板', '- 核心客户：本地餐饮老板\n- 来源：用户观察')),
  )
})
