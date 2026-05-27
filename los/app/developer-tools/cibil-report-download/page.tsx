import { CibilReportDownloadPanel } from '@/components/developer/cibil-report-download-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperCibilReportDownloadPage() {
  return (
    <CrmShell
      title="CIBIL Report Download"
      subtitle="Generate a CIBIL summary PDF from bureau JSON without saving it to storage."
    >
      <CibilReportDownloadPanel />
    </CrmShell>
  );
}
