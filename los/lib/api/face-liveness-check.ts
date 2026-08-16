import { authorizedLosRequest } from './_shared';

export type FaceLivenessCheckPayload = {
  file?: File;
  link?: string;
  usePdf?: boolean;
};

export type FaceLivenessCheckResult = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendorBody: unknown | null;
};

/** Live Surepass face-liveness check (developer tool). */
export async function runFaceLivenessCheck(
  token: string,
  payload: FaceLivenessCheckPayload,
): Promise<FaceLivenessCheckResult> {
  const form = new FormData();
  if (payload.file) {
    form.set('file', payload.file, payload.file.name || 'file');
  }
  const link = payload.link?.trim();
  if (link) form.set('link', link);
  if (payload.usePdf) form.set('usePdf', 'true');

  return authorizedLosRequest<FaceLivenessCheckResult>(
    token,
    '/developer-tools/face-liveness-check',
    { method: 'POST', body: form },
    'Face liveness check failed.',
  );
}
