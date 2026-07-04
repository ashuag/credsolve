import { CrmShell } from '@/components/layout/crm-shell';
import { ContactSubmissionsPanel } from '@/components/contact/contact-submissions-panel';

export default function ContactSubmissionsPage() {
  return (
    <CrmShell
      title="Contact Us Submissions"
      subtitle="Messages submitted from the public Contact Us form on the customer website."
    >
      <ContactSubmissionsPanel />
    </CrmShell>
  );
}
