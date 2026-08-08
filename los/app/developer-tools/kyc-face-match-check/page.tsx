import { KycFaceMatchCheckPanel } from '@/components/developer/kyc-face-match-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperKycFaceMatchCheckPage() {
  return (
    <CrmShell
      title="KYC Face Match Check"
      subtitle="Local face-api: quality on both photos (blur / lighting / full face / covering / score), then Aadhaar↔selfie match. No Tenacio."
    >
      <KycFaceMatchCheckPanel />
    </CrmShell>
  );
}
