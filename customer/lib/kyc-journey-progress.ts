import type { CustomerSessionResponse } from '@/lib/api/customer-session';
import { isCustomerPortalSignedIn } from '@/lib/api/customer-session';
import {
  buildCustomerJourneyProgress,
  CUSTOMER_JOURNEY_PROGRESS_STEPS,
} from '@/lib/customer-journey-progress';

/** Uppercase short labels for KYC left-rail dots — same 9 steps as Overview. */
export const KYC_JOURNEY_STEPS = CUSTOMER_JOURNEY_PROGRESS_STEPS.map((s) =>
  s.shortLabel.toUpperCase(),
);

const KYC_STEP_INDEX = CUSTOMER_JOURNEY_PROGRESS_STEPS.findIndex((s) => s.key === 'kyc');

/** Thin wrapper so KYC hub pages stay in sync with Overview %. */
export function kycJourneyProgressFromSession(session: CustomerSessionResponse | null | undefined): {
  progressPct: number;
  activeStepIndex: number;
} {
  const progress = buildCustomerJourneyProgress(session);
  if (!isCustomerPortalSignedIn(session)) {
    return {
      progressPct: 0,
      activeStepIndex: KYC_STEP_INDEX >= 0 ? KYC_STEP_INDEX : 5,
    };
  }

  const currentIdx = progress.steps.findIndex((s) => s.state === 'current');
  return {
    progressPct: progress.percent,
    activeStepIndex: currentIdx >= 0 ? currentIdx : progress.steps.length - 1,
  };
}
