import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { TermsDocument } from './terms-document';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Official Terms & Conditions for the CredSolve customer portal and digital lending Services.',
  openGraph: {
    title: 'Terms & Conditions | CredSolve',
    description: 'Official Terms of Use for CredSolve website and app.',
    type: 'website',
  },
};

export default function TermsAndConditionsPage() {
  return (
    <LegalPageShell pageLabel="Terms & Conditions">
      <TermsDocument />
    </LegalPageShell>
  );
}
