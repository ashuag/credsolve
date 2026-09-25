import { apiPost } from './client';

export type GenerateAadhaarXmlOtpResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  referenceIdIssued?: boolean;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  canRetry?: boolean;
  leadRejected?: boolean;
  terminalFailure?: boolean;
  digilockerFallback?: boolean;
  alreadyCaptured?: boolean;
};

export type DownloadAadhaarXmlResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  vendor: unknown;
  persisted?: boolean;
  identityMismatch?: boolean;
  identityMismatchMessage?: string;
  aadhaarNameReviewPending?: boolean;
  attemptsUsed?: number;
  attemptsAllowed?: number;
  canRetry?: boolean;
  leadRejected?: boolean;
  terminalFailure?: boolean;
  digilockerFallback?: boolean;
};

export async function generateAadhaarXmlOtp(payload: {
  aadhaarNumber: string;
  consent: true;
}): Promise<GenerateAadhaarXmlOtpResponse> {
  const res = await apiPost<GenerateAadhaarXmlOtpResponse>(
    '/auth/aadhaar/xml-generate-otp',
    payload,
    'Unable to send Aadhaar OTP.',
  );
  if (!res) {
    throw new Error('Empty response from Aadhaar OTP.');
  }
  return res;
}

export async function downloadAadhaarXml(payload: { otp: string }): Promise<DownloadAadhaarXmlResponse> {
  const res = await apiPost<DownloadAadhaarXmlResponse>(
    '/auth/aadhaar/xml-download',
    payload,
    'Unable to verify Aadhaar OTP.',
  );
  if (!res) {
    throw new Error('Empty response from Aadhaar download.');
  }
  return res;
}
