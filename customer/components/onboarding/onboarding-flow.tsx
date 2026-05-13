'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { SendEmailOtpResponse } from '@/lib/api/auth';
import type { CustomerOnboardingMode } from '@/lib/customer-flow';
import { getCustomerJourneyResumePath, isLeadRejectedAndLocked } from '@/lib/api/customer-session';
import { EmailEntryStep, type EmailMode } from './email-entry-step';
import { EmailOtpStep } from './email-otp-step';
import { PersonalDetailsStep, type PersonalDetailsSection } from './personal-details-step';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';

// Flow: mobile verified → details → email → email-otp → /pre-approved-loan
type OnboardingStep = 'details' | 'email' | 'email-otp';

/** Maps onboarding step to a mobile app-bar label. */
const STEP_LABELS: Record<OnboardingStep, string> = {
  details: 'Step 1 of 3',
  email: 'Step 2 of 3',
  'email-otp': 'Step 3 of 3',
};

export function OnboardingFlow() {
  const router = useRouter();
  const journeyProgress = useJourneyProgressOptional();
  const { loading, session, refresh } = useCustomerSession();
  const [hasResolved, setHasResolved] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('details');
  const [email, setEmail] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('register');
  const [emailOtpRequest, setEmailOtpRequest] = useState<SendEmailOtpResponse | null>(null);
  const [detailsSection, setDetailsSection] = useState<PersonalDetailsSection>('profile');
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) return;

    if (!session.authenticated || !session.mobileNumber?.trim() || !session.lead) {
      router.replace('/apply-for-loan');
      return;
    }

    if (isLeadRejectedAndLocked(session.lead)) {
      router.replace('/thank-you-interest');
      return;
    }

    const lead = session.lead;
    const storedEmail = lead?.email?.trim() ?? '';
    const emailVerified = lead?.emailVerified ?? false;

    // Both details and email are done — move past onboarding
    if (session.journey.detailsCompleted && emailVerified) {
      router.replace(getCustomerJourneyResumePath(session));
      return;
    }

    if (!hasResolved) {
      const requestedMode = new URLSearchParams(window.location.search).get('mode');
      const initialMode: CustomerOnboardingMode = requestedMode === 'login' ? 'login' : 'register';
      setEmailMode(initialMode);
      setEmail(storedEmail);

      if (session.journey.detailsCompleted) {
        // Details are done but email is not verified — skip to email step
        setStep(storedEmail ? 'email-otp' : 'email');
      } else {
        setStep('details');
      }
      setHasResolved(true);
    }
  }, [loading, session, router, hasResolved]);

  useEffect(() => {
    if (!journeyProgress) return;
    if (step === 'details') journeyProgress.setCompletion01(0.1);
    else if (step === 'email') journeyProgress.setCompletion01(0.55);
    else if (step === 'email-otp') journeyProgress.setCompletion01(0.65);
  }, [step, journeyProgress]);

  async function handleDetailsSaved() {
    await refresh();
    setStep('email');
  }

  function handleEmailNext(confirmedEmail: string, mode: EmailMode, otpRequest: SendEmailOtpResponse) {
    setEmail(confirmedEmail);
    setEmailMode(mode);
    setEmailOtpRequest(otpRequest);
    setStep('email-otp');
    setDetailsNotice(null);
  }

  async function handleOtpVerified() {
    await refresh();
    router.push('/pre-approved-loan');
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

  let leftTitle, leftDescription, leftInfographic;

  if (step === 'email') {
    leftTitle = <>Secure <span className="text-[#60a5fa]">Access</span></>;
    leftDescription = "Link your email address to secure your account and track your loan progress.";
    leftInfographic = (
      <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="envGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <g transform="translate(100, 120)">
          <rect x="0" y="0" width="200" height="140" rx="16" fill="url(#envGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />
          <path d="M0 20 L100 90 L200 20" stroke="rgba(255,255,255,0.8)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="100" cy="90" r="30" fill="#facc15" />
          <text x="100" y="98" fill="#854d0e" fontSize="24" fontWeight="bold" textAnchor="middle">@</text>
        </g>
      </svg>
    );
  } else if (step === 'email-otp') {
    leftTitle = <>Verify <span className="text-[#60a5fa]">Email</span></>;
    leftDescription = "Enter the secure code sent to your email to verify your identity.";
    leftInfographic = (
      <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>
        <g transform="translate(140, 100)">
          <path d="M60 0 L120 20 L120 60 C120 100 80 140 60 160 C40 140 0 100 0 60 L0 20 Z" fill="url(#shieldGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />
          <path d="M30 70 L50 90 L90 40" stroke="#ffffff" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  } else {
    leftTitle = <>Final <span className="text-[#60a5fa]">Details</span></>;
    leftDescription = "Complete your profile to unlock instant disbursal of your approved loan amount.";
    leftInfographic = (
      <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
        </defs>
        <g transform="translate(120, 80)">
          <rect x="0" y="0" width="160" height="220" rx="12" fill="url(#docGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />
          <circle cx="80" cy="60" r="30" fill="rgba(255,255,255,0.2)" />
          <rect x="40" y="120" width="80" height="12" rx="6" fill="rgba(255,255,255,0.8)" />
          <rect x="40" y="150" width="50" height="12" rx="6" fill="rgba(255,255,255,0.4)" />
          <circle cx="140" cy="200" r="24" fill="#10b981" />
          <path d="M130 200 L138 208 L150 192" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }

  /** Back handler for mobile app bar — navigates within onboarding or exits */
  function handleMobileBack() {
    if (step === 'email-otp') { setStep('email'); return; }
    if (step === 'email') { setStep('details'); return; }
    router.push('/apply-for-loan');
  }

  const journeyPanel = (
    <div className="h-full">
      {step === 'details' && (
        <PersonalDetailsStep
          email={email}
          leadUuid={activeLead.uuid}
          initialProfile={portalSession.profile}
          activeSection={detailsSection}
          onSectionChange={setDetailsSection}
          onBack={() => router.push('/apply-for-loan')}
          noticeMessage={detailsNotice}
          onSaved={handleDetailsSaved}
        />
      )}
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
          compact={true}
        />
      )}
    </div>
  );

  return (
    <LoanLandingShell
      journeyPanel={journeyPanel}
      leftTitle={leftTitle}
      leftDescription={leftDescription}
      leftInfographic={leftInfographic}
      mobileStepLabel={STEP_LABELS[step]}
      mobileOnBack={handleMobileBack}
    />
  );
}
