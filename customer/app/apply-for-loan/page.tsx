import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoanEntryPanel } from '@/components/home/loan-entry-panel';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LandingNavbar } from '@/components/landing/LandingNavbar';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Apply for a loan',
  description:
    'Start your MoneyCash loan application with mobile OTP verification, digital onboarding, and a guided eligibility journey.',
  openGraph: {
    title: 'Apply for a loan | MoneyCash',
    description:
      'Start your MoneyCash loan application with mobile OTP verification, digital onboarding, and a guided eligibility journey.',
    type: 'website'
  }
};

export default function ApplyForLoanPage() {
  return (
    <div className="flex min-h-screen flex-col selection:bg-[#ffc519]/30 bg-[#fffdf8]">
      <Suspense fallback={<div className="min-h-screen bg-[#fffdf8]" aria-hidden />}>
        <div className="hidden lg:block">
          <LandingNavbar />
        </div>
        
        <main className="grow flex flex-col items-center justify-center p-0 lg:p-4 sm:p-6 lg:p-8 relative">
          {/* Subtle background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100vw] h-[600px] bg-[radial-gradient(ellipse_at_top,_rgba(20,150,243,0.06)_0%,_transparent_60%)]" />
          </div>

          <LoanLandingShell journeyPanel={<LoanEntryPanel />} />
        </main>
      </Suspense>
    </div>
  );
}
