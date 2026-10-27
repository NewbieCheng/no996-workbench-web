/**
 * 提示词公共规则与模板代入。
 *
 * 代入语法统一为 «变量»：
 *   - renderTemplate 负责把 «k» 替换为值
 *   - 传 mark=true 时保留 «» 标记，供折叠区高亮显示变量位置
 *   - stripVarMarks 去掉标记，得到可直接复制的纯文本
 *
 * 原先 persona 用 {读者}、titles 用 {主题} 的 .replace 链、script 规格用 {{变量}}，
 * 三种写法并存；现统一为一种。
 */

/** 拼在每个业务提示词开头的公共规则（对齐参考规格 6.0） */
export const COMMON_RULES = [
  '你是「不加班工作台」的内容生成 Agent 之一。通用规则：',
  '1. 使用简体中文，口语化，短句。',
  '2. 只使用用户提供的信息和检索结果里的信息，不得编造数据、销量、库存、功效、资质、背书。',
  '3. 不使用绝对化用语（最、第一、唯一、100%、保证、永久、根治等），不做医疗或收益承诺。',
  '4. 严格按要求的 JSON 结构输出；无法确定的字段写 null，并在 assumptions 里说明。',
  '5. 不要输出与任务无关的内容。',
].join('\n')

export const JSON_ONLY_INSTRUCTION = '只输出 JSON，不要 markdown 代码块，不要解释。'

export type TemplateVars = Record<string, string | number | null | undefined>

function stringify(v: string | number | null | undefined, empty = '无'): string {
  if (v === null || v === undefined) return empty
  const s = String(v).trim()
  return s || empty
}

/**
 * 把 «key» 替换为 vars[key]。
 * @param mark 为 true 时保留 «» 标记，便于折叠区高亮。
 */
export function renderTemplate(
  template: string,
  vars: TemplateVars,
  options: { mark?: boolean; empty?: string } = {},
): string {
  const { mark = false, empty = '无' } = options
  return template.replace(/«([A-Za-z0-9_]+)»/g, (_match, key: string) => {
    const value = stringify(vars[key], empty)
    return mark ? `«${value}»` : value
  })
}

/** 去掉高亮标记，得到可复制的纯文本 */
export function stripVarMarks(text: string): string {
  return text.replace(/[«»]/g, '')
}

/** 把数组/对象统一渲染为提示词里可读的片段 */
export function listOrNone(items: string[] | undefined | null, empty = '无'): string {
  const list = (items ?? []).map((s) => String(s).trim()).filter(Boolean)
  return list.length ? list.join('、') : empty
}

/** 带公共规则的完整 system 提示词 */
export function withCommonRules(body: string): string {
  return `${COMMON_RULES}\n\n${body}`
}
