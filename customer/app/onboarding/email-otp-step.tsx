'use client';

import { startTransition, useEffect, useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SendEmailOtpResponse, sendEmailOtp, verifyEmailOtp } from '@/lib/api/auth';
import { syncLeadEmail } from '@/lib/api/lead';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FlowLoader } from '@/components/ui/flow-loader';
import { OtpInputGrid } from '@/components/ui/otp-input-grid';
import { useCountdown } from '@/lib/hooks/use-countdown';
import { useOtpInput } from '@/lib/hooks/use-otp-input';
import {
  getCustomerOnboardingLeadUuid,
  updateCustomerOnboardingState,
} from '@/lib/stores/customer-onboarding-store';
import type { EmailMode } from './email-entry-step';

const OTP_LENGTH = 6;

type EmailOtpStepProps = {
  email: string;
  mode: EmailMode;
  otpRequest: SendEmailOtpResponse | null;
  onOtpRequestChange: (req: SendEmailOtpResponse) => void;
  onBack: () => void;
  /** Called in register mode after successful verification. */
  onVerified: () => void;
};

export function EmailOtpStep({
  email,
  mode,
  otpRequest,
  onOtpRequestChange,
  onBack,
  onVerified,
}: EmailOtpStepProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const otp = useOtpInput(() => { setError(''); setStatus(''); });
  const resendCountdown = useCountdown(otpRequest?.resendAvailableAt);

  const isLogin = mode === 'login';
  const stepLabel = isLogin ? 'Returning user' : 'Step 3 of 4';

  // Auto-send OTP on mount when navigating back to this step with an email but no active request
  useEffect(() => {
    if (!email || otpRequest) return;

    let active = true;
    setIsBootstrapping(true);
    setError('');
    setStatus('');

    void (async () => {
      try {
        await syncLeadEmailState(email, false);
        const nextRequest = await sendEmailOtp(email);
        if (active) onOtpRequestChange(nextRequest);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to send OTP right now.');
      } finally {
        if (active) setIsBootstrapping(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, otpRequest]);

  async function syncLeadEmailState(nextEmail: string, emailVerified: boolean) {
    const currentLeadUuid = getCustomerOnboardingLeadUuid();
    const syncResult = await syncLeadEmail({
      ...(currentLeadUuid ? { leadUuid: currentLeadUuid } : {}),
      email: nextEmail,
      emailVerified,
      ...(emailVerified ? { verificationType: 'otp' as const } : {})
    });
    updateCustomerOnboardingState({
      email: nextEmail,
      emailVerified,
      ...(syncResult.leadUuid ? { leadUuid: syncResult.leadUuid } : {}),
    });
  }

  async function handleResend() {
    if (!email || resendCountdown > 0 || isBootstrapping) return;
    setIsResending(true);
    setError('');
    setStatus('');
    try {
      await syncLeadEmailState(email, false);
      const next = await sendEmailOtp(email);
      onOtpRequestChange(next);
      otp.clear();
      setStatus('A fresh OTP has been sent to your email.');
      otp.inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP.');
    } finally {
      setIsResending(false);
    }
  }

  async function handleVerify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpRequest) { setError('Request a fresh OTP before trying to verify.'); return; }
    if (new Date(otpRequest.expiresAt).getTime() <= Date.now()) {
      setError('This OTP has expired. Request a new code.');
      return;
    }
    if (otp.joined.length !== OTP_LENGTH) { setError('Enter the 6-digit OTP to continue.'); return; }

    setIsVerifying(true);
    setError('');
    setStatus('');

    try {
      await verifyEmailOtp(otpRequest.requestId, otp.joined);
      await syncLeadEmailState(email, true);

      if (isLogin) {
        // isVerifying stays true — FlowLoader stays until route change
        startTransition(() => router.push('/account'));
      } else {
        // isVerifying stays true so FlowLoader is visible during the step transition
        onVerified();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify OTP right now.');
      setIsVerifying(false);
    }
  }

  return (
    <>
      <section className="mc-card mc-card-glow" aria-labelledby="email-otp-heading">
        <div className="mc-chip">{stepLabel}</div>
        <h1
          id="email-otp-heading"
          className="mt-[14px] mb-3 text-brand-navy text-[clamp(2.2rem,6vw,3.2rem)] leading-[0.96] tracking-[-0.05em]"
        >
          {isLogin ? 'Verify to log in.' : 'Verify your email.'}
        </h1>
        <p className="text-brand-muted leading-[1.6]">
          We sent a one-time password to <strong>{otpRequest?.maskedEmail ?? email}</strong>. Enter the 6-digit code
          below.
        </p>

        <form onSubmit={handleVerify} className="grid gap-[14px] mt-[22px]">
          <div className="mb-[4px]">
            <OtpInputGrid
              digits={otp.digits}
              inputRefs={otp.inputRefs}
              onDigitChange={otp.updateDigit}
              onKeyDown={otp.handleKeyDown}
              onPaste={otp.handlePaste}
              ariaLabel="Email OTP input"
            />
          </div>

          {otpRequest?.debugOtp && (
            <AlertBanner variant="warn">
              Demo OTP: <strong>{otpRequest.debugOtp}</strong>
            </AlertBanner>
          )}
          {error && <AlertBanner variant="error">{error}</AlertBanner>}
          {status && <AlertBanner variant="success">{status}</AlertBanner>}

          <button type="submit" className="mc-btn-primary w-full" disabled={isVerifying}>
            <span className="inline-flex items-center justify-center gap-[10px]">
              {isVerifying && (
                <span
                  className="w-[18px] h-[18px] rounded-full border-2 border-[rgba(255,248,223,0.28)] border-t-[#fff8df] animate-spin-btn"
                  aria-hidden
                />
              )}
              <span>{isVerifying ? 'Verifying...' : isLogin ? 'Login' : 'Verify email'}</span>
            </span>
          </button>
        </form>

        <div className="flex flex-wrap gap-[10px] mt-4 max-sm:flex-col max-sm:items-stretch">
          <button
            type="button"
            onClick={onBack}
            className="mc-btn-secondary text-brand-navy bg-[rgba(20,150,243,0.08)] text-center"
          >
            ← Change email
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || isBootstrapping || resendCountdown > 0}
            className="mc-btn-secondary text-brand-navy bg-[rgba(255,197,25,0.16)] border-0 cursor-pointer disabled:cursor-wait disabled:opacity-[0.76] disabled:translate-y-0 text-center"
          >
            {isResending ? 'Sending...' : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-[rgba(18,36,79,0.08)] text-brand-muted text-sm leading-[1.6]">
          OTPs expire in two minutes. Request a fresh code if needed.
        </div>
      </section>

      {(isVerifying || isBootstrapping) && (
        <FlowLoader
          eyebrow={isLogin ? 'Authenticating' : 'Verifying email'}
          title={isBootstrapping ? 'Sending OTP' : isLogin ? 'Logging you in.' : 'Email confirmed.'}
          description={
            isBootstrapping
              ? `We are sending a one-time password to ${email || 'your email address'}.`
              : isLogin
              ? 'We are validating your OTP, securing your session, and opening your account dashboard.'
              : 'Your email is verified. Loading the next step of your MoneyCash application.'
          }
          steps={
            isBootstrapping
              ? ['Validating email', 'Sending OTP', 'Preparing verification screen']
              : isLogin
              ? ['Checking OTP', 'Securing session', 'Opening dashboard']
              : ['Confirming OTP', 'Verifying email', 'Loading next step']
          }
        />
      )}
    </>
  );
}
