'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, Suspense } from 'react';
import { BrandHeader } from '@/components/layout/brand-header';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { isCustomerPortalSignedIn } from '@/lib/api/customer-session';

/** Self-contained routes that render their own header via LegalPageShell. */
const SELF_CONTAINED_LEGAL_ROUTES = new Set([
  '/policies',
  '/about-us',
  '/contact-us',
  '/emi-calculator',
  '/terms-and-conditions',
  '/privacy-policy',
  '/fair-practices-code',
  '/grievance-redressal-policy',
  '/kyc-aml-policy',
  '/corporate-governance-policy',
  '/information-security-policy',
]);

export function LayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { session } = useCustomerSession();
  const signedIn = isCustomerPortalSignedIn(session);

  const isLandingPage = pathname === '/';
  const isApplyPage = pathname === '/apply-for-loan';
  /** Offer / selection steps use the full journey shell (no account tab bar). */
  const isOfferJourneyPage =
    pathname === '/pre-approved-loan' || pathname === '/loan-selection';
  const isAccountLoginPage = pathname === '/my-account';
  const isOnboardingLayout = pathname === '/onboarding' || pathname === '/email-verify';
  /** Bank / references use LoanLandingShell (same mobile chrome as apply-for-loan). */
  const isBankJourneyPage = pathname === '/bank-details' || pathname === '/references';
  const isLoanDocumentsPage = pathname === '/loan-documents';
  const isKycJourneyPage = pathname === '/kyc' || pathname.startsWith('/kyc/');
  const isLegalPage = SELF_CONTAINED_LEGAL_ROUTES.has(pathname);

  if (isLegalPage) {
    return <>{children}</>;
  }

  if (
    isLandingPage ||
    isApplyPage ||
    isOfferJourneyPage ||
    (isAccountLoginPage && !signedIn)
  ) {
    return <>{children}</>;
  }

  if (isLoanDocumentsPage) {
    return (
      <>
        <div className="hidden shrink-0 lg:block">
          <Suspense
            fallback={
              <header
                className="sticky top-0 z-20 min-h-[72px] border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(255,253,248,0.95)] backdrop-blur-[24px] shadow-[0_4px_32px_rgba(23,44,113,0.08)]"
                aria-hidden
              />
            }
          >
            <BrandHeader />
          </Suspense>
        </div>
        <div className="flex min-h-screen w-full flex-col items-stretch justify-start lg:h-[100dvh] lg:max-h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:px-4 lg:py-3">
          {children}
        </div>
      </>
    );
  }
  if (isOnboardingLayout || isBankJourneyPage || isKycJourneyPage) {
    return (
      <>
        <div className="hidden lg:block">
          <Suspense
            fallback={
              <header
                className="sticky top-0 z-20 min-h-[72px] border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(255,253,248,0.95)] backdrop-blur-[24px] shadow-[0_4px_32px_rgba(23,44,113,0.08)]"
                aria-hidden
              />
            }
          >
            <BrandHeader />
          </Suspense>
        </div>
        <div className="flex min-h-screen w-full flex-col items-stretch justify-start lg:min-h-[calc(100vh-72px)] lg:items-center lg:py-8">
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <Suspense
        fallback={
          <header
            className="sticky top-0 z-20 min-h-[72px] border-b border-b-[rgba(18,36,79,0.09)] bg-[rgba(255,253,248,0.95)] backdrop-blur-[24px] shadow-[0_4px_32px_rgba(23,44,113,0.08)]"
            aria-hidden
          />
        }
      >
        <BrandHeader />
      </Suspense>
      <div className="w-[min(1180px,calc(100%-24px))] mx-auto pb-12 max-sm:w-[min(calc(100%-18px),520px)] max-sm:pb-[calc(76px+env(safe-area-inset-bottom))]">
        <main className="grid gap-5.5 pt-5.5 max-sm:pt-4.5">{children}</main>
      </div>
      <MobileTabBar />
    </>
  );
}
