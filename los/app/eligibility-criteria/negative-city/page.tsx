import { NegativeListsPanel } from '@/components/eligibility/negative-lists-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function NegativeCityPage() {
  return (
    <CrmShell
      title="BRE Negative City"
      subtitle="Manage blocklisted cities used during profile eligibility checks. Removals are soft-deleted and retain full audit history."
    >
      <NegativeListsPanel scope="city" />
    </CrmShell>
  );
}
