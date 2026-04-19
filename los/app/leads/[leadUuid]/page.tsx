import { CrmShell } from '@/components/layout/crm-shell';
import { LeadDetailsPanel } from '@/components/leads/lead-details-panel';

export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{ leadUuid: string }>;
}) {
  const { leadUuid } = await params;

  return (
    <CrmShell
      title="Lead workspace"
      subtitle="Review intake, borrower profile, attribution, and linked applications in one LOS view."
    >
      <LeadDetailsPanel leadUuid={leadUuid} />
    </CrmShell>
  );
}
