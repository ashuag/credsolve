import type { Metadata } from 'next';
import Link from 'next/link';
import { TermsDocument } from './terms-document';

export const metadata: Metadata = {
  title: 'Terms & Conditions | MoneyCash',
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
    <div className="min-h-screen bg-[#fffdf8]">
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/apply-for-loan"
            className="text-sm font-bold text-brand-blue hover:underline"
          >
            ← Back to apply
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy-policy"
              className="text-sm font-semibold text-slate-500 hover:text-brand-navy"
            >
              Privacy
            </Link>
            <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-brand-navy">
              Home
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <TermsDocument />
      </div>
    </div>
  );
}
