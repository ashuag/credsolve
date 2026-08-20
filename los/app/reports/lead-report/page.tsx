import { CrmShell } from '@/components/layout/crm-shell';
import { LeadReportsPanel } from '@/components/reports/lead-reports-panel';

export default function LeadReportPage() {
  return (
    <CrmShell
      title="Lead Report"
      subtitle="Every lead with its latest application, loan, and repayment status."
    >
      <LeadReportsPanel />
    </CrmShell>
  );
}
