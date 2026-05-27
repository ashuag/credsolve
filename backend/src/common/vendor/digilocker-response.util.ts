/** Best-effort extraction from Tenacio DigiLocker / Aadhaar JSON envelopes. */

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

function findSessionTokenDeep(vendor: unknown, depth = 0): string | null {
  if (depth > 8 || vendor == null) return null;
  if (!isRecord(vendor)) return null;
  const direct = pickString(vendor, ['sessionToken', 'session_token', 'sessionId', 'session_id']);
  if (direct) return direct;
  for (const value of Object.values(vendor)) {
    const found = findSessionTokenDeep(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Walk nested Tenacio envelopes for `sessionToken` / `session_token`. */
export function extractDigilockerSessionToken(vendor: unknown): string | null {
  return findSessionTokenDeep(vendor);
}

export function extractDigilockerLoginUrl(vendor: unknown): string | null {
  if (typeof vendor === 'string' && /^https?:\/\//i.test(vendor.trim())) return vendor.trim();
  if (!isRecord(vendor)) return null;
  const direct = pickString(vendor, [
    'loginUrl',
    'digilockerUrl',
    'digiLockerUrl',
    'redirectUrl',
    'url',
    'authorizationUrl',
    'authUrl',
  ]);
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  const data = vendor.data;
  if (isRecord(data)) {
    const inner = pickString(data, [
      'loginUrl',
      'digilockerUrl',
      'digiLockerUrl',
      'digilockerLoginUrl',
      'url',
      'redirectUrl',
      'authorizationUrl',
      'authorization_url',
    ]);
    if (inner && /^https?:\/\//i.test(inner)) return inner;
  }
  return null;
}
