import { NegativeListsPanel } from '@/components/eligibility/negative-lists-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function NegativePincodePage() {
  return (
    <CrmShell
      title="BRE Negative Pincode"
      subtitle="Manage blocklisted pincodes used during profile eligibility checks. Removals are soft-deleted and retain full audit history."
    >
      <NegativeListsPanel scope="pincode" />
    </CrmShell>
  );
}
