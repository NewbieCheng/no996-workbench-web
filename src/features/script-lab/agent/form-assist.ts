import { chatCompletions } from '../../../api/chat'
import { createTextStreamFilter } from '../../../agent/stream-filter'
import { streamChunks } from '../../../agent/runtime'
import { isWorkbenchAiDemoMode } from '../../../api/workbench-ai'
import type { ScriptConfig } from './types'

export type ScriptOptionalFieldId = 'intro' | 'audience' | 'sellingPoints' | 'pain'

const FIELD_LABEL_ZH: Record<ScriptOptionalFieldId, string> = {
  intro: '产品一句话介绍',
  audience: '目标人群',
  sellingPoints: '核心卖点',
  pain: '用户痛点',
}

const DEMO_BY_FIELD: Record<ScriptOptionalFieldId, string> = {
  intro: '轻便易收纳，日常使用更省心（演示润色）',
  audience: '注重效率的都市白领（演示润色）',
  sellingPoints: '上手快、场景覆盖广\n售后响应及时（演示润色）',
  pain: '怕选错、怕麻烦维护（演示润色）',
}

export type PolishScriptOptionalFieldInput = {
  field: ScriptOptionalFieldId
  value: string
  config: ScriptConfig
  instruction?: string
  signal?: AbortSignal
  onPartial?: (displayText: string) => void
}

function parsePolishValue(content: string): string {
  const trimmed = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed)
  const body = fenced ? fenced[1].trim() : trimmed
  try {
    const json = JSON.parse(body) as { value?: string }
    if (typeof json.value === 'string' && json.value.trim()) return json.value.trim()
  } catch {
    if (trimmed && !trimmed.startsWith('{')) return trimmed
  }
  throw new Error('AI 润色结果无法解析，请重试。')
}

function buildSystemPrompt(): string {
  return `你是短视频/直播脚本表单的选填字段助手。只润色或补全用户指定的单个字段；不编造优惠、疗效、虚假承诺或未给出的数据。
输出单个 JSON：{"value":"..."}，不要 markdown，不要解释。
语气具体、真实生活感、口语化：
- 目标人群：写具体身份与生活场景；
- 核心卖点：写客观产品特征或能省去哪些麻烦，严禁写成打折促销福利；
- 用户痛点：写实际遇到的生活麻烦（如备料繁琐、外食贵、清洗难），严禁写成“没买我家产品”；
- 严禁在字段里直接注入“小黄车、今天下单、抢到算你的”等催单逼单套路。`
}

function buildUserPrompt(input: PolishScriptOptionalFieldInput): string {
  const { config, field, value } = input
  const instruction = input.instruction?.trim()
  const context = [
    `模式：${config.mode === 'video' ? '短视频' : '直播'}`,
    `产品：${config.product.trim() || '（未填）'}`,
    `平台：${config.platform}`,
    `目标：${config.goal}`,
    config.audience?.trim() ? `目标人群：${config.audience.trim()}` : null,
    config.sellingPoints?.trim() ? `核心卖点：${config.sellingPoints.trim()}` : null,
    config.pain?.trim() ? `用户痛点：${config.pain.trim()}` : null,
    config.intro?.trim() && field !== 'intro' ? `一句话：${config.intro.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const current = value.trim()
  return `${instruction ? `微调要求：${instruction}\n\n` : ''}待处理字段「${FIELD_LABEL_ZH[field]}」：
${current || '（空，请根据上下文补写）'}

表单上下文：
${context}`
}

async function emitPolishStream(finalText: string, onPartial?: (displayText: string) => void, signal?: AbortSignal) {
  if (!onPartial) return
  let display = ''
  await streamChunks(
    finalText,
    (chunk) => {
      display += chunk
      onPartial(display)
    },
    signal,
  )
}

async function requestPolishValue(input: {
  system: string
  user: string
  signal?: AbortSignal
  onPartial?: (displayText: string) => void
}): Promise<string> {
  let raw = ''
  let display = ''
  const filter = createTextStreamFilter({ keys: ['value'] })

  const result = await chatCompletions({
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.45,
    max_tokens: 400,
    signal: input.signal,
    stream: Boolean(input.onPartial),
    onDelta: input.onPartial
      ? (chunk) => {
          raw += chunk
          const delta = filter.push(chunk)
          if (delta) {
            display += delta
            input.onPartial?.(display)
          }
        }
      : undefined,
  })

  const content = result.choices[0]?.message?.content ?? raw
  if (!content?.trim()) throw new Error('AI 未返回润色结果，请重试。')
  return parsePolishValue(content)
}

async function demoPolishField(input: PolishScriptOptionalFieldInput): Promise<string> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 280)
  })
  const demo = DEMO_BY_FIELD[input.field]
  const current = input.value.trim()
  const instruction = input.instruction?.trim()
  if (instruction) {
    return `${current || demo}（演示微调：${instruction}）`
  }
  if (!current) return demo
  return `${current.replace(/[。．.]+$/u, '')}（表述已收紧，演示润色）`
}

export async function polishScriptOptionalField(input: PolishScriptOptionalFieldInput): Promise<string> {
  if (isWorkbenchAiDemoMode()) {
    const result = await demoPolishField(input)
    await emitPolishStream(result, input.onPartial, input.signal)
    return result
  }

  return requestPolishValue({
    system: buildSystemPrompt(),
    user: buildUserPrompt(input),
    signal: input.signal,
    onPartial: input.onPartial,
  })
}
