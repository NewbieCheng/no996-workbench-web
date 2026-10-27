export interface JwtClaims {
  uid?: number;
  tid?: number;
  acct?: number;
  role?: number;
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
