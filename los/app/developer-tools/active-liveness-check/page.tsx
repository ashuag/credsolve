import { ActiveLivenessCheckPanel } from '@/components/developer/active-liveness-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperActiveLivenessCheckPage() {
  return (
    <CrmShell
      title="Active Liveness Check"
      subtitle="Challenge-response liveness — blink, turn head, smile, open mouth — verified on-server from webcam frames."
    >
      <ActiveLivenessCheckPanel />
    </CrmShell>
  );
}
