import { api, type ApiEnvelope } from '@/api/client';
import type { Workspace } from '@/theme';

export interface PermissionsPayload {
  workspace: Workspace;
  scope: number;
  role_codes: string[];
  permissions: string[];
  menu_codes: string[];
}

export async function fetchPermissions(): Promise<PermissionsPayload | null> {
  try {
    const res = await api.get<ApiEnvelope<PermissionsPayload>>('/auth/permissions');
    return res.data.data ?? null;
  } catch {
    return null;
  }
}
