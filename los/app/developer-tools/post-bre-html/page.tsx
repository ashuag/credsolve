import { PostBreHtmlPanel } from '@/components/developer/post-bre-html-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperPostBreHtmlPage() {
  return (
    <CrmShell
      title="Post BRE thru HTML"
      subtitle="Upload a CIBIL bureau HTML report, convert to vendor JSON, and inspect all post-BRE rule results."
    >
      <PostBreHtmlPanel />
    </CrmShell>
  );
}
