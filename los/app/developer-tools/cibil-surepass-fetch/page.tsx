import { CibilVendorFetchPanel } from '@/components/developer/cibil-vendor-fetch-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperCibilSurepassFetchPage() {
  return (
    <CrmShell
      title="Surepass CIBIL Fetch"
      subtitle="Live Surepass credit-report fetch dry run — bypasses the vendor API config switch."
    >
      <CibilVendorFetchPanel vendor="surepass" />
    </CrmShell>
  );
}
