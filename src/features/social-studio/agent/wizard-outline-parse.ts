import { parseStrictJson } from '../../../agent/parse.ts'
import type { WizardOutlinePlan, WizardImagePlan } from '../wizard/types'

type OutlinePayload = Partial<WizardOutlinePlan>

export function parseWizardOutline(raw: string, expectedImageCount?: number, requireCover = true): WizardOutlinePlan {
  const parsed = parseStrictJson<OutlinePayload>(raw, '内容大纲规划')
  const suggestedTitles = Array.isArray(parsed.suggestedTitles)
    ? parsed.suggestedTitles.map((value) => String(value ?? '').trim()).filter(Boolean).slice(0, 5)
    : []
  const hook = String(parsed.hook ?? '').trim()
  const sections = Array.isArray(parsed.sections)
    ? parsed.sections.slice(0, 8).map((section, index) => ({
        index: index + 1,
        headline: String(section?.headline ?? '').trim(),
        visualDescription: String(section?.visualDescription ?? '').trim(),
        bodyDraft: String(section?.bodyDraft ?? '').trim(),
      }))
    : []
  const conclusion = String(parsed.conclusion ?? '').trim()
  const visualStyle = String(parsed.visualStyle ?? '').trim()
  const imagePlans: WizardImagePlan[] = Array.isArray(parsed.imagePlans)
    ? parsed.imagePlans.slice(0, 8).map((plan, index) => ({
        index: index + 1,
        role: plan?.role === 'cover' ? 'cover' : 'section',
        sectionIndex: Number.isInteger(plan?.sectionIndex) ? Number(plan?.sectionIndex) : undefined,
        titleText: String(plan?.titleText ?? '').trim(),
        supportingText: String(plan?.supportingText ?? '').trim(),
        badgeText: String(plan?.badgeText ?? '').trim(),
        visualDescription: String(plan?.visualDescription ?? '').trim(),
      }))
    : []
  if (
    !suggestedTitles.length || !hook || sections.length < 3 ||
    sections.some((section) => !section.headline || !section.visualDescription || !section.bodyDraft) ||
    !conclusion || !visualStyle || imagePlans.length === 0 ||
    (Array.isArray(parsed.imagePlans) && parsed.imagePlans.some((plan) => plan?.role !== 'cover' && plan?.role !== 'section')) ||
    (expectedImageCount !== undefined && imagePlans.length !== expectedImageCount) ||
    imagePlans.filter((plan) => plan.role === 'cover').length !== (requireCover ? 1 : 0) ||
    imagePlans.some((plan) => plan.role === 'section' && (!Number.isInteger(plan.sectionIndex) || plan.sectionIndex! < 1 || plan.sectionIndex! > 3)) ||
    new Set(imagePlans.filter((plan) => plan.role === 'section').map((plan) => plan.sectionIndex)).size !== imagePlans.filter((plan) => plan.role === 'section').length ||
    imagePlans.some((plan) => !plan.titleText || !plan.visualDescription || plan.titleText.length > 32 || plan.supportingText.length > 48 || plan.badgeText.length > 12)
  ) {
    throw new Error('模型未返回完整的大纲、逐张配图文案或统一视觉风格，请重试。')
  }
  return { suggestedTitles, hook, sections, conclusion, visualStyle, imagePlans }
}
