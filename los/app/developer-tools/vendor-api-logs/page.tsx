import { VendorApiLogsPanel } from '@/components/developer/vendor-api-logs-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperVendorApiLogsPage() {
  return (
    <CrmShell
      title="Vendor API Logs"
      subtitle="Browse audited outbound vendor calls — filter, sort, and inspect request/response payloads."
    >
      <VendorApiLogsPanel />
    </CrmShell>
  );
}
