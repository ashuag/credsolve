'use client';

import { startTransition, useEffect, useState, type SubmitEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SendOtpResponse, sendCustomerOtp, verifyCustomerOtp } from '@/lib/api/auth';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FlowLoader } from '@/components/ui/flow-loader';
import { OtpInputGrid } from '@/components/ui/otp-input-grid';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { getCustomerJourneyResumePath, isLeadRejectedAndLocked } from '@/lib/api/customer-session';
import { useCountdown } from '@/lib/hooks/use-countdown';
import { useOtpInput } from '@/lib/hooks/use-otp-input';
import { formatCustomerMobile, isValidCustomerMobile } from '@/lib/mobile';
import { MobileEntryForm } from '@/components/forms/mobile-entry-form';

const OTP_LENGTH = 6;

type OtpVerificationFormProps = {
  compact?: boolean;
  onChangeNumber?: () => void;
  initialOtpRequest?: SendOtpResponse | null;
  /** After OTP success, navigate here (e.g. `/dashboard` for account login). Overrides default onboarding redirect. */
  successRedirect?: string;
};

export function OtpVerificationForm({
  compact = false,
  onChangeNumber,
  initialOtpRequest = null,
  successRedirect,
}: OtpVerificationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh: refreshCustomerSession } = useCustomerSession();
  const [otpRequest, setOtpRequest] = useState<SendOtpResponse | null>(initialOtpRequest);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const otp = useOtpInput(() => { setError(''); setStatus(''); });
  const resendCountdown = useCountdown(otpRequest?.resendAvailableAt);

  const currentMobile = otpRequest?.mobileNumber ? String(otpRequest.mobileNumber) : '';
  const displayMobile = otpRequest?.maskedMobile ?? formatCustomerMobile(currentMobile);
  const mode = searchParams?.get('mode') ?? null;

  useEffect(() => {
    setOtpRequest(initialOtpRequest);
  }, [initialOtpRequest]);

  useEffect(() => {
    if (compact && !otpRequest) onChangeNumber?.();
  }, [compact, onChangeNumber, otpRequest]);

  function handleOtpRequestSuccess(nextRequest: SendOtpResponse) {
    setOtpRequest(nextRequest);
    otp.clear();
    setError('');
    setStatus('');
  }

  async function handleResendOtp() {
    if (!isValidCustomerMobile(currentMobile) || resendCountdown > 0) return;
    setIsResending(true);
    setError('');
    setStatus('');
    try {
      const nextRequest = await sendCustomerOtp(currentMobile);
      setOtpRequest(nextRequest);
      otp.clear();
      setStatus('A fresh OTP has been sent to your mobile number.');
      otp.inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP right now.');
    } finally {
      setIsResending(false);
    }
  }

  async function handleVerifyOtp(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpRequest) { setError('Request a fresh OTP before trying to verify.'); return; }
    if (new Date(otpRequest.expiresAt).getTime() <= Date.now()) {
      setError('This OTP has expired. Request a new code to continue.');
      return;
    }
    if (otp.joined.length !== OTP_LENGTH) { setError('Enter the 6-digit OTP to continue.'); return; }

    setIsVerifying(true);
    setStatus('');
    setError('');

    try {
      await verifyCustomerOtp(otpRequest.requestId, otp.joined);
      const updatedSession = await refreshCustomerSession();
      startTransition(() => {
        if (updatedSession?.authenticated && isLeadRejectedAndLocked(updatedSession.lead)) {
          router.push('/thank-you-interest');
          return;
        }
        if (successRedirect) {
          router.push(successRedirect);
          return;
        }
        if (mode === 'login') {
          router.push('/dashboard');
          return;
        }
        router.push(getCustomerJourneyResumePath(updatedSession));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify OTP right now.');
      setIsVerifying(false);
    }
  }

  const verificationCard = (
    <section className={compact ? "h-full flex flex-col justify-center" : "mc-card mc-card-glow"}>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-slate-100"></div>
            <div className="h-2 w-8 rounded-full bg-slate-100"></div>
          </div>
          <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">Step 1 — Verification</span>
        </div>

        <h2 className="text-2xl md:text-[1.8rem] font-extrabold text-brand-navy mb-6 tracking-tight leading-[1.1] whitespace-nowrap">
          Verify Your <span className="text-brand-blue">Identity</span> ✨
        </h2>

        {/* Premium Info Box */}
        <div className="flex items-start gap-4 p-4 mb-2 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60 shadow-sm">
          <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-[0.95rem] text-slate-600 leading-relaxed m-0 pt-0.5">
            We sent a secure code to <strong className="text-slate-900 font-bold tracking-wider">{displayMobile}</strong>. Enter it below to continue.
          </p>
        </div>
      </div>

      <form onSubmit={handleVerifyOtp} className="grid gap-[14px]">
        <div className="mb-2">
          <OtpInputGrid
            digits={otp.digits}
            inputRefs={otp.inputRefs}
            onDigitChange={otp.updateDigit}
            onKeyDown={otp.handleKeyDown}
            onPaste={otp.handlePaste}
            ariaLabel="Mobile OTP input"
          />
        </div>

        {otpRequest?.debugOtp && (
          <AlertBanner variant="warn">
            Verification code: <strong>{otpRequest.debugOtp}</strong>
          </AlertBanner>
        )}
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {status && <AlertBanner variant="success">{status}</AlertBanner>}

        <button type="submit" className="mc-btn-primary w-full mt-2" disabled={isVerifying}>
          {isVerifying ? 'Verifying securely...' : 'Verify & Continue'}
        </button>
      </form>

      <div className="flex flex-wrap gap-[10px] mt-6 max-sm:flex-col max-sm:items-stretch">
        <button
          type="button"
          className="flex-1 py-3 px-4 rounded-xl font-bold text-[0.95rem] text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-200"
          onClick={() => {
            setOtpRequest(null);
            otp.clear();
            onChangeNumber?.();
          }}
        >
          Change number
        </button>
        <button
          type="button"
          className="flex-1 py-3 px-4 rounded-xl font-bold text-[0.95rem] text-brand-blue bg-blue-50 hover:bg-blue-100 transition-colors text-center disabled:opacity-50 border border-blue-100"
          onClick={handleResendOtp}
          disabled={isResending || resendCountdown > 0 || !isValidCustomerMobile(currentMobile)}
        >
          {isResending ? 'Sending...' : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
        </button>
      </div>

      {/* Trust Footer */}
      {compact && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-[0.7rem] font-extrabold text-slate-400 uppercase tracking-widest">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Bank-Grade Security
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
            <div className="flex items-center gap-1.5 text-[0.7rem] font-extrabold text-slate-400 uppercase tracking-widest">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              RBI Approved
            </div>
          </div>
        </div>
      )}
    </section>
  );

  const sidePanel = (
    <aside className="mc-card">
      <div className="mc-chip">Next up</div>
      <h2 className="mt-[14px] mb-[10px] text-brand-navy text-[clamp(1.9rem,5vw,2.7rem)] tracking-[-0.05em]">
        Offer review and KYC.
      </h2>
      <p className="text-brand-muted leading-[1.6]">
        After verification, the customer can move into eligibility confirmation, offer review, and final
        submission without leaving the mobile journey.
      </p>
      <div className="grid gap-3 mt-[18px]">
        <div className="mc-inner-card">
          <strong className="text-brand-navy">Step 3</strong>
          <span className="block text-brand-muted leading-[1.6]">Review amount, tenure, and repayment snapshot.</span>
        </div>
        <div className="mc-inner-card bg-gradient-to-br from-[rgba(255,244,204,0.94)] to-[rgba(255,255,255,0.92)]">
          <strong className="text-brand-navy">Step 4</strong>
          <span className="block text-brand-muted leading-[1.6]">
            Confirm request and continue to the disbursal-ready stage.
          </span>
        </div>
      </div>
    </aside>
  );

  if (!otpRequest) {
    if (compact) return null;
    return (
      <>
        <section className="mc-card mc-card-glow">
          <div className="mc-chip">Step 1 of 4</div>
          <h1 className="mt-[14px] mb-3 text-brand-navy text-[clamp(2.2rem,6vw,3.0rem)] leading-[0.96] tracking-[-0.05em]">
            Enter your mobile number.
          </h1>
          <p className="text-brand-muted leading-[1.6]">
            Use your registered number to receive an OTP and continue your MoneyCash journey securely.
          </p>
          <div className="mt-[22px]">
            <MobileEntryForm onSuccess={handleOtpRequestSuccess} />
          </div>
        </section>
        {sidePanel}
      </>
    );
  }

  return (
    <>
      {verificationCard}
      {!compact && sidePanel}

      {isVerifying && (
        <FlowLoader
          eyebrow="Verification in progress"
          title="Verifying your OTP"
          description="Please wait while we validate your code securely."
          steps={['Checking OTP code', 'Validating request', 'Confirming access']}
        />
      )}
    </>
  );
}
