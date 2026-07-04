import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { ContactUsView } from '@/components/contact/contact-us-view';

export const metadata: Metadata = {
  title: 'Contact Us | MoneyCash',
  description:
    'Get in touch with MoneyCash. Reach us by email or send us a message using our contact form and our team will respond as soon as possible.',
  openGraph: {
    title: 'Contact Us | MoneyCash',
    description:
      'Get in touch with MoneyCash. Reach us by email or send us a message using our contact form.',
    type: 'website',
  },
};

export default function ContactUsPage() {
  return (
    <LegalPageShell pageLabel="Contact Us">
      <ContactUsView />
    </LegalPageShell>
  );
}
