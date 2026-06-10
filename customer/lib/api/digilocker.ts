import { apiGet, apiPost } from './client';

/** Same-tab DigiLocker flow: callback URL may not include `sessionToken`; store before redirect. */
export const DIGILOCKER_SESSION_TOKEN_STORAGE_KEY = 'moneycash:digilocker:sessionToken';

function isRec(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Mirror backend Tenacio parsing — token may be nested under `data`. */
export function extractDigilockerSessionTokenFromVendor(vendor: unknown, depth = 0): string | null {
  if (depth > 8 || vendor == null || !isRec(vendor)) return null;
  for (const key of ['sessionToken', 'session_token', 'sessionId', 'session_id'] as const) {
    const v = vendor[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  for (const value of Object.values(vendor)) {
    const found = extractDigilockerSessionTokenFromVendor(value, depth + 1);
    if (found) return found;
  }
  return null;
}

export function extractDigilockerSessionTokenFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    for (const key of ['sessionToken', 'session_token', 'token', 'sessionId', 'session_id']) {
      const v = u.searchParams.get(key);
      if (v?.trim()) return v.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function persistDigilockerSessionTokenForCallback(token: string | null | undefined): void {
  if (typeof window === 'undefined' || !token?.trim()) return;
  const value = token.trim();
  try {
    sessionStorage.setItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY, value);
    localStorage.setItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY, value);
  } catch {
    /* storage disabled / quota */
  }
}

export function readDigilockerSessionTokenFromStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (
      sessionStorage.getItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY) ??
      localStorage.getItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY) ??
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function clearDigilockerSessionTokenFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY);
    localStorage.removeItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type PendingDigilockerSessionResponse = {
  sessionToken: string | null;
};

export async function fetchPendingDigilockerSession(): Promise<PendingDigilockerSessionResponse> {
  const res = await apiGet<PendingDigilockerSessionResponse>(
    '/auth/digilocker/pending-session',
    'Unable to recover DigiLocker session.',
  );
  return res ?? { sessionToken: null };
}

export type InitDigilockerPayload = {
  /** Must match server allowlist (e.g. same origin as CUSTOMER_PORTAL_BASE_URL). */
  redirectUrl?: string;
};

export type InitDigilockerResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  digilockerLoginUrl: string | null;
  sessionToken: string | null;
};

export type DownloadAadhaarDigilockerPayload = {
  sessionToken: string;
  consent?: boolean;
};

export type DownloadAadhaarDigilockerResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  businessSuccess?: boolean;
  persisted?: boolean;
  identityMismatch?: boolean;
  identityMismatchMessage?: string;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  canRetry?: boolean;
  leadRejected?: boolean;
  terminalFailure?: boolean;
};

function findDigilockerRedirectUrl(vendor: unknown, depth = 0): string | null {
  if (depth > 5 || vendor == null) return null;
  if (typeof vendor === 'string' && /^https?:\/\//i.test(vendor.trim())) {
    return vendor.trim();
  }
  if (typeof vendor !== 'object') return null;
  const o = vendor as Record<string, unknown>;
  for (const key of ['redirectUrl', 'url', 'authorizationUrl', 'authUrl', 'redirect_uri']) {
    const v = o[key];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  }
  for (const v of Object.values(o)) {
    const found = findDigilockerRedirectUrl(v, depth + 1);
    if (found) return found;
  }
  return null;
}

export type StartDigilockerLoginResult = { ok: true } | { ok: false; message: string };

/** Calls `digilocker-generate-url` and redirects the browser to DigiLocker login. */
export async function startDigilockerLoginFlow(
  redirectPath = '/kyc/digilocker-callback',
): Promise<StartDigilockerLoginResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const out = await initDigilockerSession(
    origin ? { redirectUrl: `${origin}${redirectPath}` } : {},
  );

  if (!out.configured) {
    return { ok: false, message: out.skipReason ?? 'DigiLocker is not configured on the server.' };
  }
  if (!out.ok) {
    const vendorMsg =
      typeof out.vendor === 'object' && out.vendor && 'message' in (out.vendor as object)
        ? String((out.vendor as { message?: unknown }).message)
        : `DigiLocker request failed (${out.httpStatus ?? 'no status'}).`;
    return { ok: false, message: vendorMsg };
  }

  const redirect = out.digilockerLoginUrl ?? findDigilockerRedirectUrl(out.vendor);
  if (!redirect) {
    return {
      ok: false,
      message: 'DigiLocker started, but no login URL was returned. Check with support or try again.',
    };
  }

  const sessionToken =
    out.sessionToken ??
    extractDigilockerSessionTokenFromVendor(out.vendor) ??
    extractDigilockerSessionTokenFromUrl(redirect);
  persistDigilockerSessionTokenForCallback(sessionToken);
  if (!sessionToken) {
    return {
      ok: false,
      message:
        'DigiLocker started, but no session token was returned. Check Tenacio configuration or try again.',
    };
  }

  window.location.assign(redirect);
  return { ok: true };
}

/** Best-effort message from Tenacio-style `vendor` bodies on download failures. */
export function pickDigilockerDownloadErrorMessage(vendor: unknown): string | undefined {
  if (!isRec(vendor)) return undefined;
  const err = vendor.error;
  if (typeof err === 'string') {
    const m = err.trim();
    if (m) return m;
  }
  if (isRec(err)) {
    for (const key of ['message', 'description', 'detail'] as const) {
      const val = err[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
  }
  if (typeof vendor.message === 'string' && vendor.message.trim()) return vendor.message.trim();
  return undefined;
}

export async function initDigilockerSession(
  payload: InitDigilockerPayload = {},
): Promise<InitDigilockerResponse> {
  const res = await apiPost<InitDigilockerResponse>(
    '/auth/digilocker/init',
    payload,
    'Unable to start DigiLocker.',
  );
  if (!res) {
    throw new Error('Empty response from DigiLocker.');
  }
  return res;
}

/** Tenacio Aadhaar download can be slow; allow more time than default POST timeout. */
const DIGILOCKER_DOWNLOAD_TIMEOUT_MS = 45_000;

export async function downloadDigilockerAadhaar(
  payload: DownloadAadhaarDigilockerPayload,
): Promise<DownloadAadhaarDigilockerResponse> {
  const res = await apiPost<DownloadAadhaarDigilockerResponse>(
    '/auth/digilocker/download-aadhaar',
    {
      sessionToken: payload.sessionToken,
      consent: payload.consent !== false,
    },
    'Unable to download Aadhaar from DigiLocker.',
    { timeoutMs: DIGILOCKER_DOWNLOAD_TIMEOUT_MS },
  );
  if (!res) {
    throw new Error('Empty response from Aadhaar download.');
  }
  return res;
}
