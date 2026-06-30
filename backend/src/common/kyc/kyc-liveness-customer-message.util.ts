import { pickTenacioVendorErrorMessage } from './aadhaar-vendor-parse.util';
import { isVendorTechnicalConfigurationError } from '../vendor/vendor-api-error.util';

/** Shown when selfie / liveness did not pass and the customer may retry (never includes vendor internals). */
export const KYC_SELFIE_GENERIC_RETRY_MESSAGE =
  'We could not verify your selfie. Please try again with a clear photo in good lighting, facing the camera.';

export type KycLivenessCustomerFailureKind = 'technical' | 'retry';

export function collectKycVendorFailureMessages(params: {
  message?: string | null;
  vendor?: unknown;
}): string[] {
  const out: string[] = [];
  const primary = params.message?.trim();
  if (primary) out.push(primary);
  const fromVendor = pickTenacioVendorErrorMessage(params.vendor)?.trim();
  if (fromVendor && !out.includes(fromVendor)) out.push(fromVendor);
  return out;
}

export function isKycVendorTechnicalFailure(params: {
  message?: string | null;
  httpStatus?: number | null;
  vendor?: unknown;
}): boolean {
  for (const msg of collectKycVendorFailureMessages(params)) {
    if (isVendorTechnicalConfigurationError({ message: msg, httpStatus: params.httpStatus })) {
      return true;
    }
  }
  return false;
}

export function resolveKycLivenessCustomerFailure(params: {
  message?: string | null;
  httpStatus?: number | null;
  vendor?: unknown;
}): { kind: KycLivenessCustomerFailureKind; customerMessage: string } {
  if (isKycVendorTechnicalFailure(params)) {
    return { kind: 'technical', customerMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE };
  }
  return { kind: 'retry', customerMessage: KYC_SELFIE_GENERIC_RETRY_MESSAGE };
}
