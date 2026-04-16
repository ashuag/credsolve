'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { logoutCustomerSession } from '@/lib/api/auth';
import { getAuthenticatedCustomerDisplayLabel } from '@/lib/customer-auth';
import { useCustomerSession } from '@/lib/hooks/use-customer-session';
import { useOutsideClick } from '@/lib/hooks/use-outside-click';
import { buildHrefWithSearch } from '@/lib/navigation';
import { clearCustomerSessionStoreSession } from '@/lib/stores/customer-session-store';

export function BrandHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { profile, hasHydrated } = useCustomerSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });

  // Close menu whenever the route changes
  useEffect(() => { setIsMenuOpen(false); }, [pathname]);

  useOutsideClick(menuRef, () => setIsMenuOpen(false), isMenuOpen);

  async function handleLogout() {
    try {
      await logoutCustomerSession();
    } catch {
      // Best-effort server logout — always clear client state so the user is not stuck
    }

    clearCustomerSessionStoreSession();
    setIsMenuOpen(false);
    router.push('/');
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
          <Link
            href={applyHref}
            className="inline-flex items-center justify-center min-h-[40px] px-[18px] py-[9px] rounded-full border border-[rgba(18,36,79,0.12)] bg-[rgba(255,255,255,0.82)] font-extrabold text-[0.94rem] text-brand-navy shadow-[0_8px_20px_rgba(23,44,113,0.08)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(23,44,113,0.14)]"
          >
            Apply for a loan
          </Link>

          {hasHydrated && profile ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-[10px] min-h-[40px] px-[18px] py-[9px] rounded-full font-extrabold text-[0.94rem] text-[#fff8df] bg-[linear-gradient(135deg,#1c347d_0%,#12244f_100%)] shadow-[0_8px_24px_rgba(23,44,113,0.22)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(23,44,113,0.3)]"
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsMenuOpen((v) => !v)}
              >
                <span>Hi, {getAuthenticatedCustomerDisplayLabel(profile)}</span>
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                  className={`h-4 w-4 transition-transform duration-150 ${isMenuOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] min-w-[220px] rounded-[20px] border border-[rgba(18,36,79,0.12)] bg-white p-2 shadow-[0_22px_48px_rgba(23,44,113,0.18)]"
                  role="menu"
                >
                  <div className="rounded-[16px] bg-[rgba(20,150,243,0.08)] px-4 py-3">
                    <div className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-brand-muted">Signed in</div>
                    <div className="mt-1 text-[0.96rem] font-extrabold text-brand-navy">
                      {getAuthenticatedCustomerDisplayLabel(profile)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left text-[0.95rem] font-extrabold text-brand-navy transition-colors duration-150 hover:bg-[rgba(18,36,79,0.05)]"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    <span>Logout</span>
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                      <path d="M8 5L13 10L8 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
