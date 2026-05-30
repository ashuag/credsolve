'use client';

import { CrmShell } from '@/components/layout/crm-shell';
import { SourceUtmPanel } from '@/components/masters/source-utm-panel';
import { useSearchParams } from 'next/navigation';

export default function SourceUtmEditPage() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id');
  const id = rawId ? Number(rawId) : undefined;

  return (
    <CrmShell
      title="Edit UTM"
      subtitle="Update UTM parameters for the selected lead source."
    >
      <SourceUtmPanel mode="edit" editId={Number.isFinite(id ?? NaN) ? id : undefined} />
    </CrmShell>
  );
}
