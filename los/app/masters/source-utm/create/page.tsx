import { CrmShell } from '@/components/layout/crm-shell';
import { SourceUtmPanel } from '@/components/masters/source-utm-panel';

export default function SourceUtmCreatePage() {
  return (
    <CrmShell
      title="Create UTM"
      subtitle="Select lead source and create UTM source/medium/campaign."
    >
      <SourceUtmPanel mode="create" />
    </CrmShell>
  );
}
