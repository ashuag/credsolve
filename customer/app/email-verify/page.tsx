import type { Metadata } from 'next';
import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const metadata: Metadata = {
  title: 'Verify your email | MoneyCash',
  description: 'Enter the OTP we sent to your email to continue your MoneyCash loan application.',
};

export default function EmailVerifyPage() {
  return (
    <JourneyProgressProvider>
      <OnboardingFlow variant="email-only" />
    </JourneyProgressProvider>
  );
}
