import { LoanDetailsPanel } from '@/components/loans/loan-details-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default async function LoanDetailsPage({
  params,
}: {
  params: Promise<{ loanUuid: string }>;
}) {
  const { loanUuid } = await params;

  return (
    <CrmShell showPageHead={false}>
      <LoanDetailsPanel loanUuid={loanUuid} />
    </CrmShell>
  );
}
