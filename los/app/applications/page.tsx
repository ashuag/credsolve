import { ApplicationsPanel } from '@/components/applications/applications-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function ApplicationsPage() {
  return (
    <CrmShell title="Application Management" showPageHead={false}>
      <ApplicationsPanel />
    </CrmShell>
  );
}
