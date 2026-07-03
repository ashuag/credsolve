'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { BRAND_TAGLINE, BRAND_TRUST_STRIP, MAX_LOAN_DISPLAY } from '@/lib/brand';
import { buildHrefWithSearch } from '@/lib/navigation';
import { useScrollReveal } from '@/lib/hooks/use-scroll-reveal';

const SOCIAL_ICONS = {
  facebook: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
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
  { label: 'About Us', href: '/about-us' },
  { label: 'Contact Us', href: '#contact' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms-and-conditions' },
  { label: 'All Policies', href: '/policies' },
];

const SUPPORT_LINKS = [
  { label: 'Grievance Redressal', href: '/grievance-redressal-policy' },
  { label: 'Fair Practices Code', href: '/fair-practices-code' },
  { label: 'KYC & AML Policy', href: '/kyc-aml-policy' },
  { label: 'Corporate Governance', href: '/corporate-governance-policy' },
  { label: 'Information Security', href: '/information-security-policy' },
];


function FooterLinkColumn({
  title,
  links,
  className = '',
}: {
  title: string;
  links: { label: string; href: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h4 className="mb-5 text-[0.62rem] font-[900] uppercase tracking-[0.24em] text-brand-gold">{title}</h4>
      <ul className="flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="group inline-flex items-center gap-1.5 text-sm font-[600] text-white/45 transition-colors hover:text-white"
            >
              <span className="h-px w-0 bg-brand-blue transition-all group-hover:w-3" aria-hidden />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFooter() {
  const searchParams = useSearchParams();
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const footerRef = useScrollReveal();

  return (
    <footer id="contact" ref={footerRef} className="relative overflow-hidden bg-[#060e22]">
      {/* Ambient glow — continues from CTA section */}
      <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-brand-gold/10 blur-[100px]" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-brand-blue/10 blur-[90px]" aria-hidden />

      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />

      {/* Gold accent seam */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-brand-gold/50 to-transparent" />

      {/* Quick-apply strip */}
      <div className="relative border-b border-white/6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
          <div className="reveal text-center sm:text-left">
            <p className="text-[0.62rem] font-[900] uppercase tracking-[0.22em] text-brand-gold">Ready to apply?</p>
            <p className="mt-1 text-lg font-[900] text-white sm:text-xl">
              Get up to {MAX_LOAN_DISPLAY} in{' '}
              <span className="text-grad-gold">10 minutes</span>
            </p>
          </div>
          <Link
            href={applyHref}
            className="reveal stagger-1 group inline-flex shrink-0 items-center gap-2.5 rounded-2xl bg-brand-gold px-8 py-3.5 text-sm font-[900] text-[#0a1628] shadow-[0_8px_32px_rgba(244,180,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(244,180,0,0.35)] active:scale-[0.98]"
          >
            Apply Now — Free
            <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="currentColor" aria-hidden>
              <path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" />
            </svg>
          </Link>
        </div>
      </div>

     
      {/* Main footer body */}
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Brand column */}
          <div className="reveal flex flex-col gap-6 lg:col-span-5">
            <Link
              href="/"
              className="inline-flex w-fit shrink-0 rounded-2xl bg-white/95 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-transform duration-200 hover:scale-[1.03]"
            >
              <Image
                src="/images/moneycash-logo.png"
                alt="MoneyCash — Instant Digital Loans"
                width={957}
                height={379}
                sizes="(max-width: 640px) 160px, 190px"
                quality={95}
                className="block h-14 w-auto object-contain sm:h-16"
              />
            </Link>

            <p className="max-w-sm text-sm font-[600] leading-relaxed text-white/45">
              {BRAND_TAGLINE}. Instant short-term digital loans up to {MAX_LOAN_DISPLAY} — paperless, secure, and fast.
            </p>

            {/* Contact cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="tel:1800123MONEY"
                className="group flex items-center gap-3 rounded-2xl border border-white/6 bg-white/3 p-4 transition-all hover:border-brand-blue/25 hover:bg-brand-blue/8"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue/15 transition-colors group-hover:bg-brand-blue/25">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-blue-light" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .96h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 15.92v1z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-white/25">Toll Free</div>
                  <div className="truncate text-sm font-[800] text-white">1800-123-MONEY</div>
                </div>
              </a>

              <a
                href="mailto:contact@moneycash.in"
                className="group flex items-center gap-3 rounded-2xl border border-white/6 bg-white/3 p-4 transition-all hover:border-brand-blue/25 hover:bg-brand-blue/8"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue/15 transition-colors group-hover:bg-brand-blue/25">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-blue-light" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-white/25">Email</div>
                  <div className="truncate text-sm font-[800] text-white">contact@moneycash.in</div>
                </div>
              </a>

              <div className="group flex items-start gap-3 rounded-2xl border border-white/6 bg-white/3 p-4 transition-all hover:border-brand-blue/25 hover:bg-brand-blue/8 sm:col-span-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue/15 transition-colors group-hover:bg-brand-blue/25">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand-blue-light" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[0.58rem] font-[800] uppercase tracking-[0.14em] text-white/25">Registered Address</div>
                  <address className="mt-0.5 text-sm font-[700] not-italic leading-relaxed text-white/85">
                    E-2748 Gaur Siddhartham, Siddharth Vihar, Ghaziabad City, Ghaziabad, Ghaziabad- 201009, Uttar Pradesh
                  </address>
                </div>
              </div>
            </div>

            {/* Social */}
            {/* <div>
              <p className="mb-3 text-[0.62rem] font-[800] uppercase tracking-[0.2em] text-white/25">Follow Us</p>
              <div className="flex gap-2.5">
                {(Object.entries(SOCIAL_ICONS) as [string, React.ReactNode][]).map(([name, icon]) => (
                  <Link
                    key={name}
                    href="#"
                    aria-label={name}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-white/40 transition-all hover:border-brand-gold/30 hover:bg-brand-gold/10 hover:text-brand-gold"
                  >
                    {icon}
                  </Link>
                ))}
              </div>
            </div> */}
          </div>

          {/* Link columns */}
          <div className="reveal stagger-1 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7 lg:gap-6">
            <FooterLinkColumn title="Loan Products" links={LOAN_LINKS} />
            <FooterLinkColumn title="Company" links={COMPANY_LINKS} />
            <FooterLinkColumn title="Support" links={SUPPORT_LINKS} className="col-span-2 sm:col-span-1" />
          </div>
        </div>

        {/* Trust strip */}
        <div className="reveal stagger-2 mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/6 pt-8">
          {BRAND_TRUST_STRIP.map((label, index) => (
            <div key={label} className="flex items-center gap-4">
              {index > 0 ? <span className="hidden text-white/15 sm:inline" aria-hidden>|</span> : null}
              <span className="text-[0.65rem] font-[800] uppercase tracking-[0.14em] text-white/30">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-white/6 bg-[#040a18]/80">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:justify-between lg:text-left">
            <p className="text-[0.65rem] font-[600] leading-relaxed text-white">
              © {new Date().getFullYear()} MoneyCash. All rights reserved.
            </p>
            <p className="max-w-2xl text-[0.6rem] font-[500] leading-relaxed text-white/70">
            MoneyCash is a Digital Lending Platform Registered under the name of CredSolve Technologies Private Limited | CIN: U63111UW2026PTC251327
            *T&C Apply | Loan disbursal is subject to credit appraisal and approval.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
