import { isLoanDocumentsJourneyComplete } from '../loan-documents-journey';
import { CUSTOMER_LEAD_STATUS } from '../lead-status';
import { apiGet } from './client';

/** Mirrors backend `CustomerSessionResult` (`GET /auth/me`). */
export type CustomerPortalProfile = {
  fullName: string | null;
  dob: string | null;
  panNumber: string | null;
  panVerified: boolean;
  panVerifiedAt: string | null;
  gender: string | null;
  occupation: string | null;
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

/** Mirrors backend `CustomerLoanSelectionSnapshot` (`GET /auth/me`). */
export type CustomerLoanSelectionSnapshot = {
  amountInr: string | null;
  tenureDays: number | null;
  maturityDate: string | null;
};

/** Mirrors backend `CustomerLeadReferenceSnapshot` (`GET /auth/me`). */
export type CustomerLeadReferenceSnapshot = {
  referenceIndex: number;
  fullName: string;
  mobileNumber: string;
  relationId: number;
};

export type CustomerKycFaceProgress = {
  applicationKycStatus: number;
  digilockerAadhaarCaptured: boolean;
  selfieCaptured?: boolean;
  livenessPassed?: boolean;
  livenessCheckCompleted?: boolean;
  livenessRequired?: boolean;
  digilockerAadhaarForm: unknown | null;
  digilockerAadhaarPhotoUrl: string | null;
  kycSelfiePhotoUrl?: string | null;
  selfieUpdatedAt?: string | null;
  digilockerAadhaarDownloadAttempts?: number;
  digilockerAadhaarDownloadMaxAttempts?: number;
  livenessAttempts?: number;
  livenessMaxAttempts?: number;
};

export type CustomerBankVerificationProgress = {
  attemptsUsed: number;
  attemptsAllowed: number;
  retryLimitReached: boolean;
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
        loanDocumentsCompleted: boolean;
        /** True after post-references mobile OTP (sanctioned letter emailed). */
        loanDocumentsAccepted: boolean;
        kycCompleted: boolean;
        referencesCompleted: boolean;
        bankDetailsCompleted: boolean;
      };
      /** Post-BRE pre-approved ceiling; set after bureau pass. */
      preApprovedAmountInr: number | null;
      loanSelection: CustomerLoanSelectionSnapshot | null;
      leadReferences: CustomerLeadReferenceSnapshot[];
      kycFaceProgress: CustomerKycFaceProgress | null;
      bankVerificationProgress: CustomerBankVerificationProgress | null;
      /** True when an ACTIVE/OVERDUE loan exists — customer cannot start another application. */
      hasOpenLoan: boolean;
    }
  | { authenticated: false };

/** Email entry + OTP during the loan journey (after loan selection). */
export const CUSTOMER_EMAIL_JOURNEY_PATH = '/email-verify';

/** Returning-user login via email (`?mode=login`). */
export const CUSTOMER_EMAIL_VERIFY_PATH = '/email-verify?mode=login';

/**
 * Next route after successful email OTP in an active loan application.
 * Order: email → email OTP → loan agreement → KYC → bank → references.
 */
export function getPostEmailVerificationPath(
  session: CustomerSessionResponse | null | undefined,
): string {
  if (!session?.authenticated || !session.lead) {
    return '/apply-for-loan';
  }
  if (!session.lead.emailVerified) {
    return CUSTOMER_EMAIL_JOURNEY_PATH;
  }
  if (!isLoanDocumentsJourneyComplete(session)) {
    return '/loan-documents';
  }
  return getCustomerJourneyResumePath(session);
}

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

/** Active lead escalated for vendor / internal processing failure (e.g. Tenacio `api 505`). */
export function isInternalErrorLead(
  lead: CustomerPortalLead | null | undefined,
  leadStatusHint?: string | null,
): boolean {
  const status = (lead?.status ?? leadStatusHint ?? '').trim();
  return status === CUSTOMER_LEAD_STATUS.INTERNAL_ERROR;
}

/** Entry route for the KYC stage (DigiLocker / docs hub). Selfie/liveness removed pending rewrite. */
export function resolveKycStagePath(
  _session?: CustomerSessionResponse | null,
): string {
  return '/kyc';
}

/**
 * After DigiLocker / vendor INTERNAL_ERROR, resume KYC hub when DigiLocker is still incomplete.
 * Selfie/liveness resume paths removed pending rewrite.
 */
