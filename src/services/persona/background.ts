/**
 * 「背景人设」组装：把本机启用档整理成一段**背景上下文**文本。
 *
 * 与提示词里的「表达参考人设：«persona»」分工不同，两者都保留：
 *
 * - 提示词变量 = 告诉模型「用什么语气和视角说」（表达风格）；
 * - 背景上下文（本文件）= 告诉模型「我是谁、做什么生意、对谁说话」（身份事实）。
 *
 * 身份事实之所以不放进提示词变量：它是**背景**，不是约束条件；混进任务指令里
 * 容易让模型把「我是做餐饮代运营的」当成硬性要求去生搬硬套。两者分开注入（见
 * `src/agent/clients.ts` 的 `withBackground`），可读性也更好。
 *
 * 组装顺序：身份 → 定位卡片摘要（结构化字段）→ 人设档案正文。
 * 定位摘要在前是因为它短、密度高，模型一眼就能抓住「我是谁」。
 */
import type { PersonaRecord, ProfileKind } from './types'

type FieldSpec = { label: string; keys: string[] }

/**
 * 定位卡片字段：按固定顺序输出，只取有值的项。
 *
 * 同一个标签在两种档位下对应不同的字段名（个人是「职业身份」，企业是「企业名称」），
 * 所以按 kind 分开列，而不是写一套万能映射 —— 那样只会把语义不同的字段混在一起。
 */
const POSITION_FIELDS: Record<ProfileKind, FieldSpec[]> = {
  user: [
    { label: '所属行业', keys: ['industry'] },
    { label: '职业身份', keys: ['occupation', 'role'] },
    { label: '公开姓名', keys: ['publicName'] },
    { label: '核心客户', keys: ['audiences', 'targetClients'] },
    { label: '主要业务', keys: ['products', 'primaryBusiness'] },
    { label: '希望被记住的词', keys: ['desiredImage'] },
  ],
  company: [
    { label: '企业名称', keys: ['companyName'] },
    { label: '所属行业', keys: ['industry'] },
    { label: '主营业务', keys: ['mainBusiness'] },
    { label: '目标市场', keys: ['targetMarket'] },
    { label: '核心壁垒', keys: ['competitiveEdge'] },
    { label: '发展愿景', keys: ['companyVision'] },
  ],
}

function readString(form: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = form[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/**
 * 定位卡片摘要，形如「所属行业：内容营销｜职业身份：内容运营顾问｜主要业务：…」。
 * 没有可用字段时返回空串（**不编造**占位值）。
 */
export function positioningSummary(record: PersonaRecord | null): string {
  if (!record) return ''
  const form = (record.formData ?? {}) as unknown as Record<string, unknown>
  const parts = (POSITION_FIELDS[record.kind] ?? [])
    .map(({ label, keys }) => {
      const value = readString(form, keys)
      return value ? `${label}：${value}` : ''
    })
    .filter(Boolean)
  if (record.kind === 'user' && record.selectedPositioning && record.summary.trim()) {
    parts.push(`一句话定位：${record.summary.trim()}`)
  }
  return parts.join('｜')
}

/**
 * 组装背景上下文。无档、或整档为空时返回 `''`，调用方据此**不注入**。
 */
export function composePersonaBackground(record: PersonaRecord | null): string {
  if (!record) return ''
  const content = record.content.trim()
  const positioning = positioningSummary(record)
  if (!content && !positioning) return ''

  const blocks: string[] = []
  const name = record.name.trim()
  if (name) blocks.push(`身份：${name}`)
  if (positioning) blocks.push(positioning)
  if (content) blocks.push(content)
  return blocks.join('\n')
}

/* ------------------------- 注入装配（给 UI 复用） ------------------------- */

/**
 * 一次给出**两路**注入内容。
 *
 * 两路来自同一条记录，所以不可能出现「语气是 A、身份是 B」。
 * 没有档、或该路内容为空时为 `undefined` —— 调用方据此完全不注入。
 */
export function personaInjectionParts(record: PersonaRecord | null): {
  /** 表达风格：进提示词变量「表达参考人设」 */
  style: string | undefined
  /** 身份背景：进 system 消息「【背景上下文】」 */
  background: string | undefined
} {
  if (!record) return { style: undefined, background: undefined }
  const style = record.content.trim()
  const background = composePersonaBackground(record)
  return {
    style: style || undefined,
    background: background || undefined,
  }
}

/**
 * 菜单里那一行提示：只取**最能区分档位**的两个字段（所属行业 + 职业身份）。
 *
 * 不整段塞定位卡片：六个字段挤在菜单里会占满屏幕，反而挑不动。
 * 没有结构化字段时退回档的 summary，最后才退回名称 —— 都不编造。
 */
export function personaMenuHint(record: PersonaRecord | null): string {
  if (!record) return ''
  const form = (record.formData ?? {}) as unknown as Record<string, unknown>
  const picked = (POSITION_FIELDS[record.kind] ?? [])
    .slice(0, 2)
    .map(({ keys }) => readString(form, keys))
    .filter(Boolean)
    .join('｜')
  return picked || record.summary.trim() || record.name.trim()
}

/**
 * 默认选中哪一档：**启用档优先**，否则最近更新的那一档；空列表返回 `null`。
 *
 * 与仓储的 `getActive()` 语义保持一致（`list()` 已按 `updatedAt` 倒序），
 * 但这里是纯函数：给定列表就能算，不需要连 IndexedDB，因此可以直接断言。
 */
export function pickInitialPersonaId(records: PersonaRecord[]): string | null {
  if (!records.length) return null
  return (records.find((r) => r.isActive) ?? records[0]).id
}
