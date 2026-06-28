import { KycFaceMatchCheckPanel } from '@/components/developer/kyc-face-match-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperKycFaceMatchCheckPage() {
  return (
    <CrmShell
      title="KYC Face Match Check"
      subtitle="Dry-run face match: local face-api embeddings first, then Tenacio when configured."
    >
      <KycFaceMatchCheckPanel />
    </CrmShell>
  );
}