export function canResumeKycAfterInternalError(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  if (!session?.authenticated || !session.lead) return false;
  if (!isInternalErrorLead(session.lead)) return false;
  const kyc = session.kycFaceProgress;
  return !kyc?.digilockerAadhaarCaptured;
}

/** Returns `true` when the lead is REJECTED or BLACKLISTED and the reapply window hasn't elapsed yet. */
export function isLeadRejectedAndLocked(lead: CustomerPortalLead | null | undefined): boolean {
  if (!lead) return false;
  if (lead.status !== 'REJECTED' && lead.status !== 'BLACKLISTED') return false;
  if (!lead.rejectedUntil) return false;
  return new Date(lead.rejectedUntil).getTime() > Date.now();
}

/** True when the customer still has loan-application steps left (hub should show "Complete your journey"). */
export function isCustomerJourneyIncomplete(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  if (!session?.authenticated) return false;
  if (session.hasOpenLoan) return false;
  if (!session.lead) return true;
  if (isLeadRejectedAndLocked(session.lead)) return false;
  const j = session.journey;
  return !(
    j.detailsCompleted &&
    j.loanSelectionCompleted &&
    j.loanDocumentsCompleted &&
    j.kycCompleted &&
    j.bankDetailsCompleted &&
    j.referencesCompleted &&
    j.loanDocumentsAccepted
  );
}

/** Customer already has an ACTIVE/OVERDUE loan and cannot apply again yet. */
export function hasOpenCustomerLoan(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  return Boolean(session && session.authenticated && session.hasOpenLoan);
}

/**
 * Returns the most relevant page to continue a signed-in customer's in-progress journey.
 */
export function getCustomerJourneyResumePath(
  session: CustomerSessionResponse | null | undefined
): string {
  if (!session?.authenticated) {
    return '/my-account?mode=login';
  }

  if (session.hasOpenLoan) {
    return '/active-loan';
  }

  if (!session.lead) {
    return '/my-account';
  }

  if (isLeadRejectedAndLocked(session.lead)) {
    return '/thank-you-interest';
  }

  if (isInternalErrorLead(session.lead)) {
    if (canResumeKycAfterInternalError(session)) return '/kyc';
    return '/thank-you';
  }

  const journey = session.journey;
  if (!journey.detailsCompleted) return '/onboarding?mode=login';
  if (!journey.loanSelectionCompleted) return '/pre-approved-loan';
  if (!session.lead.emailVerified) return CUSTOMER_EMAIL_JOURNEY_PATH;
  if (!isLoanDocumentsJourneyComplete(session)) return '/loan-documents';

  if (!journey.kycCompleted) return resolveKycStagePath(session);
  if (!journey.bankDetailsCompleted) return '/bank-details';
  if (!journey.referencesCompleted || !journey.loanDocumentsAccepted) return '/references';
  return '/thank-you';
}

/** True when post-OTP should open the account hub (My Account login), not resume apply flow. */
function isAccountHubFallback(path: string): boolean {
  const base = path.split('?')[0] ?? path;
  return base === '/my-account' || base === '/dashboard';
}

/**
 * When `/auth/me` is not ready yet (cookie race right after verify-otp), route from the
 * lead status returned by verify-otp itself.
 */
function resumePathFromOtpLeadStatus(otpLeadStatus: string): string | null {
  const status = otpLeadStatus.trim();
  if (status === CUSTOMER_LEAD_STATUS.INTERNAL_ERROR) return '/thank-you';
  if (status === CUSTOMER_LEAD_STATUS.REJECTED || status === CUSTOMER_LEAD_STATUS.BLACKLISTED) {
    return '/thank-you-interest';
  }
  if (status === CUSTOMER_LEAD_STATUS.NEW) return '/onboarding?mode=register';
  // CONVERTED (post-BRE) and IN_PROGRESS — offer page refreshes session and continues.
  if (status === CUSTOMER_LEAD_STATUS.CONVERTED || status === CUSTOMER_LEAD_STATUS.IN_PROGRESS) {
    return '/pre-approved-loan';
  }
  return null;
}

/**
 * After mobile OTP: resume an in-flight application (including `INTERNAL_ERROR` → thank-you),
 * or fall back to the account hub when there is no active lead.
 *
 * My Account login (`accountHubFallback` = `/my-account`) must keep rejected / KYC-failed
 * customers on the hub. Sending them to `/thank-you-interest` logs them out and loops them
 * back to the login screen.
 *
 * Prefer `otpLeadStatus` from verify-otp when the session cookie is not visible to `/auth/me` yet.
 */
