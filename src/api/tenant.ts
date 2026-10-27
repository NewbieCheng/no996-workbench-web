import { api, type ApiEnvelope } from './client'

export interface TenantInfo {
  tenant_id: number
  tenant_name: string
  tenant_code: string
  status: number
}

export async function getCurrentTenantInfo(): Promise<TenantInfo> {
  const response = await api.get<ApiEnvelope<TenantInfo>>('/tenant/info')
  const tenant = response.data?.data
  if (!tenant?.tenant_name) throw new Error('未获取到企业信息')
  return tenant
}
