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

/** Walk shallow + one level under `data` for common Tenacio shapes. */
export function extractDigilockerSessionToken(vendor: unknown): string | null {
  if (!isRecord(vendor)) return null;
  const direct = pickString(vendor, ['sessionToken', 'session_token']);
  if (direct) return direct;
  const data = vendor.data;
  if (isRecord(data)) {
    const inner = pickString(data, ['sessionToken', 'session_token']);
    if (inner) return inner;
  }
  return null;
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
