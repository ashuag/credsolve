'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FlowLoader } from '@/components/ui/flow-loader';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { SendEmailOtpResponse } from '@/lib/api/auth';
import type { CustomerOnboardingMode } from '@/lib/customer-flow';
import {
  getCustomerJourneyResumePath,
  getPostEmailVerificationPath,
  isLeadRejectedAndLocked,
  CUSTOMER_EMAIL_JOURNEY_PATH,
  CUSTOMER_EMAIL_VERIFY_PATH,
} from '@/lib/api/customer-session';
import { formatIsoDateDdMmYyyy } from '@/lib/format-date';
import { EmailEntryStep, type EmailMode } from './email-entry-step';
import { EmailOtpStep } from './email-otp-step';
import { PersonalDetailsStep, type PersonalDetailsSection } from './personal-details-step';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';

// Flow: mobile → profile → pre-BRE/PAN/CIBIL → pre-approved → loan selection → email → loan docs + OTP → KYC → bank → references
type OnboardingStep = 'details' | 'email' | 'email-otp';

export type OnboardingFlowVariant = 'full' | 'email-only';

type OnboardingFlowProps = {
  /** `email-only`: `/email-verify` — email + OTP only; sends users away if profile/loan not done. */
  variant?: OnboardingFlowVariant;
};

/** Maps onboarding step to a mobile app-bar label. */
const STEP_LABELS: Record<OnboardingStep, string> = {
  details: 'Your profile',
  email: 'Link email',
  'email-otp': 'Verify email',
};

const ONBOARDING_LEFT_PANEL: Record<
  OnboardingStep,
  { title: ReactNode; description: string; infographic: ReactNode }
> = {
  details: {
    title: (
      <>
        Final <span className="text-[#60a5fa]">Details</span>
      </>
    ),
    description: 'Complete your profile to unlock instant disbursal of your approved loan amount.',
    infographic: (
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
    ),
  },
  email: {
    title: (
      <>
        Secure <span className="text-[#60a5fa]">Access</span>
      </>
    ),
    description: 'Link your email address to secure your account and track your loan progress.',
    infographic: (
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
          <text x="100" y="98" fill="#854d0e" fontSize="24" fontWeight="bold" textAnchor="middle">
            @
          </text>
        </g>
      </svg>
    ),
  },
  'email-otp': {
    title: (
      <>
        Verify <span className="text-[#60a5fa]">Email</span>
      </>
    ),
    description: 'Enter the secure code sent to your email to verify your identity.',
    infographic: (
      <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>
        <g transform="translate(140, 100)">
          <path
            d="M60 0 L120 20 L120 60 C120 100 80 140 60 160 C40 140 0 100 0 60 L0 20 Z"
            fill="url(#shieldGrad)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="4"
          />
          <path d="M30 70 L50 90 L90 40" stroke="#ffffff" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    ),
  },
};

