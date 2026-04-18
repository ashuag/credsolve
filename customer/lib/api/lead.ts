import type { CustomerGenderValue, CustomerOccupationValue } from '../customer-details';
import type { PanVerificationStatus } from '../pan-verification';
import { ApiRequestError, apiGet, apiPost } from './client';

type SyncLeadEmailResponse = {
  success: boolean;
  leadUuid?: string;
};

type SaveLeadDetailsResponse = {
  success: boolean;
  leadUuid?: string;
};

export type SyncLeadEmailPayload = {
  leadUuid?: string;
  email: string;
  emailVerified: boolean;
  verificationType?: 'otp' | 'google';
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
  pincode: string;
  monthlyIncome?: string;
  annualTurnover?: string;
  annualProfit?: string;
  creditConsentAccepted: boolean;
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

/**
 * Syncs lead email to the API when the route exists.
 * If the backend has not implemented `/leads/email` yet, fails open so OTP-first flows still work.
 */
export async function syncLeadEmail(payload: SyncLeadEmailPayload): Promise<SyncLeadEmailResponse> {
  try {
    return (
      (await apiPost<SyncLeadEmailResponse>('/leads/email', payload, 'Unable to save your email right now. Please try again.')) ?? {
        success: true,
        leadUuid: payload.leadUuid
      }
    );
  } catch (e) {
    if (e instanceof ApiRequestError && (e.statusCode === 404 || e.statusCode === 405 || e.statusCode === 501)) {
      return { success: true, leadUuid: payload.leadUuid };
    }
    throw e;
  }
}

export async function saveLeadDetails(payload: SaveLeadDetailsPayload): Promise<SaveLeadDetailsResponse> {
  return (await apiPost<SaveLeadDetailsResponse>(
    '/leads/details',
    payload,
    'Unable to save your details right now. Please try again.'
  )) ?? { success: true };
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
