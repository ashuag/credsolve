import { TenacioFaceLivenessCheckPanel } from '@/components/developer/tenacio-face-liveness-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperTenacioFaceLivenessCheckPage() {
  return (
    <CrmShell
      title="Tenacio Face Liveness"
      subtitle="Live Tenacio face-liveness check — bypasses lead/KYC flow."
    >
      <TenacioFaceLivenessCheckPanel />
    </CrmShell>
  );
}
