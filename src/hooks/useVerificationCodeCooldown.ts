import { useCallback, useEffect, useState } from 'react';

export const VERIFICATION_COOLDOWN_SECONDS = 60;
const STORAGE_PREFIX = 'no996_verification_cooldown_';

export function verificationCooldownStorageKey(purpose: string, target: string): string {
  const normalizedTarget = target.trim().toLowerCase();
  return `${STORAGE_PREFIX}${purpose}:${normalizedTarget}`;
}

function readRemainingSeconds(scopeKey: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = sessionStorage.getItem(scopeKey);
  if (!raw) return 0;
  const until = Number.parseInt(raw, 10);
  if (!Number.isFinite(until)) {
    sessionStorage.removeItem(scopeKey);
    return 0;
  }
  const left = Math.ceil((until - Date.now()) / 1000);
  if (left <= 0) {
    sessionStorage.removeItem(scopeKey);
    return 0;
  }
  return left;
}

export function useVerificationCodeCooldown(scopeKey: string) {
  const [remaining, setRemaining] = useState(() => readRemainingSeconds(scopeKey));

  useEffect(() => {
    const sync = () => setRemaining(readRemainingSeconds(scopeKey));
    sync();
    const timer = window.setInterval(sync, 1000);
    return () => window.clearInterval(timer);
  }, [scopeKey]);

  const startCooldown = useCallback(
    (seconds = VERIFICATION_COOLDOWN_SECONDS) => {
      if (typeof window === 'undefined' || !scopeKey) return;
      const safeSeconds = Math.max(1, Math.floor(seconds));
      sessionStorage.setItem(scopeKey, String(Date.now() + safeSeconds * 1000));
      setRemaining(safeSeconds);
    },
    [scopeKey],
  );

  return {
    remaining,
    isCoolingDown: remaining > 0,
    startCooldown,
  };
}
