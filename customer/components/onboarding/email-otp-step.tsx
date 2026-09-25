'use client';

import { startTransition, useEffect, useState, type SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SendEmailOtpResponse, sendEmailOtp, verifyEmailOtp } from '@/lib/api/auth';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FlowLoader } from '@/components/ui/flow-loader';
import { OtpInputGrid } from '@/components/ui/otp-input-grid';
import { useCountdown } from '@/lib/hooks/use-countdown';
import { useOtpInput } from '@/lib/hooks/use-otp-input';
import { getCustomerPostAuthResumePath, getPostEmailVerificationPath } from '@/lib/api/customer-session';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { cn } from '@/lib/cn';
import type { EmailMode } from './email-entry-step';

const OTP_LENGTH = 6;

type EmailOtpStepProps = {
  email: string;
  mode: EmailMode;
  otpRequest: SendEmailOtpResponse | null;
  onOtpRequestChange: (req: SendEmailOtpResponse) => void;
  onBack: () => void;
  /** Called in register mode after successful verification (may refresh server session). */
  onVerified: () => void | Promise<void>;
  /** Tighter vertical rhythm when embedded in the loan journey split layout. */
  compact?: boolean;
};

export function EmailOtpStep({
  email,
  mode,
  otpRequest,
  onOtpRequestChange,
  onBack,
  onVerified,
  compact = false,
}: EmailOtpStepProps) {
  const router = useRouter();
  const { refresh: refreshCustomerSession } = useCustomerSession();
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
        const nextRequest = await sendEmailOtp(email);
        if (active) {
          onOtpRequestChange(nextRequest);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to send OTP right now.');
      } finally {
        if (active) setIsBootstrapping(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, otpRequest]);

  async function handleResend() {
    if (!email || resendCountdown > 0 || isBootstrapping) return;
    otp.clear();
    setIsResending(true);
    setError('');
    setStatus('');
    try {
      const next = await sendEmailOtp(email);
      onOtpRequestChange(next);
      setStatus(next.debugOtp ? 'A fresh verification code is shown below.' : 'A fresh OTP has been sent to your email.');
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

      const updated = await refreshCustomerSession();
      if (isLogin) {
        const path =
          updated.authenticated === true && updated.lead
            ? getPostEmailVerificationPath(updated)
            : getCustomerPostAuthResumePath(updated, 'login');
        startTransition(() => router.replace(path));
      } else {
        await onVerified();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify OTP right now.');
      setIsVerifying(false);
    }
  }

  return (
    <>
      <section className="h-full flex flex-col" aria-labelledby="email-otp-heading">
        <div className={cn(compact ? 'mb-3' : 'mb-4')}>
          <h2
            id="email-otp-heading"
            className={cn(
              'text-xl md:text-[1.8rem] font-bold text-brand-navy tracking-tight leading-[1.1]',
              compact ? 'mb-3' : 'mb-4',
            )}
          >
            {isLogin ? 'Verify to ' : 'Verify your '}<span className="text-brand-blue">{isLogin ? 'log in' : 'email'}</span>
          </h2>

          <div
            className={cn(
              'flex items-start gap-3 mb-2 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60',
              compact ? 'p-3' : 'p-3',
            )}
          >
            <div className="p-1.5 bg-white rounded-xl shadow-sm text-blue-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[0.88rem] text-slate-600 leading-relaxed m-0 pt-0.5">
              {otpRequest?.debugOtp ? (
                <>
                  We have sent a code to <strong className="text-slate-900 font-bold tracking-wider">{otpRequest.maskedEmail ?? email}</strong> when possible.
                  If it does not arrive within a minute, check spam and use the code shown below.
                </>
              ) : (
                <>
                  We sent a secure code to <strong className="text-slate-900 font-bold tracking-wider">{otpRequest?.maskedEmail ?? email}</strong>. Enter it below.
                  Check your spam folder if you do not see it within a minute.
                </>
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="grid gap-[14px]">
          <div className="mb-2">
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
              Verification code (also check your inbox/spam): <strong>{otpRequest.debugOtp}</strong>
            </AlertBanner>
          )}
          {error && <AlertBanner variant="error">{error}</AlertBanner>}
          {status && <AlertBanner variant="success">{status}</AlertBanner>}

          <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm mt-4 pb-[max(12px,env(safe-area-inset-bottom))] -mx-5 px-5 pt-3 border-t border-slate-100 lg:mx-0 lg:px-0">
            <button type="submit" className="mc-btn-primary w-full" disabled={isVerifying}>
              <span className="inline-flex items-center justify-center gap-[10px]">
                {isVerifying && (
                  <span
                    className="w-[18px] h-[18px] rounded-full border-2 border-[rgba(255,248,223,0.28)] border-t-[#ecfdf5] animate-spin-btn"
                    aria-hidden
                  />
                )}
                <span>{isVerifying ? 'Verifying securely...' : isLogin ? 'Login' : 'Verify & Continue'}</span>
              </span>
            </button>
          </div>
        </form>

        <div
          className={cn(
            'flex flex-wrap gap-[10px] max-sm:flex-col max-sm:items-stretch',
            compact ? 'mt-4' : 'mt-6',
          )}
        >
          <button
            type="button"
            className="flex-1 py-3 px-4 rounded-xl font-bold text-[0.95rem] text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-200"
            onClick={onBack}
          >
            ← Change email
          </button>
          <button
            type="button"
            className="flex-1 py-3 px-4 rounded-xl font-bold text-[0.95rem] text-brand-blue bg-blue-50 hover:bg-blue-100 transition-colors text-center disabled:opacity-50 border border-blue-100"
            onClick={handleResend}
            disabled={isResending || isBootstrapping || resendCountdown > 0}
          >
            {isResending ? 'Sending...' : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
          </button>
        </div>
      </section>

      {(isVerifying || isBootstrapping) && (
        <FlowLoader
          eyebrow={isBootstrapping ? 'Verification in progress' : isLogin ? 'Authenticating' : 'Verification in progress'}
          title={isBootstrapping ? 'Sending OTP' : isLogin ? 'Logging you in.' : 'Verifying your OTP'}
          description={
            isBootstrapping
              ? `We are sending a one-time password to ${email || 'your email address'}.`
              : isLogin
              ? 'We are validating your OTP, securing your session, and opening your account dashboard.'
              : 'Please wait while we validate your code securely.'
          }
          steps={
            isBootstrapping
              ? ['Validating email', 'Sending OTP', 'Preparing verification screen']
              : isLogin
              ? ['Checking OTP', 'Securing session', 'Opening dashboard']
              : ['Checking OTP code', 'Validating request', 'Confirming access']
          }
        />
      )}
    </>
  );
}
