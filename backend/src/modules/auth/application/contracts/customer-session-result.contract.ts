export type CustomerPortalLeadSnapshot = {
  uuid: string;
  status: string;
  email: string | null;
  emailVerified: boolean;
  /** ISO date-time until which the customer cannot reapply after rejection. `null` when not rejected. */
  rejectedUntil: string | null;
};

export type CustomerPortalProfileSnapshot = {
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

export type CustomerPortalJourneySnapshot = {
  /** Lead detail + consent are complete enough to proceed to pre-approved offer. */
  detailsCompleted: boolean;
  /** Customer has selected a loan amount + tenure (application_details populated). */
  loanSelectionCompleted: boolean;
  /** Customer has completed KYC (documents uploaded / verified). */
  kycCompleted: boolean;
  /** Customer has provided bank details (disbursement details). */
  bankDetailsCompleted: boolean;
};

export type CustomerSessionResult =
  | {
      authenticated: true;
      customerId: string;
      mobileNumber: string;
      lead: CustomerPortalLeadSnapshot | null;
      profile: CustomerPortalProfileSnapshot | null;
      journey: CustomerPortalJourneySnapshot;
    }
  | { authenticated: false };
