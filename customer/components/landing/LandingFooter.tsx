'use client';

import Image from 'next/image';
import Link from 'next/link';

const SOCIAL_ICONS = {
  facebook: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  ),
};

const LOAN_LINKS = [
  { label: 'Payday Advance', href: '#loans' },
  { label: 'Short Personal Loan', href: '#loans' },
  { label: 'Medical Emergency Loan', href: '#loans' },
  { label: 'Education Fee Advance', href: '#loans' },
];

const COMPANY_LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'About Us', href: '#' },
  { label: 'Contact Us', href: '#contact' },
  { label: 'FAQs', href: '#' },
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms & Conditions', href: '#' },
];

const SUPPORT_LINKS = [
  { label: 'Help Center', href: '#' },
  { label: 'Grievance Redressal', href: '#' },
  { label: 'Loan Status', href: '#' },
  { label: 'Repayment Portal', href: '#' },
];

const PARTNER_BANKS = ['HDFC BANK', 'ICICI Bank', 'AXIS BANK', 'Kotak', 'IndusInd', 'Bajaj Finserv'];

export function LandingFooter() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-[#060e22]">
      {/* Gradient top border */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-[#1496f3]/40 to-transparent" />
      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand column */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <Link href="/" className="inline-block">
              <Image
                src="/images/moneycash-logo.png"
                alt="MoneyCash Instant Digital Loans"
                width={536}
                height={136}
                className="h-auto w-[152px] rounded-xl bg-white p-1"
              />
            </Link>

            <p className="text-sm font-[600] leading-relaxed text-white/45">
              India&apos;s fastest growing digital lending platform. RBI Registered NBFC partner offering instant short-term loans up to ₹50,000.
            </p>

            {/* Contact */}
            <div className="flex flex-col gap-3">
              <a href="tel:1800123MONEY" className="group flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 transition-colors group-hover:bg-[#1496f3]/20">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#1496f3]" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .96h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 15.92v1z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-white/25">Toll Free</div>
                  <div className="text-sm font-[800] text-white">1800-123-MONEY</div>
                </div>
              </a>

              <a href="mailto:care@moneycash.in" className="group flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 transition-colors group-hover:bg-[#1496f3]/20">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#1496f3]" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <div className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-white/25">Email</div>
                  <div className="text-sm font-[800] text-white">care@moneycash.in</div>
                </div>
              </a>
            </div>

            {/* Social */}
            <div>
              <p className="mb-3 text-[0.62rem] font-[800] uppercase tracking-[0.2em] text-white/25">Follow Us</p>
              <div className="flex gap-3">
                {(Object.entries(SOCIAL_ICONS) as [string, React.ReactNode][]).map(([name, icon]) => (
                  <Link
                    key={name}
                    href="#"
                    aria-label={name}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-white/40 transition-all hover:border-[#1496f3]/30 hover:bg-[#1496f3]/10 hover:text-[#1496f3]"
                  >
                    {icon}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8 lg:col-span-8 lg:grid-cols-3">
            {/* Loans */}
            <div>
              <h4 className="mb-5 text-[0.62rem] font-[900] uppercase tracking-[0.24em] text-[#1496f3]">Loan Products</h4>
              <ul className="flex flex-col gap-3">
                {LOAN_LINKS.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm font-[600] text-white/45 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="mb-5 text-[0.62rem] font-[900] uppercase tracking-[0.24em] text-[#1496f3]">Company</h4>
              <ul className="flex flex-col gap-3">
                {COMPANY_LINKS.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm font-[600] text-white/45 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support + Certifications */}
            <div className="flex flex-col gap-8">
              <div>
                <h4 className="mb-5 text-[0.62rem] font-[900] uppercase tracking-[0.24em] text-[#1496f3]">Support</h4>
                <ul className="flex flex-col gap-3">
                  {SUPPORT_LINKS.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm font-[600] text-white/45 transition-colors hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Certifications */}
              <div>
                <h4 className="mb-4 text-[0.62rem] font-[900] uppercase tracking-[0.24em] text-[#1496f3]">Certified & Regulated</h4>
                <div className="flex flex-wrap gap-2">
                  {['RBI Reg.', 'ISO 27001', 'DPDP'].map((cert) => (
                    <div
                      key={cert}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[0.6rem] font-[800] uppercase tracking-[0.12em] text-white/40"
                    >
                      {cert}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 border-t border-white/5 pt-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-[0.6rem] font-[600] leading-relaxed text-white/20">
              <p>© 2024 MoneyCash Digital Finance Pvt. Ltd. All rights reserved. | CIN: U65929MH2024PTC123456</p>
              <p className="mt-1">RBI Registered NBFC Platform · ISO 27001 Certified · Bank-Grade Security · DPDP Compliant</p>
            </div>
            <div className="text-[0.58rem] leading-relaxed text-white/14 md:text-right">
              <p>*T&amp;C Apply | Loan disbursal is subject to credit appraisal and bank approval. Interest rates may vary based on credit profile.</p>
              <p className="mt-1">MoneyCash is a digital lending platform partnering with RBI registered NBFCs. All data is stored securely per Indian regulations.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
