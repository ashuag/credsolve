import termsContent from '@/content/legal/terms-and-conditions.json';
import privacyContent from '@/content/legal/privacy-policy.json';

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export type LegalGrievanceOfficer = {
  name: string;
  email: string;
  phone: string;
};

export type LegalDocumentContent = {
  slug: string;
  kind: 'terms' | 'privacy';
  title: string;
  description: string;
  registeredOffice: string;
  contactEmail: string;
  generatedAt: string;
  sections: LegalSection[];
  grievanceOfficer?: LegalGrievanceOfficer;
};

export const LEGAL_DOCUMENTS = {
  terms: termsContent as LegalDocumentContent,
  privacy: privacyContent as LegalDocumentContent,
} as const;

export function legalDocumentByKind(kind: 'terms' | 'privacy'): LegalDocumentContent {
  return LEGAL_DOCUMENTS[kind];
}
