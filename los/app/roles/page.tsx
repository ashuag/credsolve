import { CrmShell } from '@/components/layout/crm-shell';
import { RolesPanel } from '@/components/roles/roles-panel';

export default function RolesPage() {
  return (
    <CrmShell title="Role Management">
      <RolesPanel />
    </CrmShell>
  );
}
