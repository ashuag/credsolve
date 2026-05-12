'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { SendEmailOtpResponse } from '@/lib/api/auth';
import type { CustomerOnboardingMode } from '@/lib/customer-flow';
import { getCustomerJourneyResumePath } from '@/lib/api/customer-session';
import { EmailEntryStep, type EmailMode } from './email-entry-step';
import { EmailOtpStep } from './email-otp-step';
import { PersonalDetailsStep, type PersonalDetailsSection } from './personal-details-step';
import {
  EmailAside,
  EmailOtpAside,
  PersonalDetailsAside,
} from '@/components/onboarding/onboarding-asides';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';

type OnboardingStep = 'details' |'email' | 'email-otp';
const DETAILS_TRANSITION_DELAY_MS = 650;

export function OnboardingFlow() {
  const router = useRouter();
  const journeyProgress = useJourneyProgressOptional();
  const { loading, session, refresh } = useCustomerSession();
  const syncedProfileRef = useRef(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('email');
  const [email, setEmail] = useState('');
  const [emailMode, setEmailMode] = useState<EmailMode>('register');
  const [emailOtpRequest, setEmailOtpRequest] = useState<SendEmailOtpResponse | null>(null);
  const [detailsSection, setDetailsSection] = useState<PersonalDetailsSection>('profile');
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);
  const [isTransitioningToDetails, setIsTransitioningToDetails] = useState(false);

  useEffect(() => {
    if (loading || !session) {
      return;
    }

    // We rely on CustomerSessionProvider's initial load. No need to double fetch.

    if (!session.authenticated || !session.mobileNumber?.trim() || !session.lead) {
      router.replace('/apply-for-loan');
      return;
    }

    if (session.journey.detailsCompleted) {
      router.replace(getCustomerJourneyResumePath(session));
      return;
    }

    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    const initialMode: CustomerOnboardingMode = requestedMode === 'login' ? 'login' : 'register';

    const lead = session.lead;
    const storedEmail = lead?.email?.trim() ?? '';
    const emailVerified = lead?.emailVerified ?? false;

    // If email is already verified, always enforce the details step —
    // even after hasResolved, so the Back button can't strand the user on the OTP screen.

    console.log('isTransitioningToDetails', isTransitioningToDetails);
    if (emailVerified && !isTransitioningToDetails && step !== 'details') {
      if (!hasResolved) {
        setEmailMode(initialMode);
        setEmail(storedEmail);
        setHasResolved(true);
      }
      setDetailsSection('profile');
      setStep('details');
      setDetailsNotice(null);
      return;
    }

    if (!hasResolved) {
      setEmailMode(initialMode);
      setEmail(storedEmail);
      setStep(storedEmail ? 'email-otp' : 'email');
      setHasResolved(true);
    }
  }, [isTransitioningToDetails, loading, session, router, step]);

  useEffect(() => {
    if (!journeyProgress) return;
    if (step === 'email') journeyProgress.setCompletion01(0.07);
    else if (step === 'email-otp') journeyProgress.setCompletion01(0.16);
    else if (step === 'details') journeyProgress.setCompletion01(0.2);
  }, [step, journeyProgress]);

  function handleEmailNext(confirmedEmail: string, mode: EmailMode, otpRequest: SendEmailOtpResponse) {
    setEmail(confirmedEmail);
    setEmailMode(mode);
    setEmailOtpRequest(otpRequest);
    setStep('email-otp');
    setDetailsNotice(null);
  }

  async function handleOtpVerified() {
    setIsTransitioningToDetails(true);

    try {
      await refresh();
      await new Promise((resolve) => setTimeout(resolve, DETAILS_TRANSITION_DELAY_MS));
      setDetailsSection('profile');
      setStep('details');
      setDetailsNotice(null);
    } finally {
      setIsTransitioningToDetails(false);
    }
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

  const journeyPanel = (
    <div className="h-full">
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
      {step === 'details' && (
        <PersonalDetailsStep
          email={email}
          leadUuid={activeLead.uuid}
          initialProfile={portalSession.profile}
          activeSection={detailsSection}
          onSectionChange={setDetailsSection}
          onBack={() => setStep('email')}
          noticeMessage={detailsNotice}
          onSaved={async () => {
            await refresh();
          }}
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
    />
  );
}
