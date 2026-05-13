import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountLoginInfographic } from '@/components/account/account-login-infographic';
import { CustomerLoginPanel } from '@/components/account/customer-login-panel';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Log in — My account',
  description:
    'Sign in with your registered mobile number and OTP to access your MoneyCash dashboard, resume applications, and manage your loans.',
  openGraph: {
    title: 'Log in — My account | MoneyCash',
    description:
      'Secure OTP login to your MoneyCash account — dashboard, applications, and loan management.',
    type: 'website'
  }
};

const LOGIN_LEFT_TITLE = (
  <>
    Your account.
    <span className="block text-transparent bg-clip-text bg-gradient-to-br from-[#1fa2ff] to-[#1496f3]">
      One OTP away.
    </span>
  </>
);

export default function MyAccountPage() {
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
