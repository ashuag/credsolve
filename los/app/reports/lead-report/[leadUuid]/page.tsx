import { CrmShell } from '@/components/layout/crm-shell';
import { LeadReportDetailPanel } from '@/components/reports/lead-report-detail-panel';

export default async function LeadReportDetailPage({
  params,
}: {
  params: Promise<{ leadUuid: string }>;
}) {
  const { leadUuid } = await params;

  return (
    <CrmShell showPageHead={false}>
      <LeadReportDetailPanel leadUuid={leadUuid} />
    </CrmShell>
  );
}
