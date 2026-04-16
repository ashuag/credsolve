import { CreditLimitEligibilityPanel } from '@/components/eligibility/credit-limit-eligibility-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function CreditLimitEligibilityCheckPage() {
  return (
    <CrmShell
      title="Credit Limit Eligibility Check"
      subtitle="Edit unsecured credit-limit tiers and active status used during eligibility decisions."
    >
      <CreditLimitEligibilityPanel />
    </CrmShell>
  );
}
