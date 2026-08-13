'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CustomerAccountMenu } from '@/components/layout/customer-account-menu';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import {
  getCustomerAccountMenuTriggerLabel,
  hasActiveLoanLead,
  isCustomerPortalSignedIn,
} from '@/lib/api/customer-session';
import { buildHrefWithSearch } from '@/lib/navigation';
import { MAX_LOAN_DISPLAY } from '@/lib/brand';
import { LEGAL_NAV_ITEMS } from '@/lib/legal-content';

const NAV_LINKS = [
  { label: 'Home', href: '/', active: true },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Loans', href: '#loans' },
  { label: 'EMI Calculator', href: '/emi-calculator' },
  { label: 'About Us', href: '/about-us' },
  { label: 'Contact', href: '/contact-us' },
];

const TICKER_TAGS = [
  `Instant digital loans up to ${MAX_LOAN_DISPLAY}`,
  '100% paperless',
  'Approval in ~2 minutes',
  'Loans by an RBI-registered NBFC',
] as const;

export function LandingNavbar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session, signOut } = useCustomerSession();
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const accountHref = buildHrefWithSearch('/my-account', searchParams);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const signedIn = isCustomerPortalSignedIn(session);
  const showGuestChrome = !signedIn && (session === null || session.authenticated === false);
  const showGuestApplyCta = showGuestChrome && !hasActiveLoanLead(session);
  const accountMenuTriggerLabel = useMemo(() => getCustomerAccountMenuTriggerLabel(session), [session]);

  async function handleLogoutFromSheet() {
    setMenuOpen(false);
    await signOut();
    router.replace('/');
    router.refresh();
  }

  const sheetLinkClass =
    'rounded-xl px-4 py-3 text-sm font-[700] text-[#12244f]/75 hover:bg-[#12244f]/5 hover:text-[#12244f] transition-colors';

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="bg-[linear-gradient(90deg,#1c347d_0%,#2388e5_50%,#1c347d_100%)] px-4 py-2.5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.12)] sm:px-6 lg:px-8">
        <ul className="mx-auto flex max-w-7xl list-none flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[0.68rem] font-[700] leading-snug tracking-[0.02em] text-white/95 sm:grid sm:grid-cols-4 sm:gap-x-6 sm:text-[0.75rem] sm:tracking-[0.03em]">
          {TICKER_TAGS.map((tag) => (
            <li
              key={tag}
              className="flex items-center justify-center gap-2 whitespace-nowrap text-center before:text-white/40 before:content-['·'] first:before:hidden sm:before:hidden"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>

      <nav
        className={`border-b bg-white transition-[box-shadow,border-color] duration-300 ${
          scrolled
            ? 'border-[#12244f]/8 shadow-[0_8px_30px_rgba(18,36,79,0.06)]'
            : 'border-[#12244f]/8'
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 transition-[height] duration-300 sm:px-6 lg:px-8 ${
            scrolled ? 'h-16 sm:h-[4.5rem]' : 'h-20 sm:h-24'
          }`}
        >
          <Link href="/" className="inline-flex h-full items-center shrink-0 transition-transform duration-200 hover:scale-[1.03]">
            <Image
              src="/images/moneycash-logo.png"
              alt="MoneyCash — Instant Digital Loans"
              width={957}
              height={379}
              sizes="(max-width: 640px) 170px, 200px"
              quality={95}
              priority
              className={`block w-auto object-contain transition-[height] duration-300 ${
                scrolled ? 'h-12 sm:h-14' : 'h-16 sm:h-[4.75rem]'
              }`}
            />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`group relative rounded-lg px-3.5 py-2 text-[0.95rem] font-[600] tracking-[-0.01em] transition-colors ${
                  link.active
                    ? 'text-[#1496f3]'
                    : 'text-[#12244f]/70 hover:bg-[#12244f]/5 hover:text-[#12244f]'
                }`}
              >
                ssdsdsd
                <span className="relative inline-block">
                  {link.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-0.5 w-full origin-center rounded-full bg-[#1496f3] transition-transform duration-300 ${
                      link.active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </span>
              </Link>
            ))}

            <div className="group relative">
              <button
                type="button"
                className="group relative inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-[0.95rem] font-[600] tracking-[-0.01em] text-[#12244f]/70 transition-colors hover:bg-[#12244f]/5 hover:text-[#12244f] group-focus-within:text-[#12244f]"
                aria-haspopup="true"
              >
                Legal
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              <div className="invisible absolute right-0 top-full z-50 w-[19rem] pt-2 opacity-0 transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="overflow-hidden rounded-2xl border border-[#12244f]/10 bg-white p-2 shadow-[0_20px_50px_rgba(18,36,79,0.18)]">
                  {LEGAL_NAV_ITEMS.map((item) => (
                    <Link
                      key={item.slug}
                      href={item.href}
                      className="block rounded-xl px-3 py-2 text-sm font-[600] text-[#12244f]/75 transition-colors hover:bg-[#12244f]/5 hover:text-[#1496f3]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {showGuestChrome && (
              <>
                <span className="mx-1 hidden h-6 w-px bg-[#12244f]/15 md:block" aria-hidden="true" />
                <Link
                  href={loginHref}
                  className="hidden rounded-lg px-3 py-2 text-[0.95rem] font-[600] text-[#1c347d]/75 transition-colors hover:text-[#1496f3] md:block"
                >
                  Log in
                </Link>
              </>
            )}

            {signedIn ? (
              <CustomerAccountMenu triggerLabel={accountMenuTriggerLabel} />
            ) : (
              showGuestApplyCta && (
                <Link
                  href={applyHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-navy to-[#12244f] px-4 py-2.5 text-sm font-[900] text-[#ffc519] shadow-[0_8px_24px_rgba(18,36,79,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(18,36,79,0.22)] md:px-5"
                >
                  <span className="hidden sm:inline">Apply Now</span>
                  <span className="sm:hidden">Apply</span>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-current">
                    <path d="M8.293 2.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 9H2a1 1 0 010-2h9.586L8.293 3.707a1 1 0 010-1.414z" />
                  </svg>
                </Link>
              )
            )}

            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#12244f]/15 text-[#12244f] md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#12244f]" fill="none" stroke="currentColor" strokeWidth="2.5">
                {menuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-[#12244f]/10 bg-white/98 px-4 py-4 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`rounded-xl px-4 py-3 text-sm font-[700] transition-colors ${
                    link.active ? 'bg-[#12244f]/5 text-[#1496f3]' : 'text-[#12244f]/65 hover:bg-[#12244f]/5 hover:text-[#12244f]'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-2 border-t border-[#12244f]/10 pt-2">
                <p className="px-4 pb-1 text-[0.62rem] font-[900] uppercase tracking-[0.18em] text-[#12244f]/40">
                  Legal &amp; Policies
                </p>
                {LEGAL_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.slug}
                    href={item.href}
                    className="block rounded-xl px-4 py-2.5 text-sm font-[600] text-[#12244f]/65 transition-colors hover:bg-[#12244f]/5 hover:text-[#12244f]"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="mt-2 flex flex-col gap-2 border-t border-[#12244f]/10 pt-2">
                {signedIn ? (
                  <>
                    <Link href={accountHref} className={sheetLinkClass} onClick={() => setMenuOpen(false)}>
                      My account
                    </Link>
                    <Link href={applyHref} className={sheetLinkClass} onClick={() => setMenuOpen(false)}>
                      Apply for a loan
                    </Link>
                    <button type="button" className={`${sheetLinkClass} text-left`} onClick={() => void handleLogoutFromSheet()}>
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href={loginHref} className={sheetLinkClass} onClick={() => setMenuOpen(false)}>
                      Log in
                    </Link>
                    {showGuestApplyCta && (
                      <Link
                        href={applyHref}
                        className="rounded-xl bg-gradient-to-r from-brand-navy to-[#12244f] px-4 py-3 text-center text-sm font-[900] text-[#ffc519]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Apply Now →
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
