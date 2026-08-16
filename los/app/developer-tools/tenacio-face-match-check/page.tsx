import { TenacioFaceMatchCheckPanel } from '@/components/developer/tenacio-face-match-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperTenacioFaceMatchCheckPage() {
  return (
    <CrmShell
      title="Tenacio Face Match"
      subtitle="Live Tenacio face-match check — bypasses lead/KYC flow."
    >
      <TenacioFaceMatchCheckPanel />
    </CrmShell>
  );
}
