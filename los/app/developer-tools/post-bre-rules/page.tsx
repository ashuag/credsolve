import { PostBreRulesPanel } from '@/components/developer/post-bre-rules-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperPostBreRulesPage() {
  return (
    <CrmShell
      title="Post BRE Rules"
      subtitle="Live reference for post-bureau rules: eligibility keys, fail/pass conditions, TUEF mapping, and rejection codes."
    >
      <PostBreRulesPanel />
    </CrmShell>
  );
}
