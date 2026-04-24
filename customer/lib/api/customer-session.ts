import { apiGet } from './client';

/** Mirrors backend `CustomerSessionResult` (`GET /auth/me`). */
export type CustomerPortalProfile = {
  fullName: string | null;
  dob: string | null;
  panNumber: string | null;
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

/** Customer has started a loan application (active lead exists after mobile OTP / onboarding). */
export function hasActiveLoanLead(session: CustomerSessionResponse | null | undefined): boolean {
  return Boolean(session && session.authenticated && session.lead != null);
}

/**
 * Returns the most relevant page to continue a signed-in customer's in-progress journey.
 */
export function getCustomerJourneyResumePath(
  session: CustomerSessionResponse | null | undefined
): string {
  if (!session?.authenticated || !session.lead) {
    return '/my-account?mode=login';
  }

  const journey = session.journey;
  if (!journey.detailsCompleted) return '/onboarding?mode=login';
  if (!journey.loanSelectionCompleted) return '/pre-approved-loan';
  if (!journey.kycCompleted) return '/kyc/upload-documents';
  if (!journey.bankDetailsCompleted) return '/bank-details';
  return '/thank-you';
}

export async function fetchCustomerSession(): Promise<CustomerSessionResponse> {
  const data = await apiGet<CustomerSessionResponse>('/auth/me', 'Unable to load session.');
  if (!data) {
    return { authenticated: false };
  }
  return data;
}
