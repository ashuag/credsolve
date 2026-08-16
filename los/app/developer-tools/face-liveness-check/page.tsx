import { FaceLivenessCheckPanel } from '@/components/developer/face-liveness-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperFaceLivenessCheckPage() {
  return (
    <CrmShell
      title="Surepass Face Liveness"
      subtitle="Live Surepass face-liveness check — bypasses lead/KYC flow."
    >
      <FaceLivenessCheckPanel />
    </CrmShell>
  );
}