export function getCustomerPostMobileOtpRedirectPath(
  session: CustomerSessionResponse | null | undefined,
  accountHubFallback = '/my-account',
  otpLeadStatus?: string | null,
): string {
  const lead = session && session.authenticated ? session.lead : null;
  const statusHint = (lead?.status ?? otpLeadStatus ?? '').trim();

  if (session?.authenticated && session.hasOpenLoan) {
    return isAccountHubFallback(accountHubFallback) ? accountHubFallback : '/active-loan';
  }

  if (isInternalErrorLead(lead, otpLeadStatus)) {
    if (canResumeKycAfterInternalError(session)) return '/kyc';
    return '/thank-you';
  }

  if (session?.authenticated && lead) {
    if (isLeadRejectedAndLocked(lead)) {
      if (isAccountHubFallback(accountHubFallback)) {
        return accountHubFallback;
      }
      return '/thank-you-interest';
    }
    return getCustomerJourneyResumePath(session);
  }

  // Session missing or lead not loaded yet — trust verify-otp lead status.
  const fromOtp = statusHint ? resumePathFromOtpLeadStatus(statusHint) : null;
  if (fromOtp) {
    if (
      fromOtp === '/thank-you-interest' &&
      isAccountHubFallback(accountHubFallback)
    ) {
      return accountHubFallback;
    }
    return fromOtp;
  }

  if (session?.authenticated) {
    return accountHubFallback;
  }

  return '/my-account?mode=login';
}

/**
 * After Google OAuth or email verification, continue the loan journey (including `/kyc` / DigiLocker).
 * Avoids legacy `/account` routing for `IN_PROGRESS` leads.
 */
export function getCustomerPostAuthResumePath(
  session: CustomerSessionResponse,
  onboardingMode: 'register' | 'login' = 'login'
): string {
  if (!session.authenticated) {
    return '/my-account?mode=login';
  }
  if (session.hasOpenLoan) {
    return '/active-loan';
  }
  if (session.lead && isLeadRejectedAndLocked(session.lead)) {
    return '/thank-you-interest';
  }
  if (session.lead?.status === CUSTOMER_LEAD_STATUS.NEW) {
    return `/onboarding?mode=${onboardingMode}`;
  }
  if (session.lead) {
    return getCustomerJourneyResumePath(session);
  }
  return '/my-account?mode=login';
}

/**
 * After DigiLocker Aadhaar fetch, always return to the KYC hub.
 * DigiLocker is one KYC step — do not jump ahead to bank details while KYC may still expand.
 */
export function getPostDigilockerAadhaarContinuePath(
  _session: Extract<CustomerSessionResponse, { authenticated: true }>
): string {
  return '/kyc';
}

/** Back navigation from the KYC hub (avoid `getCustomerJourneyResumePath` looping to `/kyc`). */
export function getKycHubBackPath(session: Extract<CustomerSessionResponse, { authenticated: true }>): string {
  const j = session.journey;
  const emailVerified = session.lead?.emailVerified ?? false;
  if (!j.detailsCompleted) return '/apply-for-loan';
  if (!j.loanSelectionCompleted) return '/pre-approved-loan';
  if (!emailVerified) return CUSTOMER_EMAIL_JOURNEY_PATH;
  if (!isLoanDocumentsJourneyComplete(session)) return '/loan-documents';
  return CUSTOMER_EMAIL_JOURNEY_PATH;
}

/** Coalesce concurrent `/auth/me` calls (e.g. React Strict Mode double mount). */
let sessionRequest: Promise<CustomerSessionResponse> | null = null;
/** Bumped on each `force` fetch so `finally` only clears the latest in-flight request. */
let sessionRequestGeneration = 0;

export type FetchCustomerSessionOptions = {
  /** When true, always hits `/auth/me` (e.g. after saving references before thank-you). */
  force?: boolean;
};

export async function fetchCustomerSession(
  options?: FetchCustomerSessionOptions,
): Promise<CustomerSessionResponse> {
  if (options?.force) {
    sessionRequest = null;
    sessionRequestGeneration += 1;
  }
  const generation = sessionRequestGeneration;

  if (!sessionRequest) {
    sessionRequest = (async (): Promise<CustomerSessionResponse> => {
      const data = await apiGet<CustomerSessionResponse>('/auth/me', 'Unable to load session.');
      if (!data) {
        return { authenticated: false };
      }
      return data;
    })().finally(() => {
      if (sessionRequestGeneration === generation) {
        sessionRequest = null;
      }
    });
  }
  return sessionRequest as Promise<CustomerSessionResponse>;
}
