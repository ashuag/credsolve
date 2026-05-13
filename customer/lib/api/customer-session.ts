import { apiGet } from './client';

/** Mirrors backend `CustomerSessionResult` (`GET /auth/me`). */
export type CustomerPortalProfile = {
  fullName: string | null;
  dob: string | null;
  panNumber: string | null;
  panVerified: boolean;
  panVerifiedAt: string | null;
  gender: 'male' | 'female' | 'others' | null;
  occupation:
    | 'salaried'
    | 'self_employed_professional'
    | 'self_employed_business'
    | 'student'
    | 'homemaker'
    | 'retired'
    | null;
  addressLine1: string | null;
  addressLine2: string | null;
  currentCity: string | null;
  pincode: string | null;
  monthlyIncome: string | null;
  annualTurnover: string | null;
  annualProfit: string | null;
  creditConsentAccepted: boolean;
};

export type CustomerPortalLead = {
  uuid: string;
  status: string;
  email: string | null;
  emailVerified: boolean;
  /** ISO date-time until which the customer cannot reapply after rejection. `null` when not rejected. */
  rejectedUntil: string | null;
};

export type CustomerSessionResponse =
  | {
      authenticated: true;
      customerId: string;
      mobileNumber: string;
      lead: CustomerPortalLead | null;
      profile: CustomerPortalProfile | null;
      journey: {
        detailsCompleted: boolean;
        loanSelectionCompleted: boolean;
        kycCompleted: boolean;
        bankDetailsCompleted: boolean;
      };
    }
  | { authenticated: false };

/** Same rule as the header: verified mobile session with an active cookie. */
export function isCustomerPortalSignedIn(
  session: CustomerSessionResponse | null | undefined
): session is Extract<CustomerSessionResponse, { authenticated: true }> {
  if (!session || session.authenticated !== true) return false;
  return typeof session.mobileNumber === 'string' && session.mobileNumber.trim().length > 0;
}

/** Header / account menu trigger: full name from profile when present, otherwise “Hi there”. */
export function getCustomerAccountMenuTriggerLabel(
  session: CustomerSessionResponse | null | undefined
): string {
  if (!session || session.authenticated !== true) return 'Hi there';
  const raw = session.profile?.fullName?.trim();
  if (!raw) return 'Hi there';
  return raw;
}

/** Customer has started a loan application (active lead exists after mobile OTP / onboarding). */
export function hasActiveLoanLead(session: CustomerSessionResponse | null | undefined): boolean {
  return Boolean(session && session.authenticated && session.lead != null);
}

/**
 * Returns the most relevant page to continue a signed-in customer's in-progress journey.
 */
/** Returns `true` when the lead is REJECTED or BLACKLISTED and the reapply window hasn't elapsed yet. */
export function isLeadRejectedAndLocked(lead: CustomerPortalLead | null | undefined): boolean {
  if (!lead) return false;
  if (lead.status !== 'REJECTED' && lead.status !== 'BLACKLISTED') return false;
  if (!lead.rejectedUntil) return false;
  return new Date(lead.rejectedUntil).getTime() > Date.now();
}

export function getCustomerJourneyResumePath(
  session: CustomerSessionResponse | null | undefined
): string {
  if (!session?.authenticated || !session.lead) {
    return '/my-account?mode=login';
  }

  if (isLeadRejectedAndLocked(session.lead)) {
    return '/thank-you-interest';
  }

  const journey = session.journey;
  if (!journey.detailsCompleted) return '/onboarding?mode=login';
  if (!journey.loanSelectionCompleted) return '/pre-approved-loan';
  if (!session.lead.emailVerified) return '/onboarding?mode=login';
  if (!journey.kycCompleted) return '/kyc/upload-documents';
  if (!journey.bankDetailsCompleted) return '/bank-details';
  return '/thank-you';
}

/** Coalesce concurrent `/auth/me` calls (e.g. React Strict Mode double mount). */
let sessionRequest: Promise<CustomerSessionResponse> | null = null;

export async function fetchCustomerSession(): Promise<CustomerSessionResponse> {
  if (!sessionRequest) {
    sessionRequest = (async (): Promise<CustomerSessionResponse> => {
      const data = await apiGet<CustomerSessionResponse>('/auth/me', 'Unable to load session.');
      if (!data) {
        return { authenticated: false };
      }
      return data;
    })().finally(() => {
      sessionRequest = null;
    });
  }
  return sessionRequest as Promise<CustomerSessionResponse>;
}
