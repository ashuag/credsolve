import { apiPost } from './client';

/** Same-tab DigiLocker flow: callback URL does not include `sessionToken`; store before redirect. */
export const DIGILOCKER_SESSION_TOKEN_STORAGE_KEY = 'moneycash:digilocker:sessionToken';

export function persistDigilockerSessionTokenForCallback(token: string | null | undefined): void {
  if (typeof window === 'undefined' || !token?.trim()) return;
  try {
    sessionStorage.setItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY, token.trim());
  } catch {
    /* storage disabled / quota */
  }
}

export function readDigilockerSessionTokenFromStorage(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (sessionStorage.getItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

export function clearDigilockerSessionTokenFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DIGILOCKER_SESSION_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
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
};

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
  );
  if (!res) {
    throw new Error('Empty response from Aadhaar download.');
  }
  return res;
}
