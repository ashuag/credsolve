import { NameMatchFuzzScorePanel } from '@/components/developer/name-match-fuzz-score-panel';
import { CrmShell } from '@/components/layout/crm-shell';

export default function DeveloperNameMatchFuzzScorePage() {
  return (
    <CrmShell
      title="Name Match Fuzzing Score"
      subtitle="Dry-run the penny-drop name fuzzing score — customer name vs bank account name."
    >
      <NameMatchFuzzScorePanel />
    </CrmShell>
  );
}
