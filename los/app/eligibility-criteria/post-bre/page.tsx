import { ProfileEligibilityPanel } from '@/components/eligibility/profile-eligibility-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function PostBrePage() {
  return (
    <CrmShell
      title="Post BRE"
      subtitle="Configure post-bureau eligibility thresholds used after CIBIL pull."
    >
      <ProfileEligibilityPanel breType="POST_BRE" />
    </CrmShell>
  );
}
