import type { ProductAnswers, ProductRecord, ProductSpecRow } from '../../../services/product-position/types'
import { newProductId } from '../../../services/product-position/types'

/** 开发态「填入示例」；生产构建不得引用本文件内容到 UI。 */
export const SAMPLE_PRODUCT_BASICS = {
  name: '21天写作训练营',
  type: '课程 / 训练营',
} as const

export function createSampleSpecs(): ProductSpecRow[] {
  return [
    { id: `spec-${newProductId()}`, name: '基础版 / 21 天', price: '2980 元 / 期' },
    {
      id: `spec-${newProductId()}`,
      name: '进阶版 / 42 天（含 1v1 批改）',
      price: '5800 元 / 期',
    },
  ]
}

export function createSampleAnswers(): ProductAnswers {
  return {
    usage: '每天一个写作任务，导师批改后反馈；结业时交付 3 篇可发布作品。',
    current: '',
    purchase: '',
    delivery: '',
  }
}

export function applySampleToProduct(product: ProductRecord): ProductRecord {
  return {
    ...product,
    name: SAMPLE_PRODUCT_BASICS.name,
    type: SAMPLE_PRODUCT_BASICS.type,
    specs: createSampleSpecs(),
    answers: createSampleAnswers(),
  }
}
