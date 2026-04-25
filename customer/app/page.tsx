import type { Metadata } from 'next';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { LoanProducts } from '@/components/landing/LoanProducts';
import { HomeCalculator } from '@/components/landing/HomeCalculator';
import { StatsSection } from '@/components/landing/StatsSection';
import { ProcessSteps } from '@/components/landing/ProcessSteps';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { CTASection } from '@/components/landing/CTASection';
import { LandingFooter } from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'MoneyCash | Instant Loans up to ₹50,000 — Approved in 2 Minutes',
  description:
    'Apply for instant short-term digital loans up to ₹50,000. 100% paperless, RBI registered NBFC. Approved in 2 minutes, money in your bank in 10 minutes.',
  openGraph: {
    title: 'MoneyCash | Instant Digital Loans up to ₹50,000',
    description: 'Quick, secure, paperless digital loans. RBI registered. No hidden charges.',
    type: 'website',
  },
};

export default function CustomerLandingPage() {
  return (
    <div className="flex min-h-screen flex-col selection:bg-[#ffc519]/30">
      <LandingNavbar />

      <main className="grow">
        {/* Hero — dark navy, animated phone illustration */}
        <HeroSection />

        {/* 3 trust-signal feature cards */}
        <FeaturesSection />

        {/* 5 short-term loan products up to ₹50K */}
        <LoanProducts />

        {/* Animated stats on dark background */}
        <StatsSection />

        {/* Interactive EMI calculator */}
        <HomeCalculator />

        {/* 3-step process — animated timeline */}
        <ProcessSteps />

        {/* Customer testimonials */}
        <TestimonialsSection />

        {/* Strong CTA section */}
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  );
}
