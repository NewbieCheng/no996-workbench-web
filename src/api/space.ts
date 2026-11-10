import { api, type ApiEnvelope } from './client';
import type { JwtClaims } from '@/auth/jwt';
import type { Workspace } from '@/theme';

/**
 * 空间类型。与 `/me/spaces` 的 `kind`、JWT 的 `sk`（1/2/3）同源；
 * 类型本身定义在 `@/theme`（`Workspace`），这里不再重复一份。
 */
export type SpaceKind = Workspace;

/** `enabled` 可切换；`locked` 存在但没开启（可自助开启）；`removed` 已被移出。 */
export type SpaceStatus = 'enabled' | 'locked' | 'removed';

/** 空间的最小引用：`{kind, id}` 取代旧契约里的 `tenant_id`。 */
export interface SpaceRef {
  kind: SpaceKind;
  id: number;
}

/** `/me/spaces` 的一项。 */
export interface SpaceSummary extends SpaceRef {
  name: string;
  role: number;
  role_label: string;
  status: SpaceStatus;
  can_enable: boolean;
  current: boolean;
  home: boolean;
}

export interface MySpacesPayload {
  items: SpaceSummary[];
  current_space: SpaceRef | null;
}

/** `POST /me/switch-space` 的返回：只换 access token，refresh token 沿用旧的。 */
export interface SpaceSwitchResult {
  user_id?: number;
  access_token: string;
  current_space?: SpaceRef | null;
}

const SPACE_KIND_BY_CODE: Record<number, SpaceKind> = {
  1: 'personal',
  2: 'team',
  3: 'platform',
};

export function spaceKey(space: SpaceRef | null | undefined): string {
  return space ? `${space.kind}:${space.id}` : '';
}

/**
 * 从令牌的 `sk` / `sid` 折出空间引用。
 *
 * 只在 `/me/spaces` 拿不到时兜底用（离线、后端还没上线该接口）：列表可以为空，
 * 但「我在哪个空间」不该跟着一起丢。
 */
export function spaceRefFromClaims(claims: JwtClaims | null): SpaceRef | null {
  if (!claims?.sk) return null;
  const kind = SPACE_KIND_BY_CODE[claims.sk];
  if (!kind) return null;
  return { kind, id: claims.sid ?? 0 };
}

/** 列出这个账号的全部空间（含未开启）。 */
export async function listMySpaces(): Promise<MySpacesPayload> {
  const res = await api.get<ApiEnvelope<{ items?: SpaceSummary[]; current_space?: SpaceRef | null }>>(
    '/me/spaces',
  );
  const data = res.data?.data;
  return { items: data?.items ?? [], current_space: data?.current_space ?? null };
}

/** 切换到目标空间：换发 access token（refresh token 不变）。 */
export async function switchMySpace(target: SpaceRef): Promise<SpaceSwitchResult> {
  const res = await api.post<ApiEnvelope<SpaceSwitchResult>>('/me/switch-space', {
    kind: target.kind,
    id: target.id,
  });
  const data = res.data?.data;
  if (!data?.access_token) throw new Error('切换空间失败，未收到访问令牌');
  return data;
}

/** 开启一个空间（个人/团队自助；平台空间只有平台管理员能开）。 */
export async function enableMySpace(target: SpaceRef): Promise<SpaceSummary[]> {
  const res = await api.post<ApiEnvelope<{ items?: SpaceSummary[] }>>('/me/spaces/enable', {
    kind: target.kind,
    id: target.id,
  });
  return res.data?.data?.items ?? [];
}

/** 关闭一个空间（主空间会被后端拒绝）。 */
export async function disableMySpace(target: SpaceRef): Promise<SpaceSummary[]> {
  const res = await api.post<ApiEnvelope<{ items?: SpaceSummary[] }>>('/me/spaces/disable', {
    kind: target.kind,
    id: target.id,
  });
  return res.data?.data?.items ?? [];
}
