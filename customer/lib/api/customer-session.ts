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
    }
  | { authenticated: false };

export async function fetchCustomerSession(): Promise<CustomerSessionResponse> {
  const data = await apiGet<CustomerSessionResponse>('/auth/me', 'Unable to load session.');
  if (!data) {
    return { authenticated: false };
  }
  return data;
}
