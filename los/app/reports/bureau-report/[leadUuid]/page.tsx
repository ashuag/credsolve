import { CrmShell } from '@/components/layout/crm-shell';
import { BureauReportDetailPanel } from '@/components/reports/bureau-report-detail-panel';

export default async function BureauReportDetailPage({
  params,
}: {
  params: Promise<{ leadUuid: string }>;
}) {
  const { leadUuid } = await params;

  return (
    <CrmShell showPageHead={false}>
      <BureauReportDetailPanel leadUuid={leadUuid} />
    </CrmShell>
  );
}
