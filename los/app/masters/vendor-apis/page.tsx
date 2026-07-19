import { VendorApiConfigPanel } from '@/components/masters/vendor-api-config-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function VendorApisPage() {
  return (
    <CrmShell
      title="Vendor APIs"
      subtitle="Switch vendor APIs on/off and register primary or backup vendors (e.g. CIBIL fetch)."
    >
      <VendorApiConfigPanel />
    </CrmShell>
  );
}
