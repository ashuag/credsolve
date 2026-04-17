'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { SendEmailOtpResponse } from '@/lib/api/auth';
import { getCustomerLeadStatus } from '@/lib/api/lead';
import {
  syncCustomerOnboardingStateFromLeadStatus,
  syncCustomerOnboardingStateFromProfile
} from '@/lib/customer-flow';
import { useCustomerSession } from '@/lib/hooks/use-customer-session';
import {
  readCustomerOnboardingState,
  updateCustomerOnboardingState,
  type CustomerOnboardingMode,
} from '@/lib/stores/customer-onboarding-store';
import { EmailEntryStep, type EmailMode } from './email-entry-step';
import { EmailOtpStep } from './email-otp-step';
import { PersonalDetailsStep, type PersonalDetailsSection } from './personal-details-step';
import {
  EmailAside,
  EmailOtpAside,
  PersonalDetailsAside,
} from '@/components/onboarding/onboarding-asides';

type OnboardingStep = 'email' | 'email-otp' | 'details';

/* ── Flow orchestrator ────────────────────────────────────────────────────── */

export function OnboardingFlow() {
  const router = useRouter();
  const { profile, hasHydrated } = useCustomerSession();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('email');
  const [email, setEmail] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('register');
  const [emailOtpRequest, setEmailOtpRequest] = useState<SendEmailOtpResponse | null>(null);
  const [detailsSection, setDetailsSection] = useState<PersonalDetailsSection>('profile');
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!profile) {
      router.replace('/apply-for-loan');
      return;
    }

    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    const initialMode: CustomerOnboardingMode = requestedMode === 'login' ? 'login' : 'register';

    let isActive = true;

    void (async () => {
      syncCustomerOnboardingStateFromProfile(profile);

      const leadState = await getCustomerLeadStatus().catch(() => null);

      if (!isActive) {
        return;
      }

      syncCustomerOnboardingStateFromLeadStatus(leadState);

      const onboardingState = readCustomerOnboardingState();
      const resolvedMode = onboardingState.emailMode ?? initialMode;
      const storedEmail = onboardingState.email?.trim() ?? '';

      setEmailMode(resolvedMode);
      setEmail(storedEmail);

      if (onboardingState.emailVerified) {
        setDetailsSection('profile');
        setStep('details');
        setDetailsNotice(
          storedEmail
            ? `${storedEmail} is verified. Continue with the next step.`
            : 'Email is verified. Continue with the next step.'
        );
      } else if (storedEmail) {
        setStep('email-otp');
      } else {
        setStep('email');
      }

      setHasLoaded(true);
    })();

    return () => {
      isActive = false;
    };
  }, [profile, hasHydrated, router]);

  function handleEmailNext(confirmedEmail: string, mode: EmailMode, otpRequest: SendEmailOtpResponse) {
    setEmail(confirmedEmail);
    setEmailMode(mode);
    setEmailOtpRequest(otpRequest);
    setStep('email-otp');
    setDetailsNotice(null);
    updateCustomerOnboardingState({ email: confirmedEmail, emailMode: mode, emailVerified: false });
  }

  function handleOtpVerified() {
    setDetailsSection('profile');
    setStep('details');
    setDetailsNotice(email ? `${email} is verified. Continue with the next step.` : 'Email is verified. Continue with the next step.');
    updateCustomerOnboardingState({ email, emailMode, emailVerified: true });
  }

  if (!hasLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <>
      {/* Left column — mount only active form to avoid premature API calls */}
      <div>
        {step === 'email' && (
          <EmailEntryStep initialEmail={email} initialMode={emailMode} onNext={handleEmailNext} />
        )}
        {step === 'email-otp' && (
          <EmailOtpStep
            email={email}
            mode={emailMode}
            otpRequest={emailOtpRequest}
            onOtpRequestChange={setEmailOtpRequest}
            onBack={() => setStep('email')}
            onVerified={handleOtpVerified}
          />
        )}
        {step === 'details' && (
          <PersonalDetailsStep
            email={email}
            activeSection={detailsSection}
            onSectionChange={setDetailsSection}
            onBack={() => setStep('email-otp')}
            noticeMessage={detailsNotice}
          />
        )}
      </div>

      {/* Right column — contextual aside per step */}
      {step === 'email' && <EmailAside mode={emailMode} />}
      {step === 'email-otp' && <EmailOtpAside mode={emailMode} />}
      {step === 'details' && <PersonalDetailsAside activeSection={detailsSection} />}
    </>
  );
}
