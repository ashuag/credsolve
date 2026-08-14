import { CrmShell } from '@/components/layout/crm-shell';
import { BureauReportsPanel } from '@/components/reports/bureau-reports-panel';

export default function BureauReportPage() {
  return (
    <CrmShell
      title="Bureau Report"
      subtitle="CIBIL bureau pulls stored on leads. Open a row to view the formatted report."
    >
      <BureauReportsPanel />
    </CrmShell>
  );
}
