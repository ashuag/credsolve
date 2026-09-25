import type {Metadata} from 'next';
import {Suspense} from 'react';
import {LandingNavbar} from '@/components/landing/LandingNavbar';
import {HeroSection} from '@/components/landing/HeroSection';
import {ProcessSteps} from '@/components/landing/ProcessSteps';
import {LoanProducts} from '@/components/landing/LoanProducts';
import {StatsSection} from '@/components/landing/StatsSection';
import {CustomerCommitments} from '@/components/landing/CustomerCommitments';
import {LandingFooter} from '@/components/landing/LandingFooter';
import {MAX_LOAN_DISPLAY} from '@/lib/brand';

export const metadata: Metadata = {
  title: `CredSolve | Credit Made Easy — Instant Loans up to ${MAX_LOAN_DISPLAY}`,
  description:
    `Instant personal loan from RBI-registered NBFC partners. Apply with PAN & get a decision in minutes. Up to ${MAX_LOAN_DISPLAY}. 100% paperless. No charges before disbursal.`,
  openGraph: {
    title: `CredSolve | Credit Made Easy — up to ${MAX_LOAN_DISPLAY}`,
    description: `Instant personal loan from RBI-registered NBFC partners. Apply with PAN & get a decision in minutes.`,
    type: 'website',
  },
};

export default function CustomerLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white selection:bg-[#22C55E]/20">
      <Suspense fallback={<div className="min-h-screen bg-white" aria-hidden />}>
        {/* Page 1: Announcement Bar & Navbar */}
        <LandingNavbar />

        <main className="grow">
          {/* Page 1: Hero & 3 Highlight Cards */}
          <HeroSection />

          {/* Page 2: Your Lending Journey & Bottom Mint CTA Banner */}
          <ProcessSteps />

          {/* Page 3: Loan for All & Wave Divider */}
          <LoanProducts />

          {/* Page 4: Platform Stats Pill & Backed by RBI-Registered NBFCs */}
          <StatsSection />

          {/* Page 5: Transparency, by design (6 Customer Commitments) */}
          <CustomerCommitments />
        </main>

        {/* Page 6: Comprehensive Compliant Footer */}
        <LandingFooter />
      </Suspense>
    </div>
  );
}
