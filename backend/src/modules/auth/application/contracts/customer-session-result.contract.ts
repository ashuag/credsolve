import type { GenderKey } from '../../../../common/constants/gender.constants';
import type { OccupationKey } from '../../../../common/constants/occupation.constants';

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
  gender: GenderKey | null;
  occupation: OccupationKey | null;
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
  /** Customer has selected a loan amount + tenure (`application_detail` populated). */
  loanSelectionCompleted: boolean;
  /** Key Fact Statement reviewed/agreed on /loan-documents (no OTP). */
  loanDocumentsCompleted: boolean;
  /** Mobile OTP acceptance after references — signed sanctioned letter emailed. */
  loanDocumentsAccepted: boolean;
  /** Customer has completed KYC (documents uploaded / verified). */
  kycCompleted: boolean;
  /** Two personal references saved after bank details. */
  referencesCompleted: boolean;
  /** Customer has provided bank details on `application_detail`. */
  bankDetailsCompleted: boolean;
};

/** DigiLocker Aadhaar progress for the active application (selfie/liveness stubs retained for older clients). */
export type CustomerKycFaceProgressSnapshot = {
  /** `application.kyc_status` (0–3); `1` = completed. */
  applicationKycStatus: number;
  digilockerAadhaarCaptured: boolean;
  /** @deprecated Selfie/liveness removed pending rewrite. */
  selfieCaptured: boolean;
  /** @deprecated Selfie/liveness removed pending rewrite. */
  livenessPassed: boolean;
  /** @deprecated Selfie/liveness removed pending rewrite. */
  livenessCheckCompleted: boolean;
  /** @deprecated Selfie/liveness removed pending rewrite. Always `false` until rewrite. */
  livenessRequired: boolean;
  digilockerAadhaarForm: unknown | null;
  /** Path fragment for `GET {API}/auth/kyc/digilocker-aadhaar-photo` (cookie auth). */
  digilockerAadhaarPhotoUrl: string | null;
  /** @deprecated Selfie endpoint removed. */
  kycSelfiePhotoUrl: string | null;
  /** @deprecated Selfie/liveness removed pending rewrite. */
  selfieUpdatedAt: string | null;
  /** Failed DigiLocker Aadhaar download attempts for the active lead. */
  digilockerAadhaarDownloadAttempts: number;
  digilockerAadhaarDownloadMaxAttempts: number;
  /** @deprecated Selfie/liveness removed pending rewrite. */
  livenessAttempts: number;
  /** @deprecated Selfie/liveness removed pending rewrite. */
  livenessMaxAttempts: number;
};

export type CustomerLoanSelectionSnapshot = {
  /** Selected principal in INR (decimal string). */
  amountInr: string | null;
  tenureDays: number | null;
  /** ISO date-only for maturity when set. */
  maturityDate: string | null;
};

/** Saved personal reference (`application_reference` row). */
export type CustomerLeadReferenceSnapshot = {
  referenceIndex: number;
  fullName: string;
  mobileNumber: string;
  relationId: number;
};

/** Penny-drop verification attempts for the active application (bank-details step). */
export type CustomerBankVerificationProgressSnapshot = {
  attemptsUsed: number;
  attemptsAllowed: number;
  retryLimitReached: boolean;
};

export type CustomerSessionResult =
  | {
      authenticated: true;
      customerId: string;
      mobileNumber: string;
      lead: CustomerPortalLeadSnapshot | null;
      profile: CustomerPortalProfileSnapshot | null;
      journey: CustomerPortalJourneySnapshot;
      /**
       * Pre-approved ceiling from post-BRE (`application.pre_approved_loan_amount`).
       * Present after bureau pass; used by `/pre-approved-loan` without a second eligibility call.
       */
      preApprovedAmountInr: number | null;
      /** Populated when the customer has saved loan amount / tenure on the application. */
      loanSelection: CustomerLoanSelectionSnapshot | null;
      /** Saved lead references for form prepopulation; empty array when none. */
      leadReferences: CustomerLeadReferenceSnapshot[];
      /** Active application DigiLocker / selfie / liveness state; `null` without an application row. */
      kycFaceProgress: CustomerKycFaceProgressSnapshot | null;
      /** Penny-drop attempt counters while bank details are pending; `null` when not applicable. */
      bankVerificationProgress: CustomerBankVerificationProgressSnapshot | null;
      /**
       * True when the customer has an ACTIVE/OVERDUE loan account.
       * Blocks starting another application until the loan is CLOSED.
       */
      hasOpenLoan: boolean;
    }
  | { authenticated: false };
