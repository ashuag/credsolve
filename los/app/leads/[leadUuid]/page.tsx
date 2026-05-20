import { CrmShell } from '@/components/layout/crm-shell';
import { LeadDetailsPanel } from '@/components/leads/lead-details-panel';

export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{ leadUuid: string }>;
}) {
  const { leadUuid } = await params;

  return (
    <CrmShell showPageHead={false}>
      <LeadDetailsPanel leadUuid={leadUuid} />
    </CrmShell>
  );
}
