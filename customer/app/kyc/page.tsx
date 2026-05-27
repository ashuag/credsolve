'use client';

import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { KycHubFlow } from '@/components/kyc/kyc-hub-flow';
import { useRequireLoanDocumentsAccepted } from '@/lib/hooks/use-require-loan-documents';

export default function KycPage() {
  useRequireLoanDocumentsAccepted();
  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <KycHubFlow />
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
