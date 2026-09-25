import { CrmShell } from '@/components/layout/crm-shell';
import { CrmDashboardClient } from '@/components/dashboard/crm-dashboard-client';

export default function CrmDashboardPage() {
  return (
    <CrmShell
      title="CredSolve LOS"
      subtitle="Summary report — UTC day bounds, live counts from the book."
      showPageHead={false}
    >
      <CrmDashboardClient />
    </CrmShell>
  );
}
