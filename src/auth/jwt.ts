/**
 * Access token 的载荷。
 *
 * 空间模型重构后，JWT 里不再有 `tid` / `role` / `acct`：同一个账号在三个空间里
 * 有三种形态，把其中一个写进令牌必然自相矛盾。身份一律以 `/me/spaces` 为准；
 * 这里的 `sk` / `sid` 只是「这条会话在哪」的**显示用提示**。
 */
export interface JwtClaims {
  uid?: number;
  /** 空间类型：1=个人 2=团队 3=平台。 */
  sk?: number;
  /** 空间 id（个人空间 = user_id，团队空间 = tenant_id，平台空间 = 0）。 */
  sid?: number;
  /** 产品授权（清流）编码与角色。 */
  sc?: string;
  sr?: string;
  exp?: number;
}

export function parseJwtPayload(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** True when the access JWT parses, has uid, and is not past exp. */
export function isAccessTokenValid(token: string | null | undefined, nowMs = Date.now()): boolean {
  if (!token) return false;
  const claims = parseJwtPayload(token);
  if (!claims?.uid) return false;
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= nowMs) return false;
  return true;
}
