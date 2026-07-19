import { CibilVendorFetchPanel } from '@/components/developer/cibil-vendor-fetch-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperCibilTenacioFetchPage() {
  return (
    <CrmShell
      title="Tenacio CIBIL Fetch"
      subtitle="Live Tenacio bureau soft-pull dry run — bypasses the vendor API config switch."
    >
      <CibilVendorFetchPanel vendor="tenacio" />
    </CrmShell>
  );
}