export function OnboardingFlow({ variant = 'full' }: OnboardingFlowProps) {
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
    const { detailsCompleted, loanSelectionCompleted } = session.journey;

    // Profile + loan + email complete → continue journey (e.g. bank details).
    if (detailsCompleted && loanSelectionCompleted && emailVerified) {
      router.replace(getCustomerJourneyResumePath(session));
      return;
    }

    if (variant === 'email-only') {
      if (!detailsCompleted) {
        router.replace('/onboarding?mode=login');
        return;
      }
      if (!loanSelectionCompleted) {
        router.replace('/pre-approved-loan');
        return;
      }
      if (!hasResolved) {
        const requestedMode = new URLSearchParams(window.location.search).get('mode');
        const initialMode: CustomerOnboardingMode = requestedMode === 'login' ? 'login' : 'register';
        setEmailMode(initialMode);
        setEmail(storedEmail);
        // Always show email entry first in email-only flow:
        // loan selection -> email screen -> email OTP -> sanction letter.
        setStep('email');
        setHasResolved(true);
      }
      return;
    }

    // Profile done but loan not chosen → offer / selection before email.
    if (detailsCompleted && !loanSelectionCompleted) {
      router.replace('/pre-approved-loan');
      return;
    }

    if (!hasResolved) {
      const requestedMode = new URLSearchParams(window.location.search).get('mode');
      const initialMode: CustomerOnboardingMode = requestedMode === 'login' ? 'login' : 'register';
      setEmailMode(initialMode);
      setEmail(storedEmail);

      if (!detailsCompleted) {
        setStep('details');
      } else if (loanSelectionCompleted && !emailVerified) {
        router.replace(
          requestedMode === 'login' ? CUSTOMER_EMAIL_VERIFY_PATH : CUSTOMER_EMAIL_JOURNEY_PATH,
        );
        return;
      } else {
        setStep('details');
      }
      setHasResolved(true);
    }
  }, [loading, session, router, hasResolved, variant, refresh]);

  useEffect(() => {
    if (!journeyProgress) return;
    if (step === 'details') journeyProgress.setCompletion01(0.1);
    else if (step === 'email') journeyProgress.setCompletion01(0.55);
    else if (step === 'email-otp') journeyProgress.setCompletion01(0.65);
  }, [step, journeyProgress]);

  async function handleDetailsSaved() {
    const next = await refresh();
    // Post-BRE sets CONVERTED + pre-approved amount; always continue to the offer step.
    if (next.authenticated && next.lead && !isLeadRejectedAndLocked(next.lead)) {
      router.replace('/pre-approved-loan');
      return;
    }
    if (next.authenticated && isLeadRejectedAndLocked(next.lead)) {
      router.replace('/thank-you-interest');
      return;
    }
    router.replace('/apply-for-loan');
  }

  function handleEmailNext(confirmedEmail: string, mode: EmailMode, otpRequest: SendEmailOtpResponse) {
    setEmail(confirmedEmail);
    setEmailMode(mode);
    setEmailOtpRequest(otpRequest);
    setStep('email-otp');
    setDetailsNotice(null);
  }

  async function handleOtpVerified() {
    const next = await refresh();
    router.replace(getPostEmailVerificationPath(next));
  }

  const leftStats = useMemo(() => {
    if (!session || session.authenticated !== true) {
      return [
        { label: 'Paperless', value: '100%' },
        { label: 'Approval', value: 'Fast' },
        { label: 'Fees', value: 'Clear' },
      ];
    }
    const ls = session.loanSelection;
    if (!ls?.amountInr?.trim() && (ls?.tenureDays == null || !Number.isFinite(ls.tenureDays))) {
      return [
        { label: 'Paperless', value: '100%' },
        { label: 'Approval', value: 'Fast' },
        { label: 'Fees', value: 'Clear' },
      ];
    }
    const principal =
      ls?.amountInr?.trim() && Number.isFinite(Number.parseFloat(ls.amountInr))
        ? new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          }).format(Number.parseFloat(ls.amountInr))
        : '—';
    const tenure =
      ls?.tenureDays != null && Number.isFinite(ls.tenureDays)
        ? ls.tenureDays % 30 === 0 && ls.tenureDays >= 30
          ? `${ls.tenureDays / 30} mo`
          : `${Math.round(ls.tenureDays)} d`
        : '—';
    return [
      { label: 'Principal', value: principal },
      { label: 'Tenure', value: tenure },
      {
        label: 'Maturity',
        value: ls?.maturityDate?.trim() ? formatIsoDateDdMmYyyy(ls.maturityDate) : '—',
      },
    ];
  }, [session]);

  const sessionGateLoading =
    loading ||
    !session ||
    !hasResolved ||
    !session.authenticated ||
    !session.lead;

  if (sessionGateLoading) {
    return (
      <FlowLoader
        eyebrow="MoneyCash"
        title="Loading your application"
        description="We are checking your sign-in and opening the right step in your loan journey."
        steps={['Verifying your session', 'Reading your loan status', 'Preparing the next step']}
      />
    );
  }

  const portalSession = session;
  const activeLead = portalSession.lead!;

  const { title: leftTitle, description: leftDescription, infographic: leftInfographic } =
    ONBOARDING_LEFT_PANEL[step];

  /** Back handler for mobile app bar — navigates within onboarding or exits */
  function handleMobileBack() {
    if (step === 'email-otp') {
      setStep('email');
      return;
    }
    if (step === 'email') {
      if (variant === 'email-only') {
        router.push('/loan-selection');
      } else if (portalSession.journey.loanSelectionCompleted) {
        router.push('/loan-selection');
      } else {
        setStep('details');
      }
      return;
    }
    router.push('/apply-for-loan');
  }

  /** Hide gauge only on email OTP (tight layout); show on profile + email entry. */
  const shouldShowSpeedometer = step !== 'email-otp';

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
      showSpeedometer={shouldShowSpeedometer}
      journeyPanel={journeyPanel}
      leftTitle={leftTitle}
      leftDescription={leftDescription}
      leftInfographic={leftInfographic}
      leftStats={leftStats}
      mobileStepLabel={STEP_LABELS[step]}
      mobileOnBack={handleMobileBack}
    />
  );
}
