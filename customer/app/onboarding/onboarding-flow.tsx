'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { SendEmailOtpResponse } from '@/lib/api/auth';
import type { CustomerOnboardingMode } from '@/lib/customer-flow';
import { EmailEntryStep, type EmailMode } from './email-entry-step';
import { EmailOtpStep } from './email-otp-step';
import { PersonalDetailsStep, type PersonalDetailsSection } from './personal-details-step';
import {
  EmailAside,
  EmailOtpAside,
  PersonalDetailsAside,
} from '@/components/onboarding/onboarding-asides';

type OnboardingStep = 'email' | 'email-otp' | 'details';

export function OnboardingFlow() {
  const router = useRouter();
  const { loading, session, refresh } = useCustomerSession();
  const [hasResolved, setHasResolved] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('email');
  const [email, setEmail] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('register');
  const [emailOtpRequest, setEmailOtpRequest] = useState<SendEmailOtpResponse | null>(null);
  const [detailsSection, setDetailsSection] = useState<PersonalDetailsSection>('profile');
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) {
      return;
    }

    if (!session.authenticated || !session.mobileNumber?.trim() || !session.lead) {
      router.replace('/apply-for-loan');
      return;
    }

    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    const initialMode: CustomerOnboardingMode = requestedMode === 'login' ? 'login' : 'register';

    const lead = session.lead;
    const storedEmail = lead?.email?.trim() ?? '';
    const emailVerified = lead?.emailVerified ?? false;

    setEmailMode(initialMode);
    setEmail(storedEmail);

    if (emailVerified) {
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

    setHasResolved(true);
  }, [loading, session, router]);

  function handleEmailNext(confirmedEmail: string, mode: EmailMode, otpRequest: SendEmailOtpResponse) {
    setEmail(confirmedEmail);
    setEmailMode(mode);
    setEmailOtpRequest(otpRequest);
    setStep('email-otp');
    setDetailsNotice(null);
  }

  async function handleOtpVerified() {
    await refresh();
    setDetailsSection('profile');
    setStep('details');
    setDetailsNotice(email ? `${email} is verified. Continue with the next step.` : 'Email is verified. Continue with the next step.');
  }

  if (loading || !session || !hasResolved) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size={40} />
      </div>
    );
  }

  if (!session.authenticated || !session.lead) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size={40} />
      </div>
    );
  }

  const portalSession = session;
  const activeLead = portalSession.lead;
  if (!activeLead) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size={40} />
      </div>
    );
  }

  return (
    <>
      <div>
        {step === 'email' && (
          <EmailEntryStep
            initialEmail={email}
            initialMode={emailMode}
            leadUuid={activeLead.uuid}
            onNext={handleEmailNext}
          />
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
            leadUuid={activeLead.uuid}
            initialProfile={portalSession.profile}
            activeSection={detailsSection}
            onSectionChange={setDetailsSection}
            onBack={() => setStep('email-otp')}
            noticeMessage={detailsNotice}
            onSaved={async () => {
              await refresh();
            }}
          />
        )}
      </div>

      {step === 'email' && <EmailAside mode={emailMode} />}
      {step === 'email-otp' && <EmailOtpAside mode={emailMode} />}
      {step === 'details' && <PersonalDetailsAside activeSection={detailsSection} />}
    </>
  );
}
