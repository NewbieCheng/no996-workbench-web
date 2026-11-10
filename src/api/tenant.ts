import { api, type ApiEnvelope } from './client'

/**
 * 「我当前所在的实体」。
 *
 * 空间模型重构后语义从「我的企业」变成「我当前所在的实体」：团队空间返回企业，
 * 个人空间用账号显示名兜底、平台空间返回平台。因此三个字段都可能缺失，
 * 只有 `tenant_name` 是必须的 —— 缺它就真的没法显示。
 */
export interface TenantInfo {
  tenant_id?: number
  tenant_name: string
  tenant_code?: string
  status?: number
}

export async function getCurrentTenantInfo(): Promise<TenantInfo> {
  const response = await api.get<ApiEnvelope<TenantInfo>>('/tenant/info')
  const tenant = response.data?.data
  if (!tenant?.tenant_name) throw new Error('未获取到空间信息')
  return tenant
}
