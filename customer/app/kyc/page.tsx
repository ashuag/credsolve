'use client';

import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { KycHubFlow } from '@/components/kyc/kyc-hub-flow';

export default function KycPage() {
  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <KycHubFlow />
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
