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
      return '/account';
    case CUSTOMER_LEAD_STATUS.CONVERTED:
      return '/my-account';
    default:
      return '/my-account';
  }
}
