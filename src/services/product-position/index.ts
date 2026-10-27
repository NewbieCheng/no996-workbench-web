import { getAccessToken } from '../../api/client'
import { parseJwtPayload } from '../../auth/jwt'
import type { ProductRecord } from './types'

export * from './types'
export {
  clearProductPositionStore,
  deleteProduct,
  getLatestAttempt,
  getLatestReport,
  getProduct,
  getReport,
  listProducts,
  listReports,
  saveProduct,
  saveReport,
  setReportStatus,
} from './store'

/**
 * 本机数据归属键：同浏览器切账号时不串产品与报告。
 *
 * 后端 JWT 只有 uid / tid，没有 sub；未登录时返回 undefined（页面本身在工作台
 * 守卫之后，正常不会走到）。
 */
export function getProductPositionOwner(): string | undefined {
  const token = getAccessToken()
  if (!token) return undefined
  const claims = parseJwtPayload(token)
  if (!claims?.uid) return undefined
  return `u${claims.uid}-t${claims.tid ?? 0}`
}

export type ProductFieldErrors = Partial<Record<'name' | 'type' | 'specs', string>>

/** 前端只校验三项必填与规格行；产品核心资料是否够用交给 adequacy 预检。 */
export function validateProductBasics(product: ProductRecord): ProductFieldErrors {
  const errors: ProductFieldErrors = {}
  if (!product.name.trim()) errors.name = '请填写产品名称'
  if (!product.type.trim()) errors.type = '请选择或填写产品类型'
  const specs = product.specs.filter((spec) => spec.name.trim() || spec.price.trim())
  if (specs.length === 0) {
    errors.specs = '至少填写一行规格与价格'
  } else if (specs.some((spec) => !spec.name.trim() || !spec.price.trim())) {
    errors.specs = '每一行的规格与价格都要填写'
  }
  return errors
}

export function hasFieldErrors(errors: ProductFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/** 产品名旁边的一句话摘要，用于列表行与页头。 */
export function productSubtitle(product: ProductRecord): string {
  const specs = product.specs.filter((spec) => spec.name.trim() || spec.price.trim()).length
  const parts: string[] = []
  if (product.type.trim()) parts.push(product.type.trim())
  if (specs > 0) parts.push(`${specs} 个规格`)
  return parts.join(' · ')
}
