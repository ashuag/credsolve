'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlowLoader } from '@/components/ui/flow-loader';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { SendEmailOtpResponse } from '@/lib/api/auth';
import type { CustomerOnboardingMode } from '@/lib/customer-flow';
import { getCustomerJourneyResumePath, isLeadRejectedAndLocked } from '@/lib/api/customer-session';
import { EmailEntryStep, type EmailMode } from './email-entry-step';
import { EmailOtpStep } from './email-otp-step';
import { PersonalDetailsStep, type PersonalDetailsSection } from './personal-details-step';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { LoanSummaryLeftRail } from '@/components/loan/loan-summary-left-rail';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';

// Flow: mobile verified → profile (/onboarding) → pre-approved + loan selection → email (/onboarding) → KYC → bank / thank-you
type OnboardingStep = 'details' | 'email' | 'email-otp';

/** Maps onboarding step to a mobile app-bar label. */
const STEP_LABELS: Record<OnboardingStep, string> = {
  details: 'Your profile',
  email: 'Link email',
  'email-otp': 'Verify email',
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
    const { detailsCompleted, loanSelectionCompleted } = session.journey;

    // Profile + loan + email complete → continue journey (e.g. bank details).
    if (detailsCompleted && loanSelectionCompleted && emailVerified) {
      router.replace(getCustomerJourneyResumePath(session));
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
    router.push('/pre-approved-loan');
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
    router.replace(getCustomerJourneyResumePath(next));
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
      { label: 'Maturity', value: ls?.maturityDate?.trim() ? ls.maturityDate : '—' },
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

  const leftTitle = (
    <>
      Loan <span className="text-[#60a5fa]">details</span>
    </>
  );
  const leftDescription =
    'Principal, tenure, and maturity from your application stay visible while you complete this step.';
  const leftInfographic = <LoanSummaryLeftRail loanSelection={portalSession.loanSelection} />;

  /** Back handler for mobile app bar — navigates within onboarding or exits */
  function handleMobileBack() {
    if (step === 'email-otp') {
      setStep('email');
      return;
    }
    if (step === 'email') {
      if (portalSession.journey.loanSelectionCompleted) {
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
