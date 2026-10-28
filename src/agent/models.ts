/**
 * 模型调用策略集中表。
 *
 * 原先温度与 max_tokens 散落在 5 处（同一任务出现 4096 / 8192 两种上限且不一致），
 * 现统一在此声明。新增功能只引用 profile id，不再各自写温度。
 */
import type { ModelProfileId } from './types'

export type ModelProfile = {
  temperature: number
  maxTokens: number
  /** 中文标签，用于折叠区展示「这一步用了什么口径」 */
  label: string
  /** 轻量模型（自动补全类，超时应短） */
  lightweight?: boolean
}

export const MODEL_PROFILES: Record<ModelProfileId, ModelProfile> = {
  /** 结构化理解 / 拆解需求：低温度，避免发散 */
  extract: { temperature: 0.3, maxTokens: 4096, label: '结构化理解' },
  /** 策划、排结构：低温度，保证稳定 */
  plan: { temperature: 0.2, maxTokens: 4096, label: '规划与结构' },
  /** 撰写、编辑、局部重写：高温度，保留表达多样性 */
  draft: { temperature: 0.8, maxTokens: 8192, label: '撰写改写' },
  /** 独立评审：温度 0，必须与写手是两次独立调用且看不到写手上下文 */
  review: { temperature: 0, maxTokens: 4096, label: '独立评审' },
  /** 自动补全：轻量、短超时、失败静默降级 */
  autofill: { temperature: 0.4, maxTokens: 8192, label: '自动补全', lightweight: true },
}

export const DEFAULT_PROFILE_ID: ModelProfileId = 'plan'

export function resolveProfile(id?: ModelProfileId): ModelProfile {
  return MODEL_PROFILES[id ?? DEFAULT_PROFILE_ID]
}
