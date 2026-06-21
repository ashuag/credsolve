import type { KycFilesService } from './kyc-files.service';
import { isPubliclyReachableHttpUrl } from './kyc-liveness-selfie-url.util';

export type KycPublicObjectUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function trimBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

/**
 * Absolute HTTPS URL for a stored object key (Tenacio must fetch from the public internet).
 */
export async function resolveKycPublicObjectUrl(
  kycFiles: KycFilesService,
  relativePath: string,
): Promise<KycPublicObjectUrlResult> {
  const rel = relativePath.trim().replace(/^\/+/, '');
  if (!rel) {
    return { ok: false, error: 'Object path is missing.' };
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

  return {
    ok: false,
    error:
      'Configure a public object URL (STORAGE_BASE_URL / DigitalOcean Spaces) so Tenacio can download the image.',
  };
}

export function devToolUploadRelativePath(uploadId: string, fileName: string): string {
  return `dev-tools/los-uploads/${uploadId}/${fileName}`;
}
