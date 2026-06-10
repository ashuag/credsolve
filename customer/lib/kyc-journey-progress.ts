import type { CustomerSessionResponse } from '@/lib/api/customer-session';
import { isCustomerPortalSignedIn } from '@/lib/api/customer-session';

export const KYC_JOURNEY_STEPS = ['PROFILE', 'APPLY', 'REFS', 'EMAIL', 'LETTER', 'KYC', 'BANK'] as const;

export function milestonesCompleted(session: CustomerSessionResponse | null | undefined): number {
  if (!session || session.authenticated !== true) return 0;
  const j = session.journey;
  const emailVerified = session.lead?.emailVerified ?? false;
  let m = 1;
  if (j.detailsCompleted) m++;
  if (j.loanSelectionCompleted) m++;
  if (j.referencesCompleted) m++;
  if (emailVerified) m++;
  if (j.loanDocumentsCompleted) m++;
  if (j.kycCompleted) m++;
  if (j.bankDetailsCompleted) m++;
  return Math.min(KYC_JOURNEY_STEPS.length, m);
}

export function kycProgressPercent(milestones: number): number {
  const stepPct = 100 / KYC_JOURNEY_STEPS.length;
  return Math.min(100, Math.max(0, Math.round(milestones * stepPct)));
}

export function stepIndexFromMilestones(milestones: number): number {
  if (milestones <= 0) return 0;
  return Math.min(KYC_JOURNEY_STEPS.length - 1, milestones - 1);
}

export function kycJourneyProgressFromSession(session: CustomerSessionResponse | null | undefined): {
  progressPct: number;
  activeStepIndex: number;
} {
  const m = milestonesCompleted(session);
  const idx = isCustomerPortalSignedIn(session) ? stepIndexFromMilestones(m) : 5;
  return { progressPct: kycProgressPercent(m), activeStepIndex: idx };
}
