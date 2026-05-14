import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { PrivacyDocument } from './privacy-document';

export const metadata: Metadata = {
  title: 'Privacy Policy | MoneyCash',
  description:
    'Official Privacy Policy for MoneyCash — how we collect, use, retain, and protect your personal information on the website and app.',
  openGraph: {
    title: 'Privacy Policy | MoneyCash',
    description:
      'Official Privacy Policy for the MoneyCash digital lending platform — personal loans and account data.',
    type: 'website',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell variant="privacy">
      <PrivacyDocument />
    </LegalPageShell>
  );
}
