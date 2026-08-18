import { NsdlPanVerificationPanel } from '@/components/developer/nsdl-pan-verification-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperNsdlPanVerificationPage() {
  return (
    <CrmShell
      title="NSDL PAN Verification"
      subtitle="Live Tenacio NSDL PAN name and date-of-birth check — bypasses lead onboarding."
    >
      <NsdlPanVerificationPanel />
    </CrmShell>
  );
}
