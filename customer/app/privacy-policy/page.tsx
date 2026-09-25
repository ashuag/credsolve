import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { PrivacyDocument } from './privacy-document';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Official Privacy Policy for CredSolve — how we collect, use, retain, and protect your personal information on the website and app.',
  openGraph: {
    title: 'Privacy Policy | CredSolve',
    description:
      'Official Privacy Policy for the CredSolve digital lending platform — personal loans and account data.',
    type: 'website',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell pageLabel="Privacy Policy">
      <PrivacyDocument />
    </LegalPageShell>
  );
}
