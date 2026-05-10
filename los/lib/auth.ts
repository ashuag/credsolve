export const LOS_STORAGE_KEY = 'moneyCash_los_session';
export const LOS_COOKIE_NAME = 'moneyCash_crm_session';
export const LOS_THEME_KEY = 'moneyCash_los_theme';

/**
 * Reads the LOS bearer token from `localStorage` on the client.
 * Returns null on the server, when the entry is missing, or when the
 * stored payload is not valid JSON / is missing a `token` field.
 */
export function getLosToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}
