import type { Metadata } from 'next';
import { LoanEntryPanel } from '@/components/home/loan-entry-panel';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';

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
  return <LoanLandingShell journeyPanel={<LoanEntryPanel />} />;
}
