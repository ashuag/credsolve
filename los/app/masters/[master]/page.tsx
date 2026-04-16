import { CrmShell } from '@/components/layout/crm-shell';
import { MasterDetailPanel } from '@/components/masters/master-detail-panel';
import { getMasterDefinition, isMasterSlug } from '@/components/masters/master-definitions';
import { notFound } from 'next/navigation';

export default async function MasterPage({
  params,
}: {
  params: Promise<{ master: string }>;
}) {
  const { master } = await params;

  if (!isMasterSlug(master)) {
    notFound();
  }

  const definition = getMasterDefinition(master);
  if (!definition) {
    notFound();
  }

  return (
    <CrmShell title={definition.pageTitle}>
      <MasterDetailPanel master={master} />
    </CrmShell>
  );
}
