import { apiPost, apiPostFormData } from './client';

export type PostKycSelfieResponse = {
  success: true;
  selfieRelativePath: string;
};

export type PostKycLivenessResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  livenessPassed: boolean;
  vendorErrorMessage?: string;
  faceValidationPassed?: boolean;
  faceValidationMessage?: string;
  faceMatchPassed?: boolean;
  faceMatchMessage?: string;
  suggestRetrySelfie?: boolean;
  bestComputedConfidence?: number | null;
};

function isRec(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Mirrors backend `pickTenacioVendorErrorMessage` so older APIs without `vendorErrorMessage` still show vendor text. */
function extractVendorFailureLine(vendor: unknown, depth = 0): string | undefined {
  if (depth > 6 || !isRec(vendor)) return undefined;

  const nested = vendor.error;
  if (typeof nested === 'string') {
    const m = nested.trim();
    if (m) return m;
  }
  if (isRec(nested)) {
    for (const key of ['message', 'description', 'detail', 'title'] as const) {
      const val = nested[key];
      if (typeof val === 'string') {
        const m = val.trim();
        if (m) return m;
      }
    }
  }

  if (typeof vendor.message === 'string') {
    const m = vendor.message.trim();
    if (m) return m;
  }

  const errors = vendor.errors;
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (typeof item === 'string') {
        const m = item.trim();
        if (m) return m;
      }
      if (isRec(item)) {
        for (const key of ['message', 'msg', 'description'] as const) {
          const val = item[key];
          if (typeof val === 'string') {
            const m = val.trim();
            if (m) return m;
          }
        }
      }
    }
  }

  return extractVendorFailureLine(vendor.data, depth + 1);
}

export function pickLivenessFailureUserMessage(out: PostKycLivenessResponse): string {
  return (
    out.faceValidationMessage?.trim() ||
    out.faceMatchMessage?.trim() ||
    out.vendorErrorMessage?.trim() ||
    extractVendorFailureLine(out.vendor) ||
    'Liveness check did not pass. You can try again.'
  );
}

export async function postKycSelfie(file: File): Promise<PostKycSelfieResponse | null> {
  const form = new FormData();
  form.set('selfie', file, 'selfie.jpg');
  return apiPostFormData<PostKycSelfieResponse>(
    '/applications/kyc/selfie',
    form,
    'Unable to upload selfie.',
    { timeoutMs: 45_000 },
  );
}

export async function postKycLiveness(): Promise<PostKycLivenessResponse | null> {
  return apiPost<PostKycLivenessResponse>(
    '/applications/kyc/liveness',
    {},
    'Unable to run liveness check.',
    { timeoutMs: 120_000 },
  );
}
