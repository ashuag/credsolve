import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { TermsDocument } from './terms-document';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Official Terms & Conditions for the MoneyCash customer portal and digital lending Services.',
  openGraph: {
    title: 'Terms & Conditions | MoneyCash',
    description: 'Official Terms of Use for MoneyCash website and app.',
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
