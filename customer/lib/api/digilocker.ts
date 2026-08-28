import { apiGet, apiPost } from './client';

/** Same-tab DigiLocker flow: callback URL may not include `sessionToken`; store before redirect. */
export const DIGILOCKER_SESSION_TOKEN_STORAGE_KEY = 'moneycash:digilocker:sessionToken';

function isRec(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Mirror backend DigiLocker parsing — token may be nested under `data` (Tenacio sessionToken or Surepass client_id). */
export function extractDigilockerSessionTokenFromVendor(vendor: unknown, depth = 0): string | null {
  if (depth > 8 || vendor == null || !isRec(vendor)) return null;
  for (const key of [
    'sessionToken',
    'session_token',
    'sessionId',
    'session_id',
    'client_id',
    'clientId',
  ] as const) {
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
    sessionStorage.removeItem('moneycash:digilocker:hub-resume');
  } catch {
    /* ignore */
  }
}

/** Set before leaving for DigiLocker so `/kyc` does not flash the hub on return. */
export const DIGILOCKER_EXPECT_SELFIE_STORAGE_KEY = 'moneycash:digilocker:expect-selfie';

export function markDigilockerExpectSelfie(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DIGILOCKER_EXPECT_SELFIE_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function peekDigilockerExpectSelfie(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(DIGILOCKER_EXPECT_SELFIE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearDigilockerExpectSelfie(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DIGILOCKER_EXPECT_SELFIE_STORAGE_KEY);
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
  /** Omit / empty when Redis still has the token from DigiLocker init (local manual callback resume). */
  sessionToken?: string;
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
  /** Duplicate in-flight request did not call the vendor; refresh session or retry after the first call finishes. */
  skippedDuplicate?: boolean;
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
  resetDigilockerAadhaarDownloadGate();
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
        'DigiLocker started, but no session token was returned. Check DigiLocker configuration or try again.',
    };
  }

  markDigilockerExpectSelfie();
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
const AADHAAR_DOWNLOAD_GATE_KEY = 'moneycash:digilocker:aadhaar-download-gate';
const AADHAAR_DOWNLOAD_IN_FLIGHT_MS = 55_000;

type PersistentAadhaarDownloadGate = {
  status: 'in_flight' | 'success' | 'failed';
  at: number;
};

const SUCCESS_WITHOUT_VENDOR: DownloadAadhaarDigilockerResponse = {
  configured: true,
  ok: true,
  httpStatus: 200,
  vendor: null,
  persisted: true,
};

const SKIPPED_IN_FLIGHT: DownloadAadhaarDigilockerResponse = {
  configured: true,
  ok: false,
  httpStatus: null,
  vendor: null,
  skippedDuplicate: true,
  canRetry: true,
};

/**
 * Callback remounts (query strip / Strict Mode / full reload) must join one in-flight
 * download. Success is cached so a remount cannot hit Tenacio again. A retryable
 * failure is not cached, so the next call is a new API request.
 */
let inFlightAadhaarDownload: Promise<DownloadAadhaarDigilockerResponse> | null = null;
let settledAadhaarDownload: DownloadAadhaarDigilockerResponse | null = null;

function readPersistentAadhaarDownloadGate(): PersistentAadhaarDownloadGate | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AADHAAR_DOWNLOAD_GATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistentAadhaarDownloadGate>;
    if (parsed.status !== 'in_flight' && parsed.status !== 'success' && parsed.status !== 'failed') {
      return null;
    }
    if (typeof parsed.at !== 'number') return null;
    return { status: parsed.status, at: parsed.at };
  } catch {
    return null;
  }
}

function writePersistentAadhaarDownloadGate(gate: PersistentAadhaarDownloadGate): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AADHAAR_DOWNLOAD_GATE_KEY, JSON.stringify(gate));
  } catch {
    /* storage disabled / quota */
  }
}

