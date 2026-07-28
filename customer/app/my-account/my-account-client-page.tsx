'use client';

import { Suspense, useState } from 'react';
import { AccountLoginInfographic } from '@/components/account/account-login-infographic';
import { CustomerLoginPanel } from '@/components/account/customer-login-panel';
import { MyAccountSection } from '@/components/account/my-account-section';
import { LoggedOutRedirectModal } from '@/components/auth/logged-out-redirect-modal';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { isCustomerPortalSignedIn } from '@/lib/api/customer-session';
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
  const { loading, session } = useCustomerSession();
  const signedIn = isCustomerPortalSignedIn(session);
  const [sessionExpired, setSessionExpired] = useState(false);

  if (sessionExpired) {
    return <LoggedOutRedirectModal />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (signedIn) {
    return (
      <div className="relative min-h-[calc(100vh-72px)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-[480px] w-[110vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(20,150,243,0.1),transparent_62%)]" />
          <div className="absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.12),transparent_68%)]" />
          <div className="absolute top-1/3 -left-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(28,52,125,0.06),transparent_70%)]" />
        </div>
        <div className="relative">
          <MyAccountSection onSessionExpired={() => setSessionExpired(true)} />
        </div>
      </div>
    );
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
