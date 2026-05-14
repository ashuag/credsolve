import { ApplicationDetailsPanel } from '@/components/applications/application-details-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default async function ApplicationDetailsPage({
  params,
}: {
  params: Promise<{ applicationUuid: string }>;
}) {
  const { applicationUuid } = await params;

  return (
    <CrmShell showPageHead={false}>
      <ApplicationDetailsPanel applicationUuid={applicationUuid} />
    </CrmShell>
  );
}