function clearPersistentAadhaarDownloadGate(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AADHAAR_DOWNLOAD_GATE_KEY);
  } catch {
    /* ignore */
  }
}

export function resetDigilockerAadhaarDownloadGate(): void {
  inFlightAadhaarDownload = null;
  settledAadhaarDownload = null;
  clearPersistentAadhaarDownloadGate();
}

function shouldCacheAadhaarDownloadResult(out: DownloadAadhaarDigilockerResponse): boolean {
  if (out.ok) return true;
  if (out.identityMismatch) return true;
  if (out.terminalFailure || out.leadRejected) return true;
  if (!out.configured) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPersistentAadhaarDownloadGate(): Promise<PersistentAadhaarDownloadGate['status']> {
  const deadline = Date.now() + AADHAAR_DOWNLOAD_IN_FLIGHT_MS;
  while (Date.now() < deadline) {
    const gate = readPersistentAadhaarDownloadGate();
    if (!gate || gate.status !== 'in_flight') {
      return gate?.status ?? 'failed';
    }
    await sleep(300);
  }
  return 'in_flight';
}

export async function downloadDigilockerAadhaar(
  payload: DownloadAadhaarDigilockerPayload = {},
): Promise<DownloadAadhaarDigilockerResponse> {
  const sessionToken = payload.sessionToken?.trim() || undefined;
  const res = await apiPost<DownloadAadhaarDigilockerResponse>(
    '/auth/digilocker/download-aadhaar',
    {
      ...(sessionToken ? { sessionToken } : {}),
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

async function executeCallbackAadhaarDownload(
  payload: DownloadAadhaarDigilockerPayload,
): Promise<DownloadAadhaarDigilockerResponse> {
  writePersistentAadhaarDownloadGate({ status: 'in_flight', at: Date.now() });
  try {
    const out = await downloadDigilockerAadhaar(payload);
    if (shouldCacheAadhaarDownloadResult(out)) {
      settledAadhaarDownload = out;
      writePersistentAadhaarDownloadGate({ status: 'success', at: Date.now() });
    } else {
      writePersistentAadhaarDownloadGate({ status: 'failed', at: Date.now() });
    }
    return out;
  } catch (error) {
    writePersistentAadhaarDownloadGate({ status: 'failed', at: Date.now() });
    throw error;
  }
}

/** Use from the DigiLocker callback page so remounts cannot start a second download. */
export function downloadDigilockerAadhaarForCallback(
  payload: DownloadAadhaarDigilockerPayload = {},
): Promise<DownloadAadhaarDigilockerResponse> {
  if (settledAadhaarDownload) return Promise.resolve(settledAadhaarDownload);
  if (inFlightAadhaarDownload) return inFlightAadhaarDownload;

  const gate = readPersistentAadhaarDownloadGate();
  if (gate?.status === 'success') {
    settledAadhaarDownload = SUCCESS_WITHOUT_VENDOR;
    return Promise.resolve(SUCCESS_WITHOUT_VENDOR);
  }

  inFlightAadhaarDownload = (async () => {
    const current = readPersistentAadhaarDownloadGate();
    if (current?.status === 'success') {
      settledAadhaarDownload = SUCCESS_WITHOUT_VENDOR;
      return SUCCESS_WITHOUT_VENDOR;
    }
    if (current?.status === 'in_flight' && Date.now() - current.at < AADHAAR_DOWNLOAD_IN_FLIGHT_MS) {
      const waited = await waitForPersistentAadhaarDownloadGate();
      if (waited === 'success') {
        return SUCCESS_WITHOUT_VENDOR;
      }
      if (waited === 'in_flight') {
        return SKIPPED_IN_FLIGHT;
      }
      // First attempt failed — this call is the allowed new API request.
    }
    return executeCallbackAadhaarDownload(payload);
  })().finally(() => {
    inFlightAadhaarDownload = null;
  });

  return inFlightAadhaarDownload;
}
