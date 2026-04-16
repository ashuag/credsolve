import { ProfileEligibilityPanel } from '@/components/eligibility/profile-eligibility-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function ProfileEligibilityCheckPage() {
  return (
    <CrmShell
      title="Profile Eligibility Check"
      subtitle="Edit profile-based eligibility rules and control whether each rule remains active."
    >
      <ProfileEligibilityPanel />
    </CrmShell>
  );
}
