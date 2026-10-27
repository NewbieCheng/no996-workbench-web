import type { VoiceCloneMeta } from '../../api/voice-clone'
import i18n from '../../i18n'

function pointsToDisplayYuan(points: number): string {
  return (points / 100).toFixed(points % 100 === 0 ? 0 : 2)
}

export type ClonePricingView = {
  points: number | null
  saleYuan: string | null
  listYuan: string | null
  showListPrice: boolean
  ready: boolean
}

function formatYuanAmount(value: number): string {
  if (!Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function readYuan(meta: VoiceCloneMeta, ...keys: (keyof VoiceCloneMeta)[]): number | undefined {
  for (const key of keys) {
    const v = meta[key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
  }
  return undefined
}

/** 展示价一律来自后端 meta；无 meta 时不编造数字。 */
export function resolveClonePricing(meta: VoiceCloneMeta | null | undefined): ClonePricingView {
  if (!meta) {
    return { points: null, saleYuan: null, listYuan: null, showListPrice: false, ready: false }
  }

  const points =
    typeof meta.points_per_clone === 'number' && Number.isFinite(meta.points_per_clone)
      ? meta.points_per_clone
      : null

  const saleFromApi = readYuan(meta, 'sale_price_yuan', 'price_yuan', 'sale_yuan')
  const listFromApi = readYuan(meta, 'list_price_yuan', 'original_price_yuan', 'list_yuan')

  const saleYuan =
    saleFromApi != null
      ? formatYuanAmount(saleFromApi)
      : points != null
        ? pointsToDisplayYuan(points)
        : null

  const listYuan = listFromApi != null ? formatYuanAmount(listFromApi) : null

  const showListPrice =
    listYuan != null &&
    saleYuan != null &&
    Number.parseFloat(listYuan) > Number.parseFloat(saleYuan)

  return {
    points,
    saleYuan,
    listYuan,
    showListPrice,
    ready: points != null || saleYuan != null,
  }
}

/** Step 2 右侧权益文案；价格来自 meta，不写死金额。 */
export function resolveCloneBenefitCopy(pricing: Pick<ClonePricingView, 'saleYuan'>): {
  perkTitle: string
  perkLead: string
  perks: string[]
} {
  const sale = pricing.saleYuan
  const t = i18n.getFixedT(null, 'voice')
  return {
    perkTitle: t('clone.benefits.perkTitle'),
    perkLead: sale
      ? t('clone.benefits.perkLeadWithPrice', { sale })
      : t('clone.benefits.perkLead'),
    perks: t('clone.benefits.perks', { returnObjects: true }) as string[],
  }
}
