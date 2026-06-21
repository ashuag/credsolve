import { KycDeepfakeCheckPanel } from '@/components/developer/kyc-deepfake-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperKycDeepfakeCheckPage() {
  return (
    <CrmShell
      title="KYC Selfie Authenticity"
      subtitle="Local ML cannot detect AI photos — use Tenacio deepfake when configured."
    >
      <KycDeepfakeCheckPanel />
    </CrmShell>
  );
}
