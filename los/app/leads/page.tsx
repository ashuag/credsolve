import { CrmShell } from '@/components/layout/crm-shell';
import { LeadsPanel } from '@/components/leads/leads-panel';

export default function LeadsPage() {
  return (
    <CrmShell title="Lead Management" showPageHead={false}>
      <LeadsPanel />
    </CrmShell>
  );
}
