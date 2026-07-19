import termsContent from '@/content/legal/terms-and-conditions.json';
import privacyContent from '@/content/legal/privacy-policy.json';
import fairPracticesContent from '@/content/legal/fair-practices-code.json';
import grievanceContent from '@/content/legal/grievance-redressal-policy.json';
import kycAmlContent from '@/content/legal/kyc-aml-policy.json';
import corporateGovernanceContent from '@/content/legal/corporate-governance-policy.json';
import infoSecurityContent from '@/content/legal/information-security-policy.json';
import aboutUsContent from '@/content/legal/about-us.json';

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
  /** Short label shown in the hero chip, e.g. "Privacy", "Security". */
  eyebrow: string;
  /** Label used in navigation menus and the policies index. */
  navLabel: string;
  title: string;
  description: string;
  registeredOffice: string;
  contactEmail: string;
  generatedAt: string;
  sections: LegalSection[];
  grievanceOfficer?: LegalGrievanceOfficer;
};

/**
 * All published legal / policy / company documents, keyed by slug.
 * The slug must match the route segment under `app/<slug>/`.
 */
export const LEGAL_DOCUMENTS = {
  'about-us': aboutUsContent as LegalDocumentContent,
  'terms-and-conditions': termsContent as LegalDocumentContent,
  'privacy-policy': privacyContent as LegalDocumentContent,
  'fair-practices-code': fairPracticesContent as LegalDocumentContent,
  'grievance-redressal-policy': grievanceContent as LegalDocumentContent,
  'kyc-aml-policy': kycAmlContent as LegalDocumentContent,
  'corporate-governance-policy': corporateGovernanceContent as LegalDocumentContent,
  'information-security-policy': infoSecurityContent as LegalDocumentContent,
} as const;

export type LegalDocumentSlug = keyof typeof LEGAL_DOCUMENTS;

/** Ordered list used for the policies index page and header Legal menu. */
export const LEGAL_DOCUMENT_ORDER: LegalDocumentSlug[] = [
  'terms-and-conditions',
  'privacy-policy',
  'fair-practices-code',
  'grievance-redressal-policy',
  'kyc-aml-policy',
  'corporate-governance-policy',
  'information-security-policy',
];

export type LegalNavItem = {
  slug: LegalDocumentSlug;
  href: string;
  label: string;
  description: string;
};

export const LEGAL_NAV_ITEMS: LegalNavItem[] = LEGAL_DOCUMENT_ORDER.map((slug) => {
  const doc = LEGAL_DOCUMENTS[slug];
  return {
    slug,
    href: `/${slug}`,
    label: doc.navLabel,
    description: doc.description,
  };
});

export function legalDocumentBySlug(slug: LegalDocumentSlug): LegalDocumentContent {
  return LEGAL_DOCUMENTS[slug];
}

/** Back-compat helper for the original two documents. */
export function legalDocumentByKind(kind: 'terms' | 'privacy'): LegalDocumentContent {
  return kind === 'terms'
    ? LEGAL_DOCUMENTS['terms-and-conditions']
    : LEGAL_DOCUMENTS['privacy-policy'];
}
