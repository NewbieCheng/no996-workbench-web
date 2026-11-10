import { api, type ApiEnvelope } from '@/api/client';
import type { Workspace } from '@/theme';

export interface PermissionsPayload {
  workspace: Workspace;
  scope: number;
  role_codes: string[];
  permissions: string[];
  menu_codes: string[];
}

/**
 * 归一 `workspace`：后端 `/auth/permissions` 目前仍按旧枚举回 `"enterprise"`，
 * 前端统一成 `"team"` 之后就只有一种写法（空间类型由 `/me/spaces` 定义）。
 */
function normalizeWorkspace(raw: unknown): Workspace {
  if (raw === 'platform' || raw === 'team' || raw === 'personal') return raw;
  if (raw === 'enterprise') return 'team';
  return 'personal';
}

export async function fetchPermissions(): Promise<PermissionsPayload | null> {
  try {
    const res = await api.get<ApiEnvelope<PermissionsPayload>>('/auth/permissions');
    const payload = res.data.data;
    if (!payload) return null;
    return { ...payload, workspace: normalizeWorkspace(payload.workspace) };
  } catch {
    return null;
  }
}
