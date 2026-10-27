export interface JwtClaims { sub?: string; exp?: number }
export function parseJwtPayload(_token: string): JwtClaims | null { return null }
export function isAccessTokenValid(_token: string | null | undefined, _nowMs = Date.now()): boolean { return false }
