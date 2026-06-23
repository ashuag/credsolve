import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { LEGAL_DOCUMENTS, LEGAL_NAV_ITEMS } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Policies & Disclosures | MoneyCash',
  description:
    'All MoneyCash legal documents, policies, and regulatory disclosures — terms, privacy, fair practices, grievance redressal, KYC & AML, governance, and information security.',
  openGraph: {
    title: 'Policies & Disclosures | MoneyCash',
    description: 'Browse all MoneyCash policies, terms, and regulatory disclosures.',
    type: 'website',
  },
};

export default function PoliciesIndexPage() {
  return (
    <LegalPageShell pageLabel="Policies & Disclosures">
      <div className="legal-doc">
        <header className="legal-hero">
          <div className="legal-hero-top">
            <div className="mc-chip">Legal</div>
          </div>
          <h1 className="legal-title">Policies &amp; Disclosures</h1>
          <p className="legal-lead">
            Everything that governs how MoneyCash operates — our terms, privacy commitments, fair practices, and
            regulatory disclosures, all in one place.
          </p>
        </header>

        <div className="policies-grid">
          {LEGAL_NAV_ITEMS.map((item) => {
            const doc = LEGAL_DOCUMENTS[item.slug];
            return (
              <Link key={item.slug} href={item.href} className="policy-card">
                <span className="policy-card-eyebrow">{doc.eyebrow}</span>
                <span className="policy-card-title">{item.label}</span>
                <span className="policy-card-desc">{item.description}</span>
                <span className="policy-card-cta">
                  Read
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                    <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </LegalPageShell>
  );
}
