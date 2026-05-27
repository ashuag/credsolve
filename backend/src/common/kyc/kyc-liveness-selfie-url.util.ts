import type { KycFilesService } from './kyc-files.service';
import { createKycLivenessSelfieAccessToken } from './kyc-liveness-selfie-token.util';

export type KycLivenessSelfieUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Tenacio servers must reach `input.url` from the public internet.
 * Localhost / private LAN bases are ignored so `STORAGE_BASE_URL=http://localhost:…`
 * does not block the signed `BACKEND_PUBLIC_BASE_URL` fallback.
 */
export function isPubliclyReachableHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return false;
    }
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return false;
    }
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function trimBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

function signedVendorSelfieUrl(
  backendBase: string,
  applicationUuid: string,
): KycLivenessSelfieUrlResult {
  try {
    const token = createKycLivenessSelfieAccessToken(applicationUuid);
    const url = `${backendBase}/api/vendor/kyc/liveness-selfie?token=${encodeURIComponent(token)}`;
    if (!isPubliclyReachableHttpUrl(url)) {
      return {
        ok: false,
        error:
          'BACKEND_PUBLIC_BASE_URL must be a public API origin (e.g. https://api.moneycash.in), not localhost.',
      };
    }
    return { ok: true, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Absolute HTTPS URL for Tenacio `input.url` (must be fetchable by their servers).
 *
 * Priority:
 * 1. `KYC_LIVENESS_SELFIE_PUBLIC_BASE_URL` + relative selfie path (if public)
 * 2. `STORAGE_BASE_URL` + relative path (if public)
 * 3. DigitalOcean Spaces presigned URL (when `SPACES_*` is configured)
 * 4. `BACKEND_PUBLIC_BASE_URL` + signed `GET /api/vendor/kyc/liveness-selfie?token=…`
 */
export async function resolveKycLivenessSelfiePublicUrl(
  kycFiles: KycFilesService,
  params: {
    applicationUuid: string;
    selfieRelativePath: string;
  },
): Promise<KycLivenessSelfieUrlResult> {
  const rel = params.selfieRelativePath.trim().replace(/^\/+/, '');
  if (!rel) {
    return { ok: false, error: 'Selfie path is missing.' };
  }

  for (const envName of ['KYC_LIVENESS_SELFIE_PUBLIC_BASE_URL', 'STORAGE_BASE_URL'] as const) {
    const base = trimBase(process.env[envName] ?? '');
    if (!base) continue;
    const candidate = `${base}/${rel}`;
    if (isPubliclyReachableHttpUrl(candidate)) {
      return { ok: true, url: candidate };
    }
  }

  try {
    const spacesUrl = await kycFiles.resolvePublicReadUrl(rel);
    if (spacesUrl && isPubliclyReachableHttpUrl(spacesUrl)) {
      return { ok: true, url: spacesUrl };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  const backendBase = trimBase(process.env.BACKEND_PUBLIC_BASE_URL ?? '');
  if (backendBase) {
    return signedVendorSelfieUrl(backendBase, params.applicationUuid);
  }

  return {
    ok: false,
    error:
      'Set BACKEND_PUBLIC_BASE_URL to your public API origin (e.g. https://api.moneycash.in) so Tenacio can download the selfie. ' +
      'Or configure DigitalOcean Spaces (SPACES_*) / STORAGE_BASE_URL for a public or presigned object URL.',
  };
}

