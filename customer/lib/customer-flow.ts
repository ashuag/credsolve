import { CUSTOMER_LEAD_STATUS } from './lead-status';

export type CustomerOnboardingMode = 'register' | 'login';

export function resolveCustomerFlowPath(
  leadStatus: string | null | undefined,
  onboardingMode: CustomerOnboardingMode = 'register'
): string {
  switch (leadStatus) {
    case CUSTOMER_LEAD_STATUS.NEW:
      return `/onboarding?mode=${onboardingMode}`;
    case CUSTOMER_LEAD_STATUS.IN_PROGRESS:
    case CUSTOMER_LEAD_STATUS.CONVERTED:
      // Prefer `getCustomerJourneyResumePath` when you have a full session.
      // CONVERTED after post-BRE still needs pre-approved offer / loan selection.
      return '/pre-approved-loan';
    default:
      return '/my-account';
  }
}
