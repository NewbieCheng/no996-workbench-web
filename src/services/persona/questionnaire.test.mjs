import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySimpleInheritForAdvanced,
  hasSimplePersonaContent,
  inheritSimpleToAdvanced,
  isQuestionnaireEmpty,
  missingRequiredQuestionnaireKeys,
  normalizeQuestionnaire,
  projectLegacyUserForm,
  questionnaireFromLegacyContent,
  questionnairePreviewFieldsForMode,
  questionnaireProgressForMode,
  REQUIRED_QUESTIONNAIRE_KEYS,
  SIMPLE_PREVIEW_KEYS,
} from './questionnaire.ts'
import { EMPTY_QUESTIONNAIRE, EMPTY_USER_FORM } from './types.ts'

test('old seven-field form is readable as a questionnaire', () => {
  const q = normalizeQuestionnaire({
    ...EMPTY_USER_FORM,
    industry: '内容营销',
    role: '顾问',
    primaryBusiness: '陪跑',
    targetClients: '老板',
    clientPainPoints: '没选题',
    desiredImage: '专业、亲切、清晰',
  })
  assert.equal(q.occupation, '顾问 · 内容营销')
  assert.equal(q.audiences, '老板')
  assert.equal(q.products, '陪跑')
  assert.equal(q.keyword1, '专业')
  assert.equal(projectLegacyUserForm(q).role, '顾问')
})

test('legacy content fills only explicit fields and synchronizes projections', () => {
  const q = questionnaireFromLegacyContent(EMPTY_USER_FORM, `# 旧人设
## 一、个人基础信息
- 职业身份：顾问
- 所属行业：餐饮
- 核心产品/服务：陪跑
- 业务特色：现场指导
## 二、目标用户画像
- 职业特征：老板
## 三、用户特征
- 现状：缺少选题
- 困扰：获客难
- 希望建立的形象：专业、亲切、清晰`)
  assert.equal(q.occupation, '顾问 · 餐饮')
  assert.equal(q.products, '陪跑')
  assert.equal(q.differentiation, '现场指导')
  assert.equal(q.clientSituations, '缺少选题')
  assert.equal(q.clientPainPoints, '获客难')
  assert.equal(q.keyword2, '亲切')
  assert.equal(q.audiences, '')
})

test('existing answers and placeholders remain untouched', () => {
  const q = questionnaireFromLegacyContent({ ...EMPTY_QUESTIONNAIRE, role: '作者', keyword2: '原有', clientSituations: '已有场景' }, `## 个人基础信息
- 职业身份：顾问
- 所属行业：待补充
## 用户特征
- 现状：新场景
- 希望建立的形象：专业、亲切、清晰`)
  assert.equal(q.role, '作者')
  assert.equal(q.industry, '作者')
  assert.equal(q.clientSituations, '已有场景')
  assert.equal(q.keyword2, '原有')
  assert.equal(q.keyword3, '清晰')
})

test('legacy industry is not hidden by a projected occupation', () => {
  const q = questionnaireFromLegacyContent({ ...EMPTY_USER_FORM, role: '厨师' }, `## 个人基础信息
- 所属行业：餐饮
- 职业身份：顾问`)
  assert.equal(q.role, '厨师')
  assert.equal(q.industry, '餐饮')
  assert.equal(q.occupation, '厨师 · 餐饮')
})

test('existing first keyword does not prevent filling later empty keywords', () => {
  const q = normalizeQuestionnaire({ ...EMPTY_QUESTIONNAIRE, keyword1: '已有', desiredImage: '专业、亲切、清晰' })
  assert.deepEqual([q.keyword1, q.keyword2, q.keyword3], ['已有', '亲切', '清晰'])
})

test('empty questionnaire is detected', () => {
  assert.equal(isQuestionnaireEmpty(EMPTY_QUESTIONNAIRE), true)
  assert.equal(isQuestionnaireEmpty(normalizeQuestionnaire({ ...EMPTY_USER_FORM, role: '顾问' })), false)
})

test('required keys include paid status and three keywords', () => {
  const missing = missingRequiredQuestionnaireKeys(EMPTY_QUESTIONNAIRE)
  assert.ok(missing.includes('publicName'))
  assert.ok(missing.includes('paidStatus'))
  assert.ok(missing.includes('keyword3'))
  assert.ok(missing.includes('accountGoals'))
})

test('inheritSimpleToAdvanced inherits seven fields into questionnaire without overriding existing values', () => {
  const simple = {
    industry: '心理咨询',
    role: '心理咨询师',
    primaryBusiness: '一对一个案咨询',
    targetClients: '职场焦虑人群',
    clientPainPoints: '情绪内耗严重',
    desiredImage: '温暖、专业、治愈',
    additionalInfo: '10年咨询经验',
  }
  const inherited = inheritSimpleToAdvanced(simple)
  assert.equal(inherited.industry, '心理咨询')
  assert.equal(inherited.role, '心理咨询师')
  assert.equal(inherited.occupation, '心理咨询师 · 心理咨询')
  assert.equal(inherited.products, '一对一个案咨询')
  assert.equal(inherited.audiences, '职场焦虑人群')
  assert.equal(inherited.clientSituations, '情绪内耗严重')
  assert.equal(inherited.keyword1, '温暖')
  assert.equal(inherited.keyword2, '专业')
  assert.equal(inherited.keyword3, '治愈')

  // 保留已填写字段
  const existing = {
    ...EMPTY_QUESTIONNAIRE,
    publicName: '张老师',
    occupation: '资深督导',
  }
  const merged = inheritSimpleToAdvanced(simple, existing)
  assert.equal(merged.publicName, '张老师')
  assert.equal(merged.occupation, '资深督导')
  assert.equal(merged.products, '一对一个案咨询')
})

