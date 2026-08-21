import { SettingsPanel } from '@/components/masters/settings-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function SettingsPage() {
  return (
    <CrmShell
      title="Settings"
      subtitle="Edit application setting values and activate or deactivate each key."
    >
      <SettingsPanel />
    </CrmShell>
  );
}
