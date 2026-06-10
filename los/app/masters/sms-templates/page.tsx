import { SmsTemplatesPanel } from '@/components/masters/sms-templates-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function SmsTemplatesPage() {
  return (
    <CrmShell
      title="SMS Templates"
      subtitle="Manage SMS template content, provider template IDs, bearer tokens, and active state."
    >
      <SmsTemplatesPanel />
    </CrmShell>
  );
}
