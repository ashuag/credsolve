import { KycSelfieFaceCheckPanel } from '@/components/developer/kyc-selfie-face-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperKycSelfieFaceCheckPage() {
  return (
    <CrmShell
      title="KYC Selfie Face Check"
      subtitle="Dry-run local selfie validation, then Tenacio liveness when configured."
    >
      <KycSelfieFaceCheckPanel />
    </CrmShell>
  );
}