test('applySimpleInheritForAdvanced fills empty advanced fields from simple and skips when simple empty', () => {
  assert.equal(hasSimplePersonaContent(EMPTY_QUESTIONNAIRE), false)
  const empty = applySimpleInheritForAdvanced(EMPTY_QUESTIONNAIRE)
  assert.equal(empty.occupation, '')

  const fromSimple = applySimpleInheritForAdvanced({
    ...EMPTY_QUESTIONNAIRE,
    industry: '内容营销',
    role: '顾问',
    primaryBusiness: '陪跑',
    targetClients: '老板',
  })
  assert.equal(hasSimplePersonaContent(fromSimple), true)
  assert.equal(fromSimple.occupation, '顾问 · 内容营销')
  assert.equal(fromSimple.products, '陪跑')
  assert.equal(fromSimple.audiences, '老板')

  const keepAdvanced = applySimpleInheritForAdvanced({
    ...fromSimple,
    occupation: '已手写高级身份',
  })
  assert.equal(keepAdvanced.occupation, '已手写高级身份')
  assert.equal(keepAdvanced.products, '陪跑')
})

test('typing publicName does not pollute occupation and allows clearing', () => {
  const form = normalizeQuestionnaire({
    ...EMPTY_QUESTIONNAIRE,
    publicName: '222222',
  })
  assert.equal(form.publicName, '222222')
  assert.equal(form.occupation, '', 'occupation must remain empty when only publicName is set')
  assert.equal(form.role, '', 'role must remain empty when only publicName is set')

  // 清空 publicName 也能正常保持为空，不会被 name 重填或删不干净
  const cleared = normalizeQuestionnaire({
    ...form,
    publicName: '',
  })
  assert.equal(cleared.publicName, '', 'clearing publicName should leave it empty')
})

test('questionnaireProgressForMode uses 7 fields for simple and 19 for advanced', () => {
  const emptySimple = questionnaireProgressForMode(EMPTY_QUESTIONNAIRE, 'simple')
  assert.equal(emptySimple.total, SIMPLE_PREVIEW_KEYS.length)
  assert.equal(emptySimple.filled, 0)

  const emptyAdvanced = questionnaireProgressForMode(EMPTY_QUESTIONNAIRE, 'advanced')
  assert.equal(emptyAdvanced.total, REQUIRED_QUESTIONNAIRE_KEYS.length)
  assert.equal(emptyAdvanced.filled, 0)

  const partial = normalizeQuestionnaire({
    ...EMPTY_USER_FORM,
    industry: '内容营销',
    role: '顾问',
    primaryBusiness: '陪跑',
  })
  const simpleProgress = questionnaireProgressForMode(partial, 'simple')
  assert.equal(simpleProgress.filled, 3)
  assert.equal(simpleProgress.total, 7)

  const advancedPartial = normalizeQuestionnaire({
    ...EMPTY_QUESTIONNAIRE,
    publicName: '小明',
    occupation: '顾问 · 内容营销',
    paidStatus: 'yes',
    accountGoals: ['consult'],
  })
  const advancedProgress = questionnaireProgressForMode(advancedPartial, 'advanced')
  assert.equal(advancedProgress.filled, 4)
  assert.equal(advancedProgress.total, 19)
})

test('questionnairePreviewFieldsForMode switches field lists by mode', () => {
  const form = normalizeQuestionnaire({
    ...EMPTY_USER_FORM,
    industry: '内容营销',
    role: '顾问',
    publicName: '小明',
    paidStatus: 'yes',
    accountGoals: ['consult', 'influence'],
  })
  const simpleFields = questionnairePreviewFieldsForMode(form, 'simple', {
    industry: '行业',
    role: '身份',
  })
  assert.equal(simpleFields.length, 7)
  assert.equal(simpleFields[0].id, 'industry')
  assert.equal(simpleFields[0].label, '行业')
  assert.equal(simpleFields[0].value, '内容营销')

  const advancedFields = questionnairePreviewFieldsForMode(form, 'advanced')
  assert.equal(advancedFields.length, 19)
  assert.ok(advancedFields.some((field) => field.id === 'publicName' && field.value === '小明'))
  assert.ok(advancedFields.some((field) => field.id === 'paidStatus' && field.value.includes('付费')))
  assert.ok(advancedFields.some((field) => field.id === 'accountGoals' && field.value.includes('咨询')))
})
