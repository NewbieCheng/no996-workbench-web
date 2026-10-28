import { isWorkbenchAiDemoMode } from '../../../api/workbench-ai'
import { EMPTY_USER_FORM } from '../../../services/persona'
import type { ProductRecord } from '../../../services/product-position/types'
import { polishProfileDocField } from '../../persona/agent/form-assist'

export type ProductAssistFieldId =
  | 'name'
  | 'type'
  | 'specName'
  | 'specPrice'
  | 'usage'
  | 'current'
  | 'purchase'
  | 'delivery'

const FIELD_LABEL: Record<ProductAssistFieldId, string> = {
  name: '产品名称',
  type: '产品类型',
  specName: '规格 / 版本 / 套餐',
  specPrice: '价格与收费方式',
  usage: '产品怎么用、客户得到什么',
  current: '客户现状与不满',
  purchase: '购买犹豫与反馈',
  delivery: '交付完成标准与前置条件',
}

export type PolishProductFieldInput = {
  field: ProductAssistFieldId
  fieldLabel?: string
  value: string
  product: ProductRecord
  instruction?: string
  signal?: AbortSignal
  onPartial?: (text: string) => void
}

function buildProductContext(product: ProductRecord): string {
  const specs = product.specs
    .map((spec) => {
      const name = spec.name.trim()
      const price = spec.price.trim()
      if (!name && !price) return null
      return `${name || '未命名规格'}${price ? ` · ${price}` : ''}`
    })
    .filter(Boolean)
    .join('；')

  return [
    product.name.trim() ? `产品名称：${product.name.trim()}` : '',
    product.type.trim() ? `产品类型：${product.type.trim()}` : '',
    specs ? `规格价格：${specs}` : '',
    product.answers.usage.trim() ? `使用与所得：${product.answers.usage.trim()}` : '',
    product.answers.current.trim() ? `客户现状：${product.answers.current.trim()}` : '',
    product.answers.purchase.trim() ? `购买犹豫：${product.answers.purchase.trim()}` : '',
    product.answers.delivery.trim() ? `交付条件：${product.answers.delivery.trim()}` : '',
    '只润色当前字段；不编造未提供的价格、案例与承诺；语气专业、具体、简短。',
  ]
    .filter(Boolean)
    .join('\n')
}

function demoPolish(field: ProductAssistFieldId, value: string, instruction?: string): string {
  const current = value.trim()
  const shorter = Boolean(instruction && /短|简洁|精炼/.test(instruction))
  const fallback: Record<ProductAssistFieldId, string> = {
    name: '示例产品（演示）',
    type: '软件 / 工具',
    specName: '标准版',
    specPrice: '按需报价',
    usage: '客户按引导完成关键步骤后，获得可落地的结果与复盘清单。',
    current: '多数人靠零散工具或人工硬扛，口径不统一、难复用。',
    purchase: '担心学不会、效果不稳定；暂无系统退款数据可写「暂无」。',
    delivery: '交付以可用成稿 / 可执行为准；客户需先提供基础资料。',
  }
  if (!current) return fallback[field]
  if (shorter) return current.length > 36 ? `${current.slice(0, 36)}…` : current
  return `${current.replace(/[。．.]+$/u, '')}（演示润色）`
}

export async function polishProductField(input: PolishProductFieldInput): Promise<string> {
  const fieldLabel = input.fieldLabel?.trim() || FIELD_LABEL[input.field]
  const context = buildProductContext(input.product)
  const instruction = [input.instruction?.trim(), context].filter(Boolean).join('\n\n')

  if (isWorkbenchAiDemoMode()) {
    const result = demoPolish(input.field, input.value, input.instruction)
    input.onPartial?.(result)
    return result
  }

  return polishProfileDocField({
    fieldLabel: `产品定位·${fieldLabel}`,
    value: input.value,
    form: EMPTY_USER_FORM,
    instruction,
    signal: input.signal,
    onPartial: input.onPartial,
  })
}

export { FIELD_LABEL as PRODUCT_ASSIST_FIELD_LABEL }
