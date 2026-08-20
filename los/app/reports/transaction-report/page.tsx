import { CrmShell } from '@/components/layout/crm-shell';
import { TransactionReportsPanel } from '@/components/reports/transaction-reports-panel';

export default function TransactionReportPage() {
  return (
    <CrmShell
      title="Transaction Report"
      subtitle="Disbursed loans with customer details, fees, repayment, and penal charges."
    >
      <TransactionReportsPanel />
    </CrmShell>
  );
}
