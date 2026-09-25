'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { CustomerAccountMenu } from '@/components/layout/customer-account-menu';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import {
  getCustomerAccountMenuTriggerLabel,
  hasActiveLoanLead,
  isCustomerPortalSignedIn,
} from '@/lib/api/customer-session';
import { buildHrefWithSearch } from '@/lib/navigation';

const NAV_LINKS = [
  { label: 'Home', href: '/', active: true },
  { label: 'Services', href: '#loans' },
  { label: 'About', href: '/about-us' },
  { label: 'Contact', href: '/contact-us' },
];

const TICKER_TAGS = [
  'Loans by RBI-registered NBFC partners',
  '100% paperless with PAN & Aadhaar',
  'Decision in minutes',
  'No charges before disbursal',
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
    'rounded-xl px-4 py-3 text-sm font-[700] text-[#0B1E3D]/80 hover:bg-[#0B1E3D]/5 hover:text-[#0B1E3D] transition-colors';

  return (
    <header className="sticky top-0 z-50 w-full shadow-xs">
      {/* Top Ticker — Dark Navy as in Design */}
      <div className="bg-[#0B1E3D] px-4 py-2 text-white sm:px-6 lg:px-8 border-b border-white/10">
        <ul className="mx-auto flex max-w-7xl list-none flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.72rem] font-[600] leading-snug tracking-wide text-white/90 sm:grid sm:grid-cols-4 sm:gap-x-6 sm:text-[0.78rem] text-center">
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

      {/* Main Navbar */}
      <nav
        className={`bg-white transition-[box-shadow,border-color] duration-300 border-b ${
          scrolled
            ? 'border-[#0B1E3D]/10 shadow-[0_4px_24px_rgba(11,30,61,0.06)]'
            : 'border-[#0B1E3D]/8'
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-6 lg:px-8 ${
            scrolled ? 'h-16 sm:h-18' : 'h-20 sm:h-22'
          }`}
        >
          {/* Logo */}
          <div className="flex shrink-0 items-center">
            <BrandLogo variant="capsule" />
          </div>

          {/* Navigation Links — Home, Services, About, Contact */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`text-[0.95rem] font-[600] tracking-tight transition-colors ${
                  link.active
                    ? 'text-[#10B981] font-[700]'
                    : 'text-[#0B1E3D]/70 hover:text-[#0B1E3D]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex shrink-0 items-center gap-3">
            {signedIn ? (
              <CustomerAccountMenu triggerLabel={accountMenuTriggerLabel} />
            ) : (
              <>
                {/* Get Loan Button — Emerald Green Pill */}
                <Link
                  href={applyHref}
                  className="inline-flex items-center justify-center rounded-full bg-[#22C55E] px-6 py-2.5 text-sm font-[800] text-white shadow-[0_4px_14px_rgba(34,197,94,0.3)] transition-all hover:bg-[#16A34A] hover:shadow-[0_6px_20px_rgba(34,197,94,0.4)] active:scale-[0.98]"
                >
                  Get Loan
                </Link>

                {/* Talk to us Button — Dark Navy Pill */}
                <Link
                  href="/contact-us"
                  className="hidden sm:inline-flex items-center justify-center rounded-full bg-[#0B1E3D] px-6 py-2.5 text-sm font-[800] text-white transition-all hover:bg-[#132d56] active:scale-[0.98]"
                >
                  Talk to us
                </Link>

                {showGuestChrome && (
                  <Link
                    href={loginHref}
                    className="hidden text-xs font-[700] text-[#0B1E3D]/60 hover:text-[#0B1E3D] lg:inline-block ml-1"
                  >
                    Log in
                  </Link>
                )}
              </>
            )}

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#0B1E3D]/15 text-[#0B1E3D] md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                {menuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="border-t border-[#0B1E3D]/10 bg-white/98 px-4 py-4 backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`rounded-xl px-4 py-3 text-sm font-[700] transition-colors ${
                    link.active ? 'bg-[#10B981]/10 text-[#10B981]' : 'text-[#0B1E3D]/70 hover:bg-[#0B1E3D]/5 hover:text-[#0B1E3D]'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-3 flex flex-col gap-2 border-t border-[#0B1E3D]/10 pt-3">
                <Link
                  href={applyHref}
                  className="rounded-xl bg-[#10B981] px-4 py-3 text-center text-sm font-[800] text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  Get Loan
                </Link>
                <Link
                  href="/contact-us"
                  className="rounded-xl bg-[#0B1E3D] px-4 py-3 text-center text-sm font-[800] text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  Talk to us
                </Link>
                {signedIn ? (
                  <>
                    <Link href={accountHref} className={sheetLinkClass} onClick={() => setMenuOpen(false)}>
                      My account
                    </Link>
                    <button type="button" className={`${sheetLinkClass} text-left`} onClick={() => void handleLogoutFromSheet()}>
                      Log out
                    </button>
                  </>
                ) : (
                  <Link href={loginHref} className={sheetLinkClass} onClick={() => setMenuOpen(false)}>
                    Log in
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
