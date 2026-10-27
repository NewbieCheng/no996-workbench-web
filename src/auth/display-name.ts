/**
 * Resolves the label shown in account UI.
 * Server-side display_name is not returned on login yet; stored name comes from register or future profile edits.
 */
export function resolveUserDisplayName(opts: {
  storedDisplayName?: string;
  userEmail?: string;
  fallback: string;
}): string {
  const stored = opts.storedDisplayName?.trim();
  if (stored) return stored;
  const email = opts.userEmail?.trim();
  if (email?.includes('@')) return email.split('@')[0] ?? opts.fallback;
  if (email) return email;
  return opts.fallback;
}
