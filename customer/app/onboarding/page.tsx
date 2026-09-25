import type { Metadata } from 'next';
import { JourneyProgressProvider } from '@/components/journey/journey-progress-context';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const metadata: Metadata = {
  title: 'Your loan application | CredSolve',
  description:
    'Review your loan snapshot and complete profile and email steps to continue your CredSolve application.',
};

export default function OnboardingPage() {
  return (
    <JourneyProgressProvider>
      <OnboardingFlow />
    </JourneyProgressProvider>
  );
}
