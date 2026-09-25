'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/brand/brand-logo';
import { BRAND } from '@/lib/brand';

const BORROW_LINKS = [
  { label: 'Personal loan', href: '/apply-for-loan' },
  { label: 'Cost calculator', href: '/emi-calculator' },
  { label: 'Rates & charges', href: '/fair-practices-code' },
  { label: 'Eligibility', href: '/apply-for-loan' },
  { label: 'Lending partners', href: '#lending-partners' },
];

const LENDER_LINKS = [
  { label: 'All services', href: '#loans' },
  { label: 'CredMarketz', href: '#' },
  { label: 'CredoStack', href: '#' },
  { label: 'CredRecover', href: '#' },
  { label: 'Partner with us', href: '/contact-us' },
];

const COMPANY_LEGAL_LINKS = [
  { label: 'About', href: '/about-us' },
  { label: 'Contact', href: '/contact-us' },
  { label: 'Careers', href: '/about-us' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Use', href: '/terms-and-conditions' },
  { label: 'Fair Practice Code', href: '/fair-practices-code' },
  { label: 'DLG Disclosure', href: '/fair-practices-code' },
  { label: 'Grievance Redressal', href: '/grievance-redressal-policy' },
];

export function LandingFooter() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-[#07172E] text-white">
      {/* Main Footer Links & Company Details */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Column 1: Brand & Contact Info */}
          <div className="flex flex-col items-start lg:col-span-5">
            <Link href="/" className="inline-flex items-center gap-1.5" aria-label="CredSolve Home">
              <span className="text-2xl sm:text-3xl font-[900] tracking-tight">
                <span className="text-white">Cred</span>
                <span className="text-[#22C55E]">Solve</span>
              </span>
              <svg viewBox="0 0 20 20" className="h-6 w-6 sm:h-7 sm:w-7 text-[#22C55E]" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </Link>

            <p className="mt-5 max-w-sm text-sm font-[500] leading-relaxed text-white/70">
              Credit Made Easy. Personal loans with RBI-registered NBFC partners, and the lending technology and recovery infrastructure behind them.
            </p>

            <div className="mt-6 space-y-2 text-xs font-[600] text-white/80">
              <p>
                <a href={`mailto:${BRAND.email}`} className="hover:text-[#22C55E] transition-colors">
                  {BRAND.email}
                </a>
              </p>
              <p>+91 [phone]</p>
              <p className="font-[800] text-white pt-1">
                CredSolve Technologies Pvt. Ltd.
              </p>
              <p className="text-white/60">
                [Address line], Ghaziabad, Uttar Pradesh &mdash; [PIN]
              </p>
            </div>

            {/* Social Media Icons: in, YT, IG, X */}
            <div className="mt-6 flex items-center gap-2.5">
              {/* LinkedIn */}
              <a
                href="#"
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-white transition-all hover:bg-[#22C55E] hover:text-white"
              >
                in
              </a>

              {/* YouTube */}
              <a
                href="#"
                aria-label="YouTube"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-white transition-all hover:bg-[#22C55E] hover:text-white"
              >
                YT
              </a>

              {/* Instagram */}
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-white transition-all hover:bg-[#22C55E] hover:text-white"
              >
                IG
              </a>

              {/* X / Twitter */}
              <a
                href="#"
                aria-label="X (Twitter)"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-white transition-all hover:bg-[#22C55E] hover:text-white"
              >
                X
              </a>
            </div>
          </div>

          {/* Column 2: BORROW */}
          <div className="lg:col-span-2 sm:col-span-4">
            <h4 className="text-xs font-[900] uppercase tracking-widest text-white">
              BORROW
            </h4>
            <ul className="mt-5 space-y-3 text-xs sm:text-sm font-[600] text-white/70">
              {BORROW_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-[#22C55E] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: FOR LENDERS */}
          <div className="lg:col-span-2 sm:col-span-4">
            <h4 className="text-xs font-[900] uppercase tracking-widest text-white">
              FOR LENDERS
            </h4>
            <ul className="mt-5 space-y-3 text-xs sm:text-sm font-[600] text-white/70">
              {LENDER_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-[#22C55E] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: COMPANY & LEGAL */}
          <div className="lg:col-span-3 sm:col-span-4">
            <h4 className="text-xs font-[900] uppercase tracking-widest text-white">
              COMPANY &amp; LEGAL
            </h4>
            <ul className="mt-5 space-y-3 text-xs sm:text-sm font-[600] text-white/70">
              {COMPANY_LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-[#10B981] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* RBI Digital Lending Directions & LSP Disclaimer Box */}
        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="text-[0.68rem] leading-relaxed text-white/50 text-justify">
            CredSolve Technologies Private Limited (CIN: [CIN]), registered office [Address line], Ghaziabad, Uttar Pradesh [PIN]. CredSolve is a Lending Service Provider (LSP) and is not a bank or NBFC. Credit is sanctioned, disbursed and held solely by our regulated lending partners (NBFCs and banks), at their sole discretion and in accordance with their credit policy and the RBI Digital Lending Directions. CredSolve does not lend on its own balance sheet and does not receive or hold borrower funds. Interest, fees and the annualised percentage rate are set by the lending partner and disclosed in the Key Fact Statement before acceptance. No charge is collected from a customer prior to disbursal. Loan approval is not guaranteed. Grievance Officer: [name], grievance@credsolve.in, +91 [phone] &mdash; acknowledged within 24 hours, resolved within 30 days, after which a complaint may be escalated under the Reserve Bank - Integrated Ombudsman Scheme, 2021. All calculators and examples shown are illustrative. Figures as on March 2026.
          </p>

          <p className="mt-6 text-center text-xs font-[500] text-white/40">
            &copy; 2026 CredSolve Technologies Private Limited. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
