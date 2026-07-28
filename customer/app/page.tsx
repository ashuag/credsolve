import type {Metadata} from 'next';
import {Suspense} from 'react';
import {LandingNavbar} from '@/components/landing/LandingNavbar';
import {HeroSection} from '@/components/landing/HeroSection';
import {LoanProducts} from '@/components/landing/LoanProducts';
import {StatsSection} from '@/components/landing/StatsSection';
import {ProcessSteps} from '@/components/landing/ProcessSteps';
import {TestimonialsSection} from '@/components/landing/TestimonialsSection';
import {CTASection} from '@/components/landing/CTASection';
import {LandingFooter} from '@/components/landing/LandingFooter';

import {MAX_LOAN_DISPLAY} from '@/lib/brand';

export const metadata: Metadata = {
  title: `MoneyCash | Instant Loans up to ${MAX_LOAN_DISPLAY} — Approved in 2 Minutes`,
  description:
    `Apply for instant short-term digital loans up to ${MAX_LOAN_DISPLAY}. 100% paperless. Approved in 2 minutes, money in your bank in about 10 minutes.`,
  openGraph: {
    title: `MoneyCash | Instant Digital Loans up to ${MAX_LOAN_DISPLAY}`,
    description: `Apply for instant short-term digital loans up to ${MAX_LOAN_DISPLAY}. 100% paperless. Approved in 2 minutes, money in your bank in about 10 minutes.`,
    type: 'website',
  },
};

export default function CustomerLandingPage() {
  return (
    <div className="flex min-h-screen flex-col selection:bg-brand-gold/30">
      <Suspense fallback={<div className="min-h-screen bg-[#fffdf8]" aria-hidden />}>
        <LandingNavbar />

        <main className="grow">
          {/* Hero — dark navy, animated phone illustration */}
          <HeroSection />

          {/* 5 short-term loan products up to ₹30K */}
          <LoanProducts />

          {/* Animated stats on dark background */}
          <StatsSection />

          {/* 4-step process — from application to bank account */}
          <ProcessSteps />

          {/* Customer testimonials */}
          <TestimonialsSection />

          {/* Strong CTA section */}
          <CTASection />
        </main>

        <LandingFooter />
      </Suspense>
    </div>
  );
}
