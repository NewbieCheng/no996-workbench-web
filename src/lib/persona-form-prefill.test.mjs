import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deriveScriptPrefillPatch, deriveTitlesPrefillPatch, deriveSocialStudioPrefillPatch } from './persona-form-prefill.ts'

const baseConfig = {
  mode: 'video',
  product: '测试',
  intro: '',
  durationSec: 60,
  goal: '获客',
  structure: { kind: 'auto' },
  audience: '',
  sellingPoints: '',
  pain: '',
  strength: 50,
  platform: '抖音',
  mustWords: [],
  bannedWords: [],
  interactionNodes: 3,
}

const userRecord = {
  id: 'u1',
  kind: 'user',
  name: '个人分身 1',
  summary: '',
  content: '档案',
  isActive: true,
  updatedAt: '',
  formData: {
    industry: '内容营销',
    role: '顾问',
    primaryBusiness: '帮老板做短视频获客',
    targetClients: '本地餐饮老板',
    clientPainPoints: '不会拍、没流量',
    desiredImage: '专业靠谱',
    additionalInfo: '强调案例',
  },
}

describe('persona-form-prefill', () => {
  it('maps only audience/pain into empty script config', () => {
    const { patch, filledCount } = deriveScriptPrefillPatch(userRecord, baseConfig)
    // 产品专属字段（intro / sellingPoints）不再从人设自动填：
    // 换个产品后，人设的主营业务不能冒充本次产品的介绍与卖点。
    assert.equal(filledCount, 2)
    assert.equal(patch.audience, '本地餐饮老板')
    assert.equal(patch.pain, '不会拍、没流量')
    assert.equal(patch.intro, undefined)
    assert.equal(patch.sellingPoints, undefined)
  })

  it('does not overwrite user-edited script fields', () => {
    const { patch, filledCount } = deriveScriptPrefillPatch(userRecord, {
      ...baseConfig,
      audience: '我自己写的',
      pain: '已有痛点',
    })
    assert.equal(filledCount, 0)
    assert.equal(patch.audience, undefined)
    assert.equal(patch.pain, undefined)
    assert.equal(patch.intro, undefined)
    assert.equal(patch.sellingPoints, undefined)
  })

  it('fills audience from role when targetClients empty', () => {
    const record = {
      ...userRecord,
      formData: { ...userRecord.formData, targetClients: '' },
    }
    const { patch } = deriveScriptPrefillPatch(record, baseConfig)
    assert.equal(patch.audience, '顾问（内容营销）')
  })

  it('maps user form into titles input', () => {
    const { patch, filledCount } = deriveTitlesPrefillPatch(userRecord, {
      audience: '',
      supplement: '',
    })
    assert.equal(filledCount, 2)
    assert.equal(patch.audience, '本地餐饮老板')
    assert.equal(patch.supplement, '受众困扰：不会拍、没流量')
  })

  it('company record maps target market and edge', () => {
    const company = {
      id: 'c1',
      kind: 'company',
      name: '品牌A',
      summary: '',
      content: '',
      isActive: false,
      updatedAt: '',
      formData: {
        companyName: '品牌A',
        industry: '消费',
        mainBusiness: '保温杯',
        targetMarket: '宝妈',
        competitiveEdge: '316钢',
        companyVision: '',
        additionalInfo: '',
      },
    }
    const { patch, filledCount } = deriveScriptPrefillPatch(company, baseConfig)
    assert.equal(filledCount, 1)
    assert.equal(patch.audience, '宝妈')
    assert.equal(patch.intro, undefined)
    assert.equal(patch.sellingPoints, undefined)
  })

  it('user record maps audience and referenceText to SocialStudioBrief', () => {
    const brief = {
      topic: '',
      articleType: 'guide',
      voiceTone: 'bestie',
      audience: '',
      visualAnchor: '',
      creativeRequirements: '',
      referenceText: '',
      lengthTier: 'standard',
      targetPlatform: 'xiaohongshu',
      generateCover: true,
      generateImages: true,
      imageCount: 2,
    }
    const { patch, filledCount } = deriveSocialStudioPrefillPatch(userRecord, brief)
    assert.ok(filledCount >= 2)
    assert.equal(patch.audience, '本地餐饮老板')
    assert.equal(patch.voiceTone, 'professional')
    assert.ok(patch.referenceText?.includes('帮老板做短视频获客'))
    assert.ok(patch.referenceText?.includes('不会拍、没流量'))
  })
})
