import type { CustomerGenderValue, CustomerOccupationValue } from '../customer-details';
import type { PanVerificationStatus } from '../pan-verification';
import { ApiRequestError, apiGet, apiPost, apiPostFormData } from './client';

type SyncLeadEmailResponse = {
  success: boolean;
  leadUuid?: string;
};

type SaveLeadDetailsResponse = {
  success: boolean;
  leadUuid?: string;
};

/**
 * Secured sync: backend verifies `googleIdToken` with Google and stores the email on the lead.
 * (Email via OTP is handled by `POST /auth/verify-otp` with `type: email`.)
 */
export type SyncLeadEmailPayload = {
  leadUuid?: string;
  googleIdToken: string;
};

export type SaveLeadDetailsPayload = {
  leadUuid?: string;
  fullName: string;
  dob: string;
  gender: CustomerGenderValue;
  occupation: CustomerOccupationValue;
  addressLine1: string;
  addressLine2?: string;
  currentCity: string;
  /** When set, backend resolves city by id (from `GET /lookup/cities`). */
  currentCityId?: number;
  pincode: string;
  monthlyIncome?: string;
  annualTurnover?: string;
  annualProfit?: string;
  creditConsentAccepted: boolean;
  panNumber?: string;
};

export type VerifyLeadPanPayload = {
  leadUuid?: string;
  panNumber: string;
  fullName: string;
  dob: string;
  gender: CustomerGenderValue;
  occupation: CustomerOccupationValue;
  /** Required; stored as `lead_detail.cibil_consent_at` for bureau soft-pull after PAN. */
  creditConsentAccepted: boolean;
  monthlyIncome?: string;
  annualTurnover?: string;
  annualProfit?: string;
};

export type VerifyLeadPanResponse = {
  success: boolean;
  rejected?: boolean;
  message?: string;
  matched: boolean;
  panVerified: boolean;
  panVerifiedStatus?: number;
  vendorFullName: string | null;
  leadDetail?: {
    uuid: string;
    panNumber: string | null;
    fullName: string | null;
    dateOfBirth: string | null;
    panVerified: boolean;
    panVerifiedAt: string | null;
    /** Same as `lead.lead_status_note` after verify (PAN / policy). */
    leadStatusNote?: string | null;
  };
};

export type SaveApplicationDetailsPayload = {
  leadUuid?: string;
  fullName: string;
  gender: string;
  dob: string;
  panNumber: string;
  addressLine1: string;
  addressLine2?: string;
  currentCity: string;
  pincode: string;
};

export type SaveProfessionalDetailsPayload = {
  leadUuid?: string;
  occupation: CustomerOccupationValue;
  monthlyIncome?: string;
  annualTurnover?: string;
  annualProfit?: string;
};

type SaveApplicationStepResponse = {
  success: boolean;
  leadUuid?: string;
};

export type SaveApplicationDetailsResponse = {
  success: boolean;
  leadUuid?: string;
  panResult: { status: PanVerificationStatus };
};

export type CustomerLeadStatusResponse = {
  leadId?: string | null;
  leadStatus?: string | null;
};

/** Persists Google-verified email on the active lead (requires customer session cookie). */
export async function syncLeadEmail(payload: SyncLeadEmailPayload): Promise<SyncLeadEmailResponse> {
  return (
    (await apiPost<SyncLeadEmailResponse>(
      '/leads/email',
      payload,
      'Unable to save your email right now. Please try again.'
    )) ?? { success: true, leadUuid: payload.leadUuid }
  );
}

export async function saveLeadDetails(payload: SaveLeadDetailsPayload): Promise<SaveLeadDetailsResponse> {
  /** Prefer `/auth/lead-details`: same Nest handler as `/leads/details`, works if only `/api/auth/*` is proxied. */
  return (await apiPost<SaveLeadDetailsResponse>(
    '/auth/lead-details',
    payload,
    'Unable to save your details right now. Please try again.'
  )) ?? { success: true };
}

/** Tenacio `pan-name-dob` — runs before the address step; sets `pan_verified` when name matches. */
export async function verifyLeadPan(payload: VerifyLeadPanPayload): Promise<VerifyLeadPanResponse> {
  return (
    (await apiPost<VerifyLeadPanResponse>(
      '/auth/verify-pan',
      payload,
      'Unable to verify your PAN right now. Please try again.'
    )) ?? {
      success: false,
      matched: false,
      panVerified: false,
      vendorFullName: null,
    }
  );
}

export async function getCustomerLeadStatus(): Promise<CustomerLeadStatusResponse | null> {
  try {
    return await apiGet<CustomerLeadStatusResponse>(
      '/leads/status',
      'Unable to load your application status right now.'
    );
  } catch (e) {
    if (e instanceof ApiRequestError && (e.statusCode === 404 || e.statusCode === 405 || e.statusCode === 501)) {
      return null;
    }
    throw e;
  }
}

