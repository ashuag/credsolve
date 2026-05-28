import { NegativeListsPanel } from '@/components/eligibility/negative-lists-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function NegativeStatePage() {
  return (
    <CrmShell
      title="BRE Negative State"
      subtitle="Manage blocklisted states used during profile eligibility checks. Removals are soft-deleted and retain full audit history."
    >
      <NegativeListsPanel scope="state" />
    </CrmShell>
  );
}
