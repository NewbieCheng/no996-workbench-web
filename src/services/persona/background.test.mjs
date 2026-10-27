import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composePersonaBackground,
  personaInjectionParts,
  personaMenuHint,
  pickInitialPersonaId,
  positioningSummary,
} from './background.ts'

function record(over = {}) {
  return {
    id: 'p1',
    kind: 'user',
    name: '默认分身',
    summary: '内容运营顾问',
    content: '# 个人业务人设\n\n- 现状：已有业务线索\n',
    formData: {
      industry: '内容营销',
      role: '内容运营顾问',
      primaryBusiness: '为小团队提供选题梳理与内容流程咨询',
      targetClients: '刚开始做短视频的小微企业主',
      clientPainPoints: '选题乱、表达口径不统一',
      desiredImage: '专业、亲切，不夸大结果',
      additionalInfo: '',
    },
    isActive: true,
    updatedAt: '2026-10-12T00:00:00.000Z',
    ...over,
  }
}

test('定位摘要按固定顺序取有值的字段', () => {
  const s = positioningSummary(record())
  assert.equal(
    s,
    '所属行业：内容营销｜职业身份：内容运营顾问｜核心客户：刚开始做短视频的小微企业主｜主要业务：为小团队提供选题梳理与内容流程咨询｜希望被记住的词：专业、亲切，不夸大结果',
  )
})

test('定位摘要跳过空字段，不编造占位值', () => {
  const s = positioningSummary(
    record({ formData: { industry: '内容营销', role: '', primaryBusiness: '', targetClients: '' } }),
  )
  assert.equal(s, '所属行业：内容营销')
  assert.ok(!s.includes('无'))
})

test('定位摘要忽略纯空白字段', () => {
  assert.equal(positioningSummary(record({ formData: { industry: '   ' } })), '')
})

test('企业档用企业字段与标签，不串到个人档', () => {
  const s = positioningSummary(
    record({
      kind: 'company',
      formData: { companyName: '不加班科技', industry: '内容营销', mainBusiness: '账号代运营' },
    }),
  )
  assert.equal(s, '企业名称：不加班科技｜所属行业：内容营销｜主营业务：账号代运营')
  assert.ok(!s.includes('职业身份'))
})

test('没有档时摘要与背景都为空', () => {
  assert.equal(positioningSummary(null), '')
  assert.equal(composePersonaBackground(null), '')
})

test('空档返回空串 → 调用方据此完全不注入', () => {
  assert.equal(composePersonaBackground(record({ name: '', content: '   ', formData: {} })), '')
})

test('背景含身份、定位卡片与档案正文，顺序为身份→定位→正文', () => {
  const bg = composePersonaBackground(record())
  const iName = bg.indexOf('身份：默认分身')
  const iPos = bg.indexOf('所属行业：内容营销')
  const iDoc = bg.indexOf('# 个人业务人设')
  assert.ok(iName >= 0 && iPos > iName && iDoc > iPos, bg)
})

test('只有正文没有定位字段时，背景仍可用（不整段丢弃）', () => {
  const bg = composePersonaBackground(record({ name: '', formData: {} }))
  assert.equal(bg, '# 个人业务人设\n\n- 现状：已有业务线索')
})

test('只有定位字段没有正文时，背景仍可用', () => {
  const bg = composePersonaBackground(record({ name: '', content: '', formData: { industry: '内容营销' } }))
  assert.equal(bg, '所属行业：内容营销')
})

test('背景不含标签前缀「表达参考人设」，避免与提示词变量重复', () => {
  // 「表达参考人设」这一行由提示词模板负责；背景走独立 system 消息，不应再出现
  const bg = composePersonaBackground(record())
  assert.ok(!bg.includes('表达参考人设'), bg)
})

/* --------------------- 注入装配与候选选择（多档场景） --------------------- */

test('两路内容取自同一条记录：风格是正文、背景含身份与定位', () => {
  const { style, background } = personaInjectionParts(record())
  assert.equal(style, '# 个人业务人设\n\n- 现状：已有业务线索')
  assert.ok(background.includes('身份：默认分身'))
  assert.ok(background.includes('所属行业：内容营销'))
})

