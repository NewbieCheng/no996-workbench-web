import type { ReportInputSnapshot } from '../../../services/product-position/types.ts'

/**
 * 资料充分性预检。
 *
 * 原型要求「程序在调用模型前判断产品核心信息是否可用」，但不允许用字数阈值冒充
 * 语义判断。这里只做可解释的规则判断：三项必填齐全，并且至少有一处说明了
 * 「产品提供什么」——第一问的回答、可读附件正文，或人设档案里的产品/交付描述。
 */

export type AdequacyResult =
  | { status: 'ok' }
  | { status: 'insufficient'; code: 'missing-basic' | 'missing-substance'; reason: string }

export function checkAdequacy(snapshot: ReportInputSnapshot): AdequacyResult {
  const product = snapshot.product
  const specs = product.specs.filter((spec) => spec.name.trim() || spec.price.trim())

  if (!product.name.trim() || !product.type.trim() || specs.length === 0) {
    return {
      status: 'insufficient',
      code: 'missing-basic',
      reason: '还缺少产品名称、类型或规格价格，先补齐这三项再开始分析。',
    }
  }

  const usage = product.answers.usage.trim()
  const readableAttachment = snapshot.attachments.some(
    (file) => file.status === 'parsed' && Boolean(file.text?.trim()),
  )
  const persona = snapshot.persona
  const personaSubstance = Boolean(
    persona &&
      [persona.questionnaire.products, persona.questionnaire.delivery, persona.content]
        .map((value) => (Array.isArray(value) ? value.join('') : String(value ?? '')))
        .some((value) => value.trim().length >= 8),
  )

  if (!usage && !readableAttachment && !personaSubstance) {
    return {
      status: 'insufficient',
      code: 'missing-substance',
      reason: '还没有说明这个产品具体提供什么：补充第 1 题，或上传可读取的产品资料。',
    }
  }

  return { status: 'ok' }
}

/** 附件解析结果的一句话摘要，用于输入页与日志。 */
export function summarizeAttachments(snapshot: ReportInputSnapshot): string {
  const parsed = snapshot.attachments.filter((file) => file.status === 'parsed').length
  const unsupported = snapshot.attachments.filter((file) => file.status === 'unsupported').length
  const failed = snapshot.attachments.filter((file) => file.status === 'failed').length
  const parts: string[] = []
  if (parsed > 0) parts.push(`${parsed} 份可读取`)
  if (unsupported > 0) parts.push(`${unsupported} 份不支持解析`)
  if (failed > 0) parts.push(`${failed} 份解析失败`)
  return parts.join(' · ') || '无附件'
}
