'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AccountLoginInfographic } from '@/components/account/account-login-infographic';
import { CustomerLoginPanel } from '@/components/account/customer-login-panel';
import { MyAccountSection } from '@/components/account/my-account-section';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import {
  getCustomerJourneyResumePath,
  isCustomerPortalSignedIn,
  isInternalErrorLead,
} from '@/lib/api/customer-session';
import { Spinner } from '@/components/ui/spinner';

const LOGIN_LEFT_TITLE = (
  <>
    Your account.
    <span className="block text-transparent bg-clip-text bg-gradient-to-br from-[#1fa2ff] to-[#1496f3]">
      One OTP away.
    </span>
  </>
);

export function MyAccountClientPage() {
  const router = useRouter();
  const { loading, session } = useCustomerSession();

  const signedIn = isCustomerPortalSignedIn(session);
  const internalErrorLead = signedIn && isInternalErrorLead(session.lead);
  const resumeOfferStep =
    signedIn && Boolean(session.lead) && !session.journey.loanSelectionCompleted;

  useEffect(() => {
    if (loading || !signedIn) return;
    // Mid-journey (e.g. right after bureau / post-BRE): go to the next step, not the account hub.
    if (resumeOfferStep || internalErrorLead) {
      router.replace(getCustomerJourneyResumePath(session));
    }
  }, [internalErrorLead, loading, resumeOfferStep, router, session, signedIn]);

  if (loading || resumeOfferStep || internalErrorLead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffdf8]">
        <Spinner size={40} />
      </div>
    );
  }

  if (signedIn) {
    return <MyAccountSection />;
  }

  return (
    <div className="flex min-h-screen flex-col selection:bg-[#ffc519]/30 bg-[#fffdf8]">
      <Suspense fallback={<div className="min-h-screen bg-[#fffdf8]" aria-hidden />}>
        <LandingNavbar />

        <main className="relative grow flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/2 h-[600px] w-[100vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_rgba(20,150,243,0.06)_0%,_transparent_60%)]" />
          </div>

          <LoanLandingShell
            journeyPanel={<CustomerLoginPanel />}
            showSpeedometer={false}
            leftTitle={LOGIN_LEFT_TITLE}
            leftDescription="Loans · applications · repayments"
            leftInfographic={<AccountLoginInfographic />}
            leftStats={[
              { label: 'OTP', value: '30s' },
              { label: 'Hub', value: 'Live' },
              { label: 'Help', value: '24/7' },
            ]}
            mobileStepLabel="Sign in"
          />
        </main>
      </Suspense>
    </div>
  );
}
