'use client';

import { CrmShell } from '@/components/layout/crm-shell';
import { SourceUtmPanel } from '@/components/masters/source-utm-panel';
import { useSearchParams } from 'next/navigation';

type Kind = 'sources' | 'mediums' | 'campaigns';

export default function SourceUtmEditPage() {
  const searchParams = useSearchParams();
  const rawKind = searchParams.get('kind');
  const rawId = searchParams.get('id');
  const kind: Kind | undefined =
    rawKind === 'sources' || rawKind === 'mediums' || rawKind === 'campaigns'
      ? rawKind
      : undefined;
  const id = rawId ? Number(rawId) : undefined;

  return (
    <CrmShell
      title="Edit UTM"
      subtitle="Update UTM tag value for the selected lead source."
    >
      <SourceUtmPanel mode="edit" editKind={kind} editId={Number.isFinite(id ?? NaN) ? id : undefined} />
    </CrmShell>
  );
}
