import { CrmShell } from '@/components/layout/crm-shell';
import { AgentsPanel } from '@/components/agents/agents-panel';

export default function AgentsPage() {
  return (
    <CrmShell title="Agent Management">
      <AgentsPanel />
    </CrmShell>
  );
}
