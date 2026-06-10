import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { legalDocumentByKind } from '@/lib/legal-content';

export function PrivacyDocument() {
  return <LegalDocumentView document={legalDocumentByKind('privacy')} />;
}
