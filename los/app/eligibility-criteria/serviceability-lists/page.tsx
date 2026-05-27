import { CrmShell } from '@/components/layout/crm-shell';
import { NegativeListsPanel } from '@/components/eligibility/negative-lists-panel';

export default function ServiceabilityListsPage() {
  return (
    <CrmShell
      title="Serviceability Negative Lists"
      subtitle="Manage blocklisted pincodes, cities, and states used during profile eligibility checks. Removals are soft-deleted and keep audit history."
    >
      <NegativeListsPanel />
    </CrmShell>
  );
}
