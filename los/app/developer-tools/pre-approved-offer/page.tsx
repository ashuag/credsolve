import { PreApprovedOfferPanel } from '@/components/developer/pre-approved-offer-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperPreApprovedOfferPage() {
  return (
    <CrmShell
      title="Pre-approved Offer Check"
      subtitle="Paste bureau JSON to see CIBIL score, credit-limit tier, and pre-approved loan amount."
    >
      <PreApprovedOfferPanel />
    </CrmShell>
  );
}
