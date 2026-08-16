import { authorizedLosRequest } from './_shared';

export type TenacioFaceCheckResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
};

export type TenacioFaceLivenessInput = {
  file?: File;
  link?: string;
  consent?: boolean;
};

export type TenacioFaceMatchInput = {
  file1?: File;
  file2?: File;
  url1?: string;
  url2?: string;
  consent?: boolean;
};

/**
 * Live Tenacio face-liveness check (developer tool). Tenacio fetches the selfie itself from a
 * public URL — pass `link` directly, or `file` to have it uploaded to S3 and resolved to a URL.
 */
export async function runTenacioFaceLivenessCheck(
  token: string,
  input: TenacioFaceLivenessInput,
): Promise<TenacioFaceCheckResult> {
  const form = new FormData();
  if (input.file) form.set('file', input.file, input.file.name || 'selfie.jpg');
  const link = input.link?.trim();
  if (link) form.set('link', link);
  if (input.consent != null) form.set('consent', String(input.consent));

  return authorizedLosRequest<TenacioFaceCheckResult>(
    token,
    '/developer-tools/tenacio-face-liveness-check',
    { method: 'POST', body: form },
    'Tenacio face liveness check failed.',
  );
}

/**
 * Live Tenacio face-match check (developer tool). Tenacio fetches both photos itself from public
 * URLs — pass `url1`/`url2` directly, or `file1`/`file2` to have them uploaded to S3 and resolved.
 */
export async function runTenacioFaceMatchCheck(
  token: string,
  input: TenacioFaceMatchInput,
): Promise<TenacioFaceCheckResult> {
  const form = new FormData();
  if (input.file1) form.set('file1', input.file1, input.file1.name || 'reference.jpg');
  if (input.file2) form.set('file2', input.file2, input.file2.name || 'selfie.jpg');
  const url1 = input.url1?.trim();
  const url2 = input.url2?.trim();
  if (url1) form.set('url1', url1);
  if (url2) form.set('url2', url2);
  if (input.consent != null) form.set('consent', String(input.consent));

  return authorizedLosRequest<TenacioFaceCheckResult>(
    token,
    '/developer-tools/tenacio-face-match-check',
    { method: 'POST', body: form },
    'Tenacio face match check failed.',
  );
}
