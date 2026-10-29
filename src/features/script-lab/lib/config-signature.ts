/**
 * 生成输入签名：用于判断「结果生成后，用户又改了设置」。
 *
 * 之前的 stale 只比较产品名：改人群、卖点、目的、结构、素材都不会提示，
 * 用户会以为新设置已经生效。这里把真正会影响成稿的字段全部纳入。
 *
 * 不包含 personaContent / personaBackground：它们是在提交时由右上角开关
 * 临时拼进 config 的运行态字段，不属于表单可编辑项；否则演示模式生成后
 * 会立刻被误判为「设置已更改」。
 */
import type { ScriptConfig } from '../agent/types'

function stableMaterials(materials: Record<string, string> | undefined): Record<string, string> {
  const entries = Object.entries(materials ?? {})
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(entries)
}

export function generationSignature(config: ScriptConfig): string {
  return JSON.stringify({
    mode: config.mode,
    product: config.product,
    intro: config.intro ?? '',
    durationSec: config.durationSec,
    goal: config.goal,
    purpose: config.purpose ?? '',
    materials: stableMaterials(config.materials),
    structure: config.structure,
    audience: config.audience ?? '',
    sellingPoints: config.sellingPoints ?? '',
    pain: config.pain ?? '',
    strength: config.strength,
    platform: config.platform,
    mustWords: config.mustWords ?? [],
    bannedWords: config.bannedWords ?? [],
    offer: config.offer ?? '',
    interactionNodes: config.interactionNodes ?? 3,
    refGood: config.refGood ?? '',
    refCompetitor: config.refCompetitor ?? '',
  })
}
