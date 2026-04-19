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
    <header className="sticky top-0 z-20 border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(255,253,248,0.88)] backdrop-blur-[18px] shadow-[0_2px_24px_rgba(23,44,113,0.06)]">
      <div className="flex items-center justify-between gap-4 py-[10px] mx-auto max-w-[min(1180px,calc(100%-24px))]">
        <Link href="/" className="inline-flex items-center shrink-0" aria-label="MoneyCash home">
          <Image
            src="/images/moneycash-logo.jpeg"
            alt="MoneyCash Instant Digital Loans"
            width={536}
            height={136}
            sizes="(max-width: 720px) 40vw, 180px"
            priority
            className="w-[clamp(130px,22vw,180px)] h-auto block rounded-[10px]"
          />
        </Link>

        <nav className="hidden sm:flex items-center gap-2" aria-label="Primary">
          {showApplyForLoan && (
            <Link
              href={applyHref}
              className="inline-flex items-center justify-center min-h-[40px] px-[18px] py-[9px] rounded-full border border-[rgba(18,36,79,0.12)] bg-[rgba(255,255,255,0.82)] font-extrabold text-[0.94rem] text-brand-navy shadow-[0_8px_20px_rgba(23,44,113,0.08)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(23,44,113,0.14)]"
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
                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] min-w-0 max-w-[min(280px,calc(100vw-12rem))] pl-[20px] pr-[16px] py-[9px] rounded-full font-extrabold text-[0.94rem] text-[#fff8df] bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] shadow-[0_8px_24px_rgba(23,44,113,0.22)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(23,44,113,0.3)]"
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
                    className="block px-4 py-2.5 text-[0.94rem] font-bold text-brand-navy hover:bg-[rgba(20,150,243,0.08)]"
                    onClick={closeMenu}
                  >
                    My account
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-[0.94rem] font-bold text-brand-navy hover:bg-[rgba(20,150,243,0.08)]"
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
              className="inline-flex items-center justify-center min-h-[40px] px-[22px] py-[9px] rounded-full font-extrabold text-[0.94rem] text-[#fff8df] bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] shadow-[0_8px_24px_rgba(23,44,113,0.22)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(23,44,113,0.3)]"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
