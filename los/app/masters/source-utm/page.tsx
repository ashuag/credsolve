import { CrmShell } from '@/components/layout/crm-shell';
import { SourceUtmPanel } from '@/components/masters/source-utm-panel';

export default function SourceUtmPage() {
  return (
    <CrmShell
      title="Source & UTM"
      subtitle="Manage LOS lead source masters and UTM source/medium/campaign values from one panel."
    >
      <SourceUtmPanel />
    </CrmShell>
  );
}
