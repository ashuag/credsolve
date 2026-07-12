import { ActiveLivenessCheckPanel } from '@/components/developer/active-liveness-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperActiveLivenessCheckPage() {
  return (
    <CrmShell
      title="Active Liveness Check"
      subtitle="Customer KYC face flow dry-run (prepare → turn → smile) — selfie quality, expression anti-spoof, and active liveness. Face match omitted."
    >
      <ActiveLivenessCheckPanel />
    </CrmShell>
  );
}