export type SaveProfessionalDetailsResponse = {
  success: boolean;
  leadUuid?: string;
  eligible: boolean;
  approvedAmount: number | null;
  cibilScore: number | null;
};

export type SaveLoanSelectionPayload = {
  loanAmount: number;
  tenureEndDate: string; // YYYY-MM-DD
  loanPurpose?: string;
};

export type SaveKycDocumentsPayload = {
  panNumber?: string;
  aadhaarNumber?: string;
  panDocument: File;
  aadhaarFront: File;
  aadhaarBack: File;
};

export type SaveBankDetailsPayload = {
  accountNumber: string;
  ifscCode: string;
  bankName?: string;
  verifiedBankName?: string;
};

export type IfscLookupResponse = {
  configured: boolean;
  skipReason?: string;
  ok: boolean;
  httpStatus: number | null;
  details: Record<string, unknown> | null;
  vendor: unknown | null;
};

export async function lookupBankIfsc(ifscNumber: string): Promise<IfscLookupResponse | null> {
  return apiPost<IfscLookupResponse>(
    '/applications/bank/ifsc-lookup',
    { ifscNumber: ifscNumber.trim().toUpperCase() },
    'Unable to look up IFSC.',
    { timeoutMs: 30_000 },
  );
}

export type SubmitVerifiedBankResponse = {
  success: boolean;
  pennyDropOk: boolean;
  applicationStatus: string | null;
  message?: string;
  vendor?: unknown;
};

export async function submitVerifiedBankDetails(payload: {
  accountNumber: string;
  ifscCode: string;
  verifiedBankName?: string;
}): Promise<SubmitVerifiedBankResponse | null> {
  return apiPost<SubmitVerifiedBankResponse>(
    '/applications/bank/submit-verified',
    {
      accountNumber: payload.accountNumber.replace(/\D/g, ''),
      ifscCode: payload.ifscCode.trim().toUpperCase(),
      ...(payload.verifiedBankName?.trim()
        ? { verifiedBankName: payload.verifiedBankName.trim() }
        : {}),
    },
    'Unable to verify bank account.',
    { timeoutMs: 60_000 },
  );
}

export type LoanBanksResponse = {
  banks: string[];
};

export async function saveProfessionalDetails(payload: SaveProfessionalDetailsPayload): Promise<SaveProfessionalDetailsResponse> {
  return (await apiPost<SaveProfessionalDetailsResponse>(
    '/applications/professional-details',
    payload,
    'Unable to save your details right now. Please try again.'
  )) ?? { success: true, eligible: false, approvedAmount: null, cibilScore: null };
}

export async function saveApplicationDetails(payload: SaveApplicationDetailsPayload): Promise<SaveApplicationDetailsResponse> {
  return (await apiPost<SaveApplicationDetailsResponse>(
    '/applications/details',
    payload,
    'Unable to save your details right now. Please try again.'
  )) ?? { success: true, panResult: { status: 'bureau_error' } };
}

export async function saveLoanSelection(payload: SaveLoanSelectionPayload): Promise<{ success: boolean }> {
  return (
    (await apiPost<{ success: boolean }>(
      '/applications/selection',
      payload,
      'Unable to save loan selection right now. Please try again.'
    )) ?? { success: true }
  );
}

export async function saveKycDocuments(payload: SaveKycDocumentsPayload): Promise<{ success: boolean }> {
  const formData = new FormData();
  if (payload.panNumber) formData.set('panNumber', payload.panNumber);
  if (payload.aadhaarNumber) formData.set('aadhaarNumber', payload.aadhaarNumber);
  formData.set('panDocument', payload.panDocument);
  formData.set('aadhaarFront', payload.aadhaarFront);
  formData.set('aadhaarBack', payload.aadhaarBack);

  return (
    (await apiPostFormData<{ success: boolean }>(
      '/applications/kyc/documents',
      formData,
      'Unable to save KYC documents right now. Please try again.'
    )) ?? { success: true }
  );
}

export async function saveBankDetails(payload: SaveBankDetailsPayload): Promise<{ success: boolean }> {
  return (
    (await apiPost<{ success: boolean }>(
      '/applications/bank-details',
      payload,
      'Unable to save bank details right now. Please try again.'
    )) ?? { success: true }
  );
}

export async function getLoanBanks(): Promise<string[]> {
  const response = await apiGet<LoanBanksResponse>(
    '/loans/banks',
    'Unable to load bank list right now. Please try again.'
  );

  return response?.banks ?? [];
}
