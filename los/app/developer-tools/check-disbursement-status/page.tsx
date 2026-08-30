import { CheckDisbursementStatusPanel } from '@/components/developer/check-disbursement-status-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperCheckDisbursementStatusPage() {
  return (
    <CrmShell
      title="Check Disbursement Status"
      subtitle="Reads stored quick-transfer-initiate responses from vendor_api_log — does not update a loan."
    >
      <CheckDisbursementStatusPanel />
    </CrmShell>
  );
}
