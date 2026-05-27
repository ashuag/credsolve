import { PostBureauBrePanel } from '@/components/eligibility/post-bureau-bre-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperPostBureauCheckPage() {
  return (
    <CrmShell
      title="Post BRE Inspector"
      subtitle="Paste bureau JSON to inspect eligibility keys, tradelines, enquiries, and per-rule post-BRE results."
    >
      <PostBureauBrePanel />
    </CrmShell>
  );
}
