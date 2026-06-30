/** Mirrors backend `KYC_SELFIE_GENERIC_RETRY_MESSAGE`. */
export const KYC_SELFIE_GENERIC_RETRY_MESSAGE =
  'We could not verify your selfie. Please try again with a clear photo in good lighting, facing the camera.';

const TECHNICAL_VENDOR_PATTERNS = [
  'invalid x-api-key',
  'invalid client-id',
  'invalid client id',
  'header validation',
  'signaturedoesnotmatch',
  'access denied',
] as const;

export function isKycVendorTechnicalErrorMessage(message: string | null | undefined): boolean {
  const msg = (message ?? '').trim().toLowerCase();
  if (!msg) return false;
  return TECHNICAL_VENDOR_PATTERNS.some((p) => msg.includes(p));
}

export function isKycVendorTechnicalFailure(params: {
  vendorErrorMessage?: string | null;
  faceValidationMessage?: string | null;
  faceMatchMessage?: string | null;
  vendor?: unknown;
}): boolean {
  const candidates = [
    params.vendorErrorMessage,
    params.faceValidationMessage,
    params.faceMatchMessage,
    extractVendorFailureLine(params.vendor),
  ];
  return candidates.some((m) => isKycVendorTechnicalErrorMessage(m));
}

function isRec(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

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

  return extractVendorFailureLine(vendor.data, depth + 1);
}
