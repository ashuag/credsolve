import { CrmShell } from '@/components/layout/crm-shell';
import { CustomersPanel } from '@/components/customers/customers-panel';

export default function CustomersPage() {
  return (
    <CrmShell title="Customer Management" showPageHead={false}>
      <CustomersPanel />
    </CrmShell>
  );
}
