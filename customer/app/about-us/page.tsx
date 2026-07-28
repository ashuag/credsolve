import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { legalDocumentBySlug } from '@/lib/legal-content';

const doc = legalDocumentBySlug('about-us');

export const metadata: Metadata = {
  title: doc.title,
  description: doc.description,
  openGraph: {
    title: `${doc.title} | MoneyCash`,
    description: doc.description,
    type: 'website',
  },
};

export default function AboutUsPage() {
  return (
    <LegalPageShell pageLabel="About Us">
      <LegalDocumentView document={doc} />
    </LegalPageShell>
  );
}
