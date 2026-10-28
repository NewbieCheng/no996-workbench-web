/**
 * 提交前的资料完整性检查（纯函数，不调用模型）。
 *
 * 目的：缺少关键事实时**不发起模型调用**，在向导里列出待补字段。
 * 之前只校验产品名，模型拿不到事实就只能编——这也是视频脚本被诟病
 * 「空泛」的根源之一。
 */
import type { ScriptConfig } from '../agent/types'
import { materialsForPurpose, purposeById } from '../agent/purposes/index.ts'

export type ReadinessIssue = {
  /** 缺项所在的字段/素材 key */
  field: string
  label: string
  /** 给用户看的说明 */
  reason: string
  /** 该缺项在哪一步补：1 = 规格与结构，2 = 补细节 */
  step: 1 | 2
}

/** 检查并返回全部缺项；空数组表示可以提交 */
export function checkScriptReadiness(config: ScriptConfig): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  if (!config.product.trim()) {
    issues.push({ field: 'product', label: '产品或主题', reason: '请先填写要写的内容主题', step: 1 })
  }

  // 直播沿用原有规则：产品名 + 目标即可，不做素材强校验。
  if (config.mode === 'live') return issues

  const purpose = purposeById(config.purpose)
  if (!purpose) {
    issues.push({
      field: 'purpose',
      label: '创作目的',
      reason: '请先选择创作目的（获客 / 人设 / 观点·干货 / 转化）',
      step: 1,
    })
  }

  const structureReady =
    config.structure.kind === 'custom'
      ? Boolean(config.structure.text?.trim())
      : config.structure.kind === 'preset' && Boolean(config.structure.presetId)
  if (!structureReady) {
    issues.push({
      field: 'structure',
      label: '叙事结构',
      reason: purpose ? `请从「${purpose.label}」下选择一套叙事结构` : '请选择一套叙事结构',
      step: 1,
    })
  }

  for (const field of materialsForPurpose(config.purpose)) {
    if (!field.required) continue
    const value = config.materials?.[field.key]?.trim()
    if (value) continue
    issues.push({
      field: `materials.${field.key}`,
      label: field.label,
      reason: `缺少「${field.label}」：模型不能替你编，请补充后再生成`,
      step: 2,
    })
  }

  return issues
}

/** 一句话摘要，用于按钮下方的提示 */
export function readinessSummary(issues: ReadinessIssue[]): string {
  if (!issues.length) return ''
  return `还缺 ${issues.length} 项：${issues.map((issue) => issue.label).join('、')}`
}
