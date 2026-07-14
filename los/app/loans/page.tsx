import { LoansPanel } from '@/components/loans/loans-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function LoansPage() {
  return (
    <CrmShell title="Loan Management" showPageHead={false}>
      <LoansPanel />
    </CrmShell>
  );
}
