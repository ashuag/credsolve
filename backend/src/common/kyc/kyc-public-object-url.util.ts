import type { KycFilesService } from './kyc-files.service';

export type KycPublicObjectUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function trimBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

/** True when `url` looks fetchable from the public internet (not localhost / RFC1918). */
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

/**
 * Absolute HTTPS URL for a stored object key (public CDN / Spaces).
 * Kept for LOS uploads and any future vendor that must fetch an object by URL.
 */
export async function resolveKycPublicObjectUrl(
  kycFiles: KycFilesService,
  relativePath: string,
): Promise<KycPublicObjectUrlResult> {
  const rel = relativePath.trim().replace(/^\/+/, '');
  if (!rel) {
    return { ok: false, error: 'Object path is missing.' };
  }

  for (const envName of ['STORAGE_BASE_URL', 'S3_URL'] as const) {
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

  return {
    ok: false,
    error: 'Configure a public object URL (STORAGE_BASE_URL / DigitalOcean Spaces).',
  };
}

export function devToolUploadRelativePath(uploadId: string, fileName: string): string {
  return `dev-tools/los-uploads/${uploadId}/${fileName}`;
}
