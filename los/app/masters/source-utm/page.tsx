import { CrmShell } from '@/components/layout/crm-shell';
import { SourceUtmPanel } from '@/components/masters/source-utm-panel';

export default function SourceUtmPage() {
  return (
    <CrmShell
      title="Sources & UTMs"
      subtitle="View all lead sources and UTM tag configurations in one place."
    >
      <SourceUtmPanel mode="list" />
    </CrmShell>
  );
}
