import { CrmShell } from '@/components/layout/crm-shell';
import { SourceUtmPanel } from '@/components/masters/source-utm-panel';

export default function SourceUtmPage() {
  return (
    <CrmShell
      title="Source & UTM"
      subtitle="View UTM listing with source mapping, and manage activation or edits."
    >
      <SourceUtmPanel mode="list" />
    </CrmShell>
  );
}
