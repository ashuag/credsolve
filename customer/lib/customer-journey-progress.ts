import { isBankStepDoneForJourney, type CustomerSessionResponse } from '@/lib/api/customer-session';
import { isLoanDocumentsJourneyComplete } from '@/lib/loan-documents-journey';

/**
 * Customer portal journey progress steps (dashboard / account Overview).
 * Order matches `customer-journey-guard` + session flags, with Mobile as the auth gate
 * and Sanction OTP after references (`loanDocumentsAccepted` / acceptedAt).
 *
 * Aligned with LOS `APPLICATION_JOURNEY_STAGES` (customer-facing labels).
 * Thank-you is an outcome screen — not a progress dot.
 */
export const CUSTOMER_JOURNEY_PROGRESS_STEPS = [
  { key: 'mobile', label: 'Mobile verified', shortLabel: 'Mobile' },
  { key: 'details', label: 'Details', shortLabel: 'Details' },
  { key: 'loan', label: 'Loan selection', shortLabel: 'Loan' },
  { key: 'email', label: 'Email verification', shortLabel: 'Email' },
  { key: 'letter', label: 'Sanction letter review', shortLabel: 'Letter' },
  { key: 'digilockerKyc', label: 'DigiLocker KYC', shortLabel: 'Aadhaar' },
  { key: 'livenessKyc', label: 'Liveness KYC', shortLabel: 'Liveness' },
  { key: 'bank', label: 'Bank details', shortLabel: 'Bank' },
  { key: 'references', label: 'References', shortLabel: 'Refs' },
  { key: 'esign', label: 'eSign', shortLabel: 'eSign' },
] as const;

export type CustomerJourneyProgressStepKey =
  (typeof CUSTOMER_JOURNEY_PROGRESS_STEPS)[number]['key'];

export type CustomerJourneyStepState = 'done' | 'current' | 'todo';

export type CustomerJourneyProgressStep = {
  key: CustomerJourneyProgressStepKey;
  label: string;
  shortLabel: string;
  state: CustomerJourneyStepState;
};

export type CustomerJourneyProgress = {
  steps: CustomerJourneyProgressStep[];
  nextLabel: string;
  completed: number;
  total: number;
  percent: number;
};

/**
 * DigiLocker Aadhaar (and selfie when already captured) for the customer progress-dot.
 */
export function isCustomerDigilockerKycStepDone(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  if (!session || session.authenticated !== true) return false;
  if (session.journey.kycCompleted === true) return true;
  return Boolean(session.kycFaceProgress?.digilockerAadhaarCaptured);
}

/**
 * Liveness KYC progress-dot is done when the face pipeline has passed
 * (selfie quality + Aadhaar match + active liveness).
 */
export function isCustomerLivenessKycStepDone(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  if (!session || session.authenticated !== true) return false;
  if (session.journey.kycCompleted === true) return true;
  const kyc = session.kycFaceProgress;
  return Boolean(kyc?.livenessPassed && kyc.selfieCaptured);
}

/**
 * Full KYC is done when both DigiLocker + selfie/liveness are complete.
 */
export function isCustomerKycJourneyStepDone(
  session: CustomerSessionResponse | null | undefined,
): boolean {
  if (!session || session.authenticated !== true) return false;
  return session.journey.kycCompleted === true;
}

function completionFlags(
  session: CustomerSessionResponse | null | undefined,
): Record<CustomerJourneyProgressStepKey, boolean> {
  const authed = Boolean(session && session.authenticated === true);
  const j = authed && session && session.authenticated ? session.journey : null;
  const emailVerified = Boolean(
    authed && session && session.authenticated && session.lead?.emailVerified,
  );

  return {
    mobile: authed,
    details: Boolean(j?.detailsCompleted),
    loan: Boolean(j?.loanSelectionCompleted),
    email: emailVerified,
    letter: isLoanDocumentsJourneyComplete(session),
    digilockerKyc: isCustomerDigilockerKycStepDone(session),
    livenessKyc: isCustomerLivenessKycStepDone(session),
    bank: Boolean(j?.bankDetailsCompleted || (authed && isBankStepDoneForJourney(session))),
    references: Boolean(j?.referencesCompleted),
    esign: Boolean(j?.loanDocumentsAccepted),
  };
}

/** Builds done/current/todo steps + next-label for the account Overview journey card. */
export function buildCustomerJourneyProgress(
  session: CustomerSessionResponse | null | undefined,
): CustomerJourneyProgress {
  const total = CUSTOMER_JOURNEY_PROGRESS_STEPS.length;
  const flags = completionFlags(session);

  let foundCurrent = false;
  let completed = 0;
  const steps: CustomerJourneyProgressStep[] = CUSTOMER_JOURNEY_PROGRESS_STEPS.map((s) => {
    if (flags[s.key]) {
      completed += 1;
      return { ...s, state: 'done' as const };
    }
    if (!foundCurrent) {
      foundCurrent = true;
      return { ...s, state: 'current' as const };
    }
    return { ...s, state: 'todo' as const };
  });

  const next = steps.find((s) => s.state === 'current');
  const percent = Math.round((completed / total) * 100);

  return {
    steps,
    nextLabel: next ? next.label : 'All steps complete',
    completed,
    total,
    percent,
  };
}
