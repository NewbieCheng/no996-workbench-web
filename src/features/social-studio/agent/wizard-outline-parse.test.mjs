import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseWizardOutline } from './wizard-outline-parse.ts'

const validOutline = {
  suggestedTitles: ['标题一', '标题二', '标题三'],
  hook: '一个清晰的开篇钩子。',
  sections: [
    { headline: '第一部分', visualDescription: '桌面俯拍与步骤图示', bodyDraft: '解释核心概念。' },
    { headline: '第二部分', visualDescription: '前后对比的场景图', bodyDraft: '给出具体方法。' },
    { headline: '第三部分', visualDescription: '清单卡片与重点标注', bodyDraft: '总结注意事项。' },
  ],
  conclusion: '回顾并给出下一步。',
  visualStyle: '暖米白色调、自然光与清晰留白。',
  imagePlans: [
    { role: 'cover', titleText: '主题核心标题', supportingText: '清晰实用的简短说明', badgeText: '封面', visualDescription: '主题物件置于自然光下，底部留出文字区。' },
    { role: 'section', sectionIndex: 1, titleText: '第一步', supportingText: '对应第一部分内容', badgeText: '步骤一', visualDescription: '简洁的步骤示意画面。' },
    { role: 'section', sectionIndex: 2, titleText: '第二步', supportingText: '对应第二部分内容', badgeText: '步骤二', visualDescription: '与封面保持色调一致的对比画面。' },
  ],
}

describe('parseWizardOutline', () => {
  it('normalizes the planned outline shape and reindexes sections', () => {
    const result = parseWizardOutline(JSON.stringify(validOutline))
    assert.deepEqual(result.suggestedTitles, validOutline.suggestedTitles)
    assert.deepEqual(result.sections.map(({ index }) => index), [1, 2, 3])
    assert.equal(result.sections[0].visualDescription, '桌面俯拍与步骤图示')
    assert.equal(result.imagePlans.length, 3)
    assert.equal(result.imagePlans[2].supportingText, '对应第二部分内容')
  })

  it('rejects missing visual descriptions instead of returning a partial outline', () => {
    const invalid = structuredClone(validOutline)
    invalid.sections[1].visualDescription = ' '
    assert.throws(() => parseWizardOutline(JSON.stringify(invalid)), /完整的大纲/)
  })

  it('rejects a plan that does not cover every required image', () => {
    assert.throws(() => parseWizardOutline(JSON.stringify(validOutline), 4), /逐张配图文案/)
  })

  it('enforces a cover plus all three distinct section image plans when the template has a cover', () => {
    const incomplete = structuredClone(validOutline)
    incomplete.imagePlans[2].sectionIndex = 1
    assert.throws(() => parseWizardOutline(JSON.stringify(incomplete), 4, true), /逐张配图文案/)
  })

  it('supports a no-cover template only when all three section images are planned', () => {
    const noCover = structuredClone(validOutline)
    noCover.imagePlans = [
      { ...noCover.imagePlans[1], sectionIndex: 1 },
      { ...noCover.imagePlans[2], sectionIndex: 2 },
      { ...noCover.imagePlans[2], sectionIndex: 3, titleText: '第三步' },
    ]
    assert.equal(parseWizardOutline(JSON.stringify(noCover), 3, false).imagePlans.length, 3)
    assert.throws(() => parseWizardOutline(JSON.stringify(validOutline), 3, false), /逐张配图文案/)
  })

  it('rejects image plans with unknown roles', () => {
    const invalid = structuredClone(validOutline)
    invalid.imagePlans[0].role = 'background'
    assert.throws(() => parseWizardOutline(JSON.stringify(invalid)), /逐张配图文案/)
  })

  it('rejects malformed JSON', () => {
    assert.throws(() => parseWizardOutline('{not json'), /JSON/)
  })
})
