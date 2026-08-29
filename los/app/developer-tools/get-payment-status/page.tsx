import { GetPaymentStatusPanel } from '@/components/developer/get-payment-status-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperGetPaymentStatusPage() {
  return (
    <CrmShell
      title="Get Payment Status"
      subtitle="Live Easebuzz Transaction V2.1 retrieve — does not update a loan."
    >
      <GetPaymentStatusPanel />
    </CrmShell>
  );
}
