import type { Metadata } from 'next';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const metadata: Metadata = {
  title: 'Complete Your Profile | MoneyCash',
  description:
    'Provide your email address and personal details to complete your MoneyCash loan application.',
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
