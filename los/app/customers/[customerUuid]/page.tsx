import { CrmShell } from '@/components/layout/crm-shell';
import { CustomerDetailsPanel } from '@/components/customers/customer-details-panel';

export default async function CustomerDetailsPage({
  params,
}: {
  params: Promise<{ customerUuid: string }>;
}) {
  const { customerUuid } = await params;

  return (
    <CrmShell showPageHead={false}>
      <CustomerDetailsPanel customerUuid={customerUuid} />
    </CrmShell>
  );
}
