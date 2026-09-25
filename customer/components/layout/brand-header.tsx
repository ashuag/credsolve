'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

export function BrandHeader() {
  const searchParams = useSearchParams();
  const { loading, session } = useCustomerSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const applyHref = buildHrefWithSearch('/apply-for-loan', searchParams);
  const loginHref = buildHrefWithSearch('/my-account', searchParams, { mode: 'login' });

  const signedIn = isCustomerPortalSignedIn(session);
  /**
   * Guest CTAs only after the first `/auth/me` completes. While `session === null` and loading,
   * treating the user as a guest incorrectly showed "Log in" on KYC and other signed-in pages.
   */
  const showGuestNav = !loading && !signedIn && session?.authenticated === false;
  const showApplyForLoanNav = showGuestNav && !hasActiveLoanLead(session);

  const accountMenuTriggerLabel = useMemo(() => getCustomerAccountMenuTriggerLabel(session), [session]);

  return (
    <header className="sticky top-0 z-20 border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(247,251,249,0.95)] backdrop-blur-[24px] shadow-[0_4px_32px_rgba(15,39,72,0.08)]">
      <div className="mx-auto flex h-[72px] max-w-[min(1280px,calc(100%-32px))] items-center justify-between gap-3 sm:gap-6 sm:h-20">
        {!mounted ? <div className="h-10 w-40" aria-hidden /> : <BrandLogo />}

        <nav className="flex shrink-0 items-center justify-end gap-2 sm:gap-4" aria-label="Primary">
          {loading ? (
            <div
              className="h-10 w-[min(200px,42vw)] rounded-full bg-slate-200/70 animate-pulse"
              aria-busy="true"
              aria-label="Loading account"
            />
          ) : (
            <>
              {showApplyForLoanNav && (
                <Link
                  href={applyHref}
                  className="inline-flex items-center justify-center min-h-[40px] sm:min-h-[42px] px-4 sm:px-6 py-2 sm:py-2.5 rounded-full border border-[rgba(15,39,72,0.15)] bg-white font-extrabold text-[0.85rem] sm:text-[0.96rem] text-brand-navy shadow-[0_8px_24px_rgba(15,39,72,0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,39,72,0.2)]"
                >
                  <span className="hidden sm:inline">Get Loan</span>
                  <span className="sm:hidden">Apply</span>
                </Link>
              )}

              {signedIn ? (
                <CustomerAccountMenu triggerLabel={accountMenuTriggerLabel} />
              ) : showGuestNav ? (
                <Link
                  href={loginHref}
                  className="inline-flex items-center justify-center min-h-[40px] sm:min-h-[42px] px-6 sm:px-8 py-2 sm:py-2.5 rounded-full font-extrabold text-[0.9rem] sm:text-[0.96rem] text-white bg-[linear-gradient(135deg,#0f2748_0%,#0a1b33_100%)] shadow-[0_12px_28px_rgba(15,39,72,0.25)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15,39,72,0.35)]"
                >
                  Log in
                </Link>
              ) : null}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
