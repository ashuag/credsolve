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
  /** Key Fact Statement + Loan Agreement accepted (mobile OTP) before KYC. */
  loanDocumentsCompleted: boolean;
  /** Customer has completed KYC (documents uploaded / verified). */
  kycCompleted: boolean;
  /** Two personal references saved before bank details. */
  referencesCompleted: boolean;
  /** Customer has provided bank details (disbursement details). */
  bankDetailsCompleted: boolean;
};

/** DigiLocker Aadhaar + selfie + Tenacio liveness progress for the active application. */
export type CustomerKycFaceProgressSnapshot = {
  /** `application.kyc_status` (0–3); `1` = completed. */
  applicationKycStatus: number;
  digilockerAadhaarCaptured: boolean;
  selfieCaptured: boolean;
  livenessPassed: boolean;
  /**
   * When `false`, the journey does not require `POST .../kyc/liveness` (outbound Tenacio liveness skipped:
   * `KYC_LIVENESS_PAUSED`, `TENACIO_LIVENESS_DISABLED`, or no configured liveness POST URL / service).
   * Omitted only in older clients; server always sends a boolean.
   */
  livenessRequired: boolean;
  digilockerAadhaarForm: unknown | null;
  /** Path fragment for `GET {API}/auth/kyc/digilocker-aadhaar-photo` (cookie auth). */
  digilockerAadhaarPhotoUrl: string | null;
  /** Path fragment for `GET {API}/auth/kyc/selfie-photo` when a selfie file exists. */
  kycSelfiePhotoUrl: string | null;
};

export type CustomerLoanSelectionSnapshot = {
  /** Selected principal in INR (decimal string). */
  amountInr: string | null;
  tenureDays: number | null;
  /** ISO date-only for maturity when set. */
  maturityDate: string | null;
};

export type CustomerSessionResult =
  | {
      authenticated: true;
      customerId: string;
      mobileNumber: string;
      lead: CustomerPortalLeadSnapshot | null;
      profile: CustomerPortalProfileSnapshot | null;
      journey: CustomerPortalJourneySnapshot;
      /** Populated when the customer has saved loan amount / tenure on the application. */
      loanSelection: CustomerLoanSelectionSnapshot | null;
      /** Active application DigiLocker / selfie / liveness state; `null` without an application row. */
      kycFaceProgress: CustomerKycFaceProgressSnapshot | null;
    }
  | { authenticated: false };