test('没有档时两路都为 undefined → 完全不注入', () => {
  const { style, background } = personaInjectionParts(null)
  assert.equal(style, undefined)
  assert.equal(background, undefined)
})

test('空档两路都为 undefined，不注入空白内容', () => {
  const { style, background } = personaInjectionParts(record({ name: '', content: '  ', formData: {} }))
  assert.equal(style, undefined)
  assert.equal(background, undefined)
})

test('只有定位字段时风格为空但背景仍可用', () => {
  const { style, background } = personaInjectionParts(
    record({ name: '', content: '', formData: { industry: '内容营销' } }),
  )
  assert.equal(style, undefined)
  assert.equal(background, '所属行业：内容营销')
})

test('菜单提示只取最能区分档位的两个字段，不整段塞定位卡片', () => {
  const hint = personaMenuHint(record())
  assert.equal(hint, '内容营销｜内容运营顾问')
  // 六个字段全塞进去会占满菜单，反而挑不动
  assert.ok(!hint.includes('目标客户：'), hint)
  assert.ok(!hint.includes('\n'), hint)
})

test('菜单提示缺字段时逐个跳过，不补占位值', () => {
  assert.equal(personaMenuHint(record({ formData: { role: '业务顾问' } })), '业务顾问')
  assert.equal(personaMenuHint(record({ formData: { industry: '   ', role: '业务顾问' } })), '业务顾问')
})

test('菜单提示回退顺序：字段 → summary → 名称', () => {
  assert.equal(personaMenuHint(record({ formData: {}, summary: '摘要', name: '名字' })), '摘要')
  assert.equal(personaMenuHint(record({ formData: {}, summary: '  ', name: '名字' })), '名字')
  assert.equal(personaMenuHint(null), '')
})

test('菜单提示在两种档位下各取各的字段，不串味', () => {
  const user = personaMenuHint(record())
  assert.equal(user, '内容营销｜内容运营顾问')
  const company = personaMenuHint(
    record({ kind: 'company', formData: { companyName: '某某科技', industry: '企业服务', mainBusiness: 'SaaS' } }),
  )
  assert.equal(company, '某某科技｜企业服务')
})

test('默认选中启用档', () => {
  const a = record({ id: 'a', isActive: false })
  const b = record({ id: 'b', isActive: true })
  const c = record({ id: 'c', isActive: false })
  assert.equal(pickInitialPersonaId([a, b, c]), 'b')
})

test('没有启用档时选列表第一个（仓储已按最近更新倒序）', () => {
  const recent = record({ id: 'recent', isActive: false, updatedAt: '2026-10-12T00:00:00.000Z' })
  const older = record({ id: 'older', isActive: false, updatedAt: '2026-01-01T00:00:00.000Z' })
  assert.equal(pickInitialPersonaId([recent, older]), 'recent')
})

test('空列表返回 null，不编造选中项', () => {
  assert.equal(pickInitialPersonaId([]), null)
})

test('换档后两路内容随之切换（不会出现语气是 A、身份是 B）', () => {
  const a = record({
    id: 'a',
    name: 'A 档',
    content: 'A 的正文',
    formData: { industry: 'A 行业', role: 'A 身份' },
  })
  const b = record({
    id: 'b',
    name: 'B 档',
    content: 'B 的正文',
    formData: { industry: 'B 行业', role: 'B 身份' },
  })
  for (const r of [a, b]) {
    const { style, background } = personaInjectionParts(r)
    const letter = r.id.toUpperCase()
    assert.ok(style.includes(`${letter} 的正文`))
    assert.ok(background.includes(`${letter} 行业`), background)
    assert.ok(background.includes(`${letter} 的正文`))
    // 另一档的内容绝不能串进来
    const other = r.id === 'a' ? 'B' : 'A'
    assert.ok(!background.includes(`${other} 行业`), background)
  }
})
