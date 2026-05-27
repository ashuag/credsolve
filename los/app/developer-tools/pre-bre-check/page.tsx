import { PreBreCheckPanel } from '@/components/developer/pre-bre-check-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperPreBreCheckPage() {
  return (
    <CrmShell
      title="Pre BRE Check"
      subtitle="Dry-run pre-bureau rules (age, gender, occupation, negative serviceability lists) before CIBIL pull."
    >
      <PreBreCheckPanel />
    </CrmShell>
  );
}
