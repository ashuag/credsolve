'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { logoutCustomer } from '@/lib/api/auth';
import { hasActiveLoanLead } from '@/lib/api/customer-session';
import { buildHrefWithSearch } from '@/lib/navigation';

export function BrandHeader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loading, session, refresh } = useCustomerSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });
  const accountHref = buildHrefWithSearch('/my-account', searchParams);

  const signedIn = Boolean(!loading && session?.authenticated && session.mobileNumber?.trim());
  const showApplyForLoan = !loading && !hasActiveLoanLead(session);

  const greetingLabel = useMemo(() => {
    if (!session || !session.authenticated) return 'Hi there.';
    const raw = session.profile?.fullName?.trim();
    if (!raw) return 'Hi there.';
    const first = raw.split(/\s+/)[0];
    return first ? `Hi ${first}` : 'Hi there.';
  }, [session]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    function onPointerDown(e: MouseEvent) {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) closeMenu();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuOpen, closeMenu]);

  async function handleLogout() {
    closeMenu();
    try {
      await logoutCustomer();
    } catch {
      /* still refresh to clear client state if cookie cleared */
    }
    await refresh();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(255,253,248,0.95)] backdrop-blur-[24px] shadow-[0_4px_32px_rgba(23,44,113,0.08)]">
      <div className="flex items-center justify-between gap-6 py-3 mx-auto max-w-[min(1280px,calc(100%-32px))]">
        <Link href="/" className="inline-flex items-center shrink-0 transition-transform duration-200 hover:scale-[1.02]" aria-label="MoneyCash home">
          <Image
            src="/images/moneycash-logo.jpeg"
            alt="MoneyCash Instant Digital Loans"
            width={536}
            height={136}
            sizes="(max-width: 720px) 45vw, 200px"
            priority
            className="w-[clamp(140px,25vw,190px)] h-auto block rounded-[10px]"
          />
        </Link>

        <nav className="hidden sm:flex items-center gap-4" aria-label="Primary">
          {showApplyForLoan && (
            <Link
              href={applyHref}
              className="inline-flex items-center justify-center min-h-[42px] px-6 py-2.5 rounded-full border border-[rgba(18,36,79,0.15)] bg-white font-extrabold text-[0.96rem] text-brand-navy shadow-[0_8px_24px_rgba(23,44,113,0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(23,44,113,0.2)]"
            >
              Apply for a loan
            </Link>
          )}

          {signedIn ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={greetingLabel}
                className="inline-flex items-center justify-center gap-2 min-h-[42px] min-w-0 max-w-[min(320px,calc(100vw-12rem))] pl-6 pr-5 py-2.5 rounded-full font-extrabold text-[0.96rem] text-[#fff8df] bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] shadow-[0_12px_28px_rgba(23,44,113,0.25)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(23,44,113,0.35)]"
              >
                <span className="truncate">{greetingLabel}</span>
                <svg
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 min-w-[200px] rounded-[16px] border border-[rgba(18,36,79,0.12)] bg-white py-2 shadow-[0_16px_40px_rgba(23,44,113,0.18)] z-30"
                >
                  <Link
                    href={accountHref}
                    role="menuitem"
                    className="block px-5 py-3 text-base font-bold text-brand-navy hover:bg-[rgba(20,150,243,0.08)] transition-colors duration-150"
                    onClick={closeMenu}
                  >
                    My account
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-5 py-3 text-base font-bold text-brand-navy hover:bg-[rgba(20,150,243,0.08)] transition-colors duration-150"
                    onClick={() => void handleLogout()}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center min-h-[42px] px-8 py-2.5 rounded-full font-extrabold text-[0.96rem] text-[#fff8df] bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] shadow-[0_12px_28px_rgba(23,44,113,0.25)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(23,44,113,0.35)]"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
