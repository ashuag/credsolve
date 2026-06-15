import { ProfileEligibilityPanel } from '@/components/eligibility/profile-eligibility-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function PreBrePage() {
  return (
    <CrmShell
      title="Pre BRE"
      subtitle="Configure pre-bureau eligibility rules applied before CIBIL pull."
    >
      <ProfileEligibilityPanel breType="PRE_BRE" />
    </CrmShell>
  );
}
