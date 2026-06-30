import { apiPost, apiPostFormData } from './client';
import {
  isKycVendorTechnicalFailure,
  KYC_SELFIE_GENERIC_RETRY_MESSAGE,
} from '../kyc-liveness-messages';

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
  /** Generic customer copy from API (preferred over raw vendor fields). */
  customerMessage?: string;
  /** Vendor auth/config failure — show thank-you, not retake selfie. */
  internalError?: boolean;
};

export function pickLivenessFailureUserMessage(out: PostKycLivenessResponse): string {
  if (out.internalError) {
    return (
      out.customerMessage?.trim() ||
      'Thank you for your request. One of our representatives will contact you shortly for additional information. We appreciate your patience.'
    );
  }
  if (isKycVendorTechnicalFailure(out)) {
    return KYC_SELFIE_GENERIC_RETRY_MESSAGE;
  }
  return (
    out.customerMessage?.trim() ||
    out.faceValidationMessage?.trim() ||
    out.faceMatchMessage?.trim() ||
    KYC_SELFIE_GENERIC_RETRY_MESSAGE
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
