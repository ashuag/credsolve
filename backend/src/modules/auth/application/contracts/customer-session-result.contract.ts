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
  /** Key Fact Statement reviewed on /loan-documents (review-only; legal acceptance is eSign OTP). */
  loanDocumentsCompleted: boolean;
  /** Mobile OTP acceptance after references — signed sanctioned letter emailed. */
  loanDocumentsAccepted: boolean;
  /** Customer has completed KYC (documents uploaded / verified). */
  kycCompleted: boolean;
  /** Two personal references saved after bank details. */
  referencesCompleted: boolean;
  /** Customer has provided bank details on `application_detail`. */
  bankDetailsCompleted: boolean;
  /** Penny-drop succeeded but bank vs customer name is waiting for credit approval. */
  bankNameReviewPending: boolean;
  /**
   * Penny-drop retries were exhausted (application PENNYDROP_FAILED).
   * The customer can still finish references / eSign; a representative will call.
   */
  bankVerificationFailed: boolean;
};

/** DigiLocker Aadhaar + selfie/liveness progress for the active application. */
export type CustomerKycFaceProgressSnapshot = {
  /** `application.kyc_status` (0–3); `1` = completed. */
  applicationKycStatus: number;
  digilockerAadhaarCaptured: boolean;
  selfieCaptured: boolean;
  livenessPassed: boolean;
  livenessCheckCompleted: boolean;
  /** When `false`, face pipeline may be skipped (should stay `true` — Aadhaar face match is required). */
  livenessRequired: boolean;
  digilockerAadhaarForm: unknown | null;
  /** Path fragment for `GET {API}/auth/kyc/digilocker-aadhaar-photo` (cookie auth). */
  digilockerAadhaarPhotoUrl: string | null;
  /** Path fragment for `GET {API}/auth/kyc/selfie-photo` (cookie auth). */
  kycSelfiePhotoUrl: string | null;
  selfieUpdatedAt: string | null;
  /** Failed DigiLocker Aadhaar download attempts for the active lead. */
  digilockerAadhaarDownloadAttempts: number;
  digilockerAadhaarDownloadMaxAttempts: number;
  /** Failed KYC liveness / face-match runs so far. */
  livenessAttempts: number;
  /** Total allowed liveness runs before escalation to thank-you. */
  livenessMaxAttempts: number;
  /** When true, KYC stays open until a head-movement clip scores a pass. */
  headMovementRequired: boolean;
  /** Active liveness: a head-movement clip was uploaded and scored (pass or fail). */
  headMovementCaptured: boolean;
  headMovementPassed: boolean;
  /** 0–1 movement strength from the last recording; null when never recorded. */
  headMovementScore: number | null;
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
      /**
       * True when empty fields were filled from a recurring customer’s last repaid loan
       * (disbursed and CLOSED). Consent and PAN verification are never copied.
       */
      profilePrefillFromPriorApplication: boolean;
    }
  | { authenticated: false };
