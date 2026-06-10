import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { legalDocumentByKind } from '@/lib/legal-content';

export function TermsDocument() {
  return <LegalDocumentView document={legalDocumentByKind('terms')} />;
}
