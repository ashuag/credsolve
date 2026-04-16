import { CrmShell } from '@/components/layout/crm-shell';
import { EligibilityOverviewPanel } from '@/components/eligibility/eligibility-overview-panel';

export default function EligibilityCriteriaPage() {
  return (
    <CrmShell
      title="Eligibility Criteria"
      subtitle="Configure profile rules and credit-limit eligibility logic from a dedicated LOS section."
    >
      <EligibilityOverviewPanel />
    </CrmShell>
  );
}
