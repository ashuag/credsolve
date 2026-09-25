import type { Metadata } from 'next';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const metadata: Metadata = {
  title: 'Verify your email | CredSolve',
  description: 'Enter the OTP we sent to your email to continue your CredSolve loan application.',
};

export default function EmailVerifyPage() {
  return (
    <CustomerJourneyGuard>
      <JourneyProgressProvider>
        <OnboardingFlow variant="email-only" />
      </JourneyProgressProvider>
    </CustomerJourneyGuard>
  );
}
