/**
 * 四类创作目的注册表。
 *
 * 页面、流程、提示词都从这里取数据，避免「UI 一套、提示词一套」。
 * 旧目标 流量 / 成交 不在这里：它们只用于历史展示；
 * 成交 继续生成时由调用方映射成转化型并明示。
 */
import { ACQUISITION_PURPOSE } from './acquisition.ts'
import { PERSONA_PURPOSE } from './persona.ts'
import { OPINION_PURPOSE } from './opinion-knowledge.ts'
import { CONVERSION_PURPOSE } from './conversion.ts'
import type { ScriptPurpose, ScriptPurposeId, PurposeStructure, PurposeMaterialField } from './types.ts'

export const SCRIPT_PURPOSES: ScriptPurpose[] = [
  ACQUISITION_PURPOSE,
  PERSONA_PURPOSE,
  OPINION_PURPOSE,
  CONVERSION_PURPOSE,
]

const PURPOSE_BY_ID = new Map<ScriptPurposeId, ScriptPurpose>(
  SCRIPT_PURPOSES.map((purpose) => [purpose.id, purpose]),
)

export const PURPOSE_IDS: ScriptPurposeId[] = SCRIPT_PURPOSES.map((purpose) => purpose.id)

export function purposeById(id: ScriptPurposeId | undefined): ScriptPurpose | undefined {
  return id ? PURPOSE_BY_ID.get(id) : undefined
}

/** 旧目标 → 目的：只有「成交」能无损映射成转化型，流量必须让用户重选。 */
export function purposeIdFromGoal(goal: string): ScriptPurposeId | undefined {
  switch (goal) {
    case '获客':
      return 'acquisition'
    case '人设':
      return 'persona'
    case '观点干货':
    case '观点·干货':
      return 'opinion'
    case '转化':
    case '成交':
      return 'conversion'
    default:
      return undefined
  }
}

export function structuresForPurpose(id: ScriptPurposeId | undefined): PurposeStructure[] {
  return purposeById(id)?.structures ?? []
}

export function structureById(id: string | undefined): PurposeStructure | undefined {
  if (!id) return undefined
  for (const purpose of SCRIPT_PURPOSES) {
    const found = purpose.structures.find((structure) => structure.id === id)
    if (found) return found
  }
  return undefined
}

/** 结构属于哪个目的（用于历史任务反查/校验） */
export function purposeOfStructure(id: string | undefined): ScriptPurpose | undefined {
  if (!id) return undefined
  return SCRIPT_PURPOSES.find((purpose) => purpose.structures.some((structure) => structure.id === id))
}

export function materialsForPurpose(id: ScriptPurposeId | undefined): PurposeMaterialField[] {
  return purposeById(id)?.materials ?? []
}

/** 目的 → 写进 config.goal 的短标签（Markdown 的「目标」与历史列表都用它） */
export function goalOfPurpose(id: ScriptPurposeId): '获客' | '人设' | '观点干货' | '转化' {
  switch (id) {
    case 'acquisition':
      return '获客'
    case 'persona':
      return '人设'
    case 'opinion':
      return '观点干货'
    case 'conversion':
      return '转化'
  }
}

export type { ScriptPurpose, ScriptPurposeId, PurposeStructure, PurposeMaterialField }
