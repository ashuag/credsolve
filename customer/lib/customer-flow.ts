import type { CustomerProfile } from './customer-auth';
import type { CustomerLeadStatusResponse } from './api/lead';
import type { CustomerOnboardingMode } from './stores/customer-onboarding-store';
import { updateCustomerOnboardingState } from './stores/customer-onboarding-store';

export function resolveCustomerFlowPath(
  leadStatus: string | null | undefined,
  onboardingMode: CustomerOnboardingMode = 'register'
): string {
  switch (leadStatus) {
    case 'NEW':
      return `/onboarding?mode=${onboardingMode}`;
    case 'EMAIL_VERIFIED':
      return '/account';
    case 'DETAIL_STARTED':
      return '/account/professional';
    case 'SUBMITTED':
      return '/my-account';
    case 'CONVERTED':
      return '/my-account';
    default:
      return '/my-account';
  }
}

export function syncCustomerOnboardingStateFromProfile(profile: CustomerProfile): void {
  if (profile.mobileNumber) {
    updateCustomerOnboardingState({ mobileNumber: profile.mobileNumber });
  }
}

export function syncCustomerOnboardingStateFromLeadStatus(
  leadState: CustomerLeadStatusResponse | null | undefined
): void {
  const patch: {
    leadUuid?: string;
    emailVerified?: boolean;
  } = {};

  if (leadState?.leadId) {
    patch.leadUuid = leadState.leadId;
  }

  const verifiedStatuses = ['EMAIL_VERIFIED', 'DETAIL_STARTED', 'SUBMITTED', 'CONVERTED'];
  if (verifiedStatuses.includes(leadState?.leadStatus ?? '')) {
    patch.emailVerified = true;
  }

  if (Object.keys(patch).length > 0) {
    updateCustomerOnboardingState(patch);
  }
}
