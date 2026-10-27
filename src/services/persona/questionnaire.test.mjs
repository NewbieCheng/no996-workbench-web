import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isQuestionnaireEmpty,
  missingRequiredQuestionnaireKeys,
  normalizeQuestionnaire,
  projectLegacyUserForm,
  questionnaireFromLegacyContent,
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
