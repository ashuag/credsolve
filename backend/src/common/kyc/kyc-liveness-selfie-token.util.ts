import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SEC = 15 * 60;

function tokenSecret(): string {
  const s = (process.env.KYC_LIVENESS_SELFIE_TOKEN_SECRET ?? process.env.JWT_SECRET ?? '').trim();
  if (!s) {
    throw new Error('Set JWT_SECRET (or KYC_LIVENESS_SELFIE_TOKEN_SECRET) for liveness selfie URLs.');
  }
  return s;
}

/** Short-lived HMAC token so Tenacio can GET the selfie without a customer session cookie. */
export function createKycLivenessSelfieAccessToken(applicationUuid: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const payload = `${applicationUuid}.${exp}`;
  const sig = createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyKycLivenessSelfieAccessToken(
  token: string,
): { applicationUuid: string } | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [applicationUuid, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!applicationUuid || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  const payload = `${applicationUuid}.${expStr}`;
  const expected = createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }
  return { applicationUuid };
}
