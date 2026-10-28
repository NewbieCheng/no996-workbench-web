/**
 * 四类创作目的的数据契约。
 *
 * 四个目的的方法与结构来自 `4-视频脚本 skill 包`（acquisition / persona /
 * opinion-knowledge / conversion 四份 SKILL.md）。这里只保留「能直接进提示词
 * 和结构装配」的部分：写作方法、评审口径、四套结构的段名/职责/占比、必填素材。
 * 完整 Skill 原文不进提示词 —— 每份 8 KB 会让每次调用多付几千 token。
 */

export type ScriptPurposeId = 'acquisition' | 'persona' | 'opinion' | 'conversion'

export type PurposeStructureSegment = {
  name: string
  purpose: string
  /** 占比，五段之和为 1；宿主锁定，模型不改 */
  share: number
}

export type PurposeStructure = {
  /** 稳定 id，写进 config.structure.presetId */
  id: string
  name: string
  /** 适用情境（结构卡片副标题） */
  summary: string
  segments: PurposeStructureSegment[]
}

export type PurposeMaterialField = {
  /** 存进 config.materials[key] */
  key: string
  label: string
  placeholder: string
  /** 必填：缺失时阻止生成 */
  required?: boolean
  multiline?: boolean
  maxLength?: number
}

export type ScriptPurpose = {
  id: ScriptPurposeId
  /** 展示名：获客型 / 人设型 / 观点·干货型 / 转化型 */
  label: string
  /** 两字简称：获客 / 人设 / 干货 / 转化（结果页与任务标题用） */
  shortLabel: string
  /** 一句话说明：观众看完应该产生什么感受 */
  summary: string
  /** 写作方法块（注入编剧提示词） */
  method: string
  /** 评审口径（注入评审提示词） */
  reviewFocus: string
  /** 四套叙事结构 */
  structures: PurposeStructure[]
  /** 按目的收集的素材字段 */
  materials: PurposeMaterialField[]
}
