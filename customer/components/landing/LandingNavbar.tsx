'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CustomerAccountMenu } from '@/components/layout/customer-account-menu';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { logoutCustomer } from '@/lib/api/auth';
import {
  getCustomerAccountMenuTriggerLabel,
  hasActiveLoanLead,
  isCustomerPortalSignedIn,
} from '@/lib/api/customer-session';
import { buildHrefWithSearch } from '@/lib/navigation';

const NAV_LINKS = [
  { label: 'Home', href: '/', active: true },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Loans', href: '#loans' },
  { label: 'Contact', href: '#contact' },
];

const ANNOUNCEMENTS = [
  '⚡  Instant Digital Loans up to ₹50,000',
  '🔒  100% Secure • Paperless • Quick Approval',
  '✅  Approval in 2 Minutes — No Branch Visit',
];

export function LandingNavbar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session, refresh } = useCustomerSession();
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });
  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const accountHref = buildHrefWithSearch('/my-account', searchParams);
  const [menuOpen, setMenuOpen] = useState(false);

  const signedIn = isCustomerPortalSignedIn(session);
  const showGuestChrome = !signedIn && (session === null || session.authenticated === false);
  const showGuestApplyCta = showGuestChrome && !hasActiveLoanLead(session);
  const accountMenuTriggerLabel = useMemo(() => getCustomerAccountMenuTriggerLabel(session), [session]);

  async function handleLogoutFromSheet() {
    setMenuOpen(false);
    try {
      await logoutCustomer();
    } catch {
      /* ignore */
    }
    await refresh();
    router.push('/');
    router.refresh();
  }

  const sheetLinkClass =
    'rounded-xl px-4 py-3 text-sm font-[700] text-[#12244f]/80 hover:bg-[#f8f9fc] hover:text-[#12244f] transition-colors';

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="relative overflow-hidden bg-[#1496f3] py-2">
        <div className="flex animate-marquee-scroll whitespace-nowrap">
          {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map((text, i) => (
            <span key={i} className="mx-12 shrink-0 text-[0.7rem] font-[800] uppercase tracking-[0.18em] text-white">
              {text}
            </span>
          ))}
        </div>
      </div>

      <nav className="border-b border-[rgba(18,36,79,0.06)] bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex h-full items-center shrink-0 transition-transform duration-200 hover:scale-[1.03]">
            <Image
              src="/images/moneycash-logo.png"
              alt="MoneyCash Instant Digital Loans"
              width={670}
              height={761}
              sizes="(max-width: 640px) 56px, 64px"
              priority
              className="block h-14 w-auto object-contain sm:h-16"
            />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-[700] transition-colors ${
                  link.active ? 'text-[#1496f3]' : 'text-[#12244f]/60 hover:text-[#1496f3]'
                }`}
              >
                {link.label}
                {link.active && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[#1496f3]" />}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {showGuestChrome && (
              <Link
                href={loginHref}
                className="hidden text-sm font-[700] text-[#12244f]/70 transition-colors hover:text-[#1496f3] md:block"
              >
                Log in
              </Link>
            )}

            {signedIn ? (
              <CustomerAccountMenu triggerLabel={accountMenuTriggerLabel} />
            ) : (
              showGuestApplyCta && (
                <Link
                  href={applyHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#12244f] px-4 py-2.5 text-sm font-[900] text-[#ffc519] shadow-[0_8px_24px_rgba(18,36,79,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(18,36,79,0.28)] md:px-5"
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(18,36,79,0.1)] md:hidden"
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
          <div className="border-t border-[rgba(18,36,79,0.06)] bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`rounded-xl px-4 py-3 text-sm font-[700] transition-colors ${
                    link.active ? 'bg-[#eef5ff] text-[#1496f3]' : 'text-[#12244f]/60 hover:bg-[#f8f9fc] hover:text-[#12244f]'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-[rgba(18,36,79,0.06)] pt-2">
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
                        className="rounded-xl bg-[#12244f] px-4 py-3 text-center text-sm font-[900] text-[#ffc519]"
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
