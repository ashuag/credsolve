import { CrmShell } from '@/components/layout/crm-shell';
import { MastersPanel } from '@/components/masters/masters-panel';

export default function MastersPage() {
  return (
    <CrmShell title="Masters">
      <MastersPanel />
    </CrmShell>
  );
}
