import { getApiUrl } from '../api-url';
import { apiGet, apiPost } from './client';

export type LoanDocumentType = 'key-fact' | 'loan-agreement';

export type LoanDocumentItem = {
  type: LoanDocumentType;
  title: string;
  pdfUrl: string;
};

export type LoanDocumentsResponse = {
  accepted: boolean;
  acceptedAt: string | null;
  documents: LoanDocumentItem[];
};

export type SendLoanDocumentsOtpResponse = {
  requestId: string;
  maskedMobile: string;
  resendAfterSeconds: number;
  resendAvailableAt: string;
  expiresAt: string;
  debugOtp?: string;
};

export async function fetchLoanDocuments(): Promise<LoanDocumentsResponse> {
  const data = await apiGet<LoanDocumentsResponse>(
    '/auth/loan-documents',
    'Unable to load loan documents.',
  );
  if (!data) {
    throw new Error('Unable to load loan documents.');
  }
  return data;
}

export function loanDocumentPdfAbsoluteUrl(pdfUrlFragment: string): string {
  const fragment = pdfUrlFragment.trim();
  if (!fragment) return '';

  // In browser, keep PDF fetch same-origin through Next `/api` rewrite so session cookies are sent reliably.
  if (typeof window !== 'undefined' && fragment.startsWith('/')) {
    return `/api${fragment}`;
  }

  return `${getApiUrl()}${fragment}`;
}

export async function sendLoanDocumentsOtp(): Promise<SendLoanDocumentsOtpResponse> {
  const data = await apiPost<SendLoanDocumentsOtpResponse>(
    '/auth/loan-documents/send-otp',
    {},
    'Unable to send OTP right now.',
    { timeoutMs: 60_000 },
  );
  if (!data) {
    throw new Error('Unable to send OTP right now.');
  }
  return data;
}

export async function acceptLoanDocuments(requestId: string, otpCode: string) {
  const data = await apiPost<{ success: boolean; acceptedAt: string }>(
    '/auth/loan-documents/accept',
    { requestId, otpCode },
    'Unable to verify OTP.',
  );
  if (!data) {
    throw new Error('Unable to verify OTP.');
  }
  return data;
}
