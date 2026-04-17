'use client';

import { startTransition, useEffect, useState, type SubmitEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SendOtpResponse, sendCustomerOtp, verifyCustomerOtp } from '@/lib/api/auth';
import { getCustomerLeadStatus, type CustomerLeadStatusResponse } from '@/lib/api/lead';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FlowLoader } from '@/components/ui/flow-loader';
import { OtpInputGrid } from '@/components/ui/otp-input-grid';
import {
  syncCustomerOnboardingStateFromLeadStatus,
  syncCustomerOnboardingStateFromProfile
} from '@/lib/customer-flow';
import { useCountdown } from '@/lib/hooks/use-countdown';
import { useOtpInput } from '@/lib/hooks/use-otp-input';
import { formatCustomerMobile, isValidCustomerMobile } from '@/lib/mobile';
import { clearCustomerOnboardingState, updateCustomerOnboardingState } from '@/lib/stores/customer-onboarding-store';
import { setCustomerProfile } from '@/lib/stores/customer-session-store';
import { MobileEntryForm } from '@/app/mobile-entry-form';

const OTP_LENGTH = 6;
const EMAIL_VERIFIED_LEAD_STATUSES = new Set(['EMAIL_VERIFIED', 'DETAIL_STARTED', 'SUBMITTED', 'CONVERTED']);

type OtpVerificationFormProps = {
  compact?: boolean;
  onChangeNumber?: () => void;
  initialOtpRequest?: SendOtpResponse | null;
};

export function OtpVerificationForm({
  compact = false,
  onChangeNumber,
  initialOtpRequest = null,
}: OtpVerificationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [otpRequest, setOtpRequest] = useState<SendOtpResponse | null>(initialOtpRequest);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const otp = useOtpInput(() => { setError(''); setStatus(''); });
  const resendCountdown = useCountdown(otpRequest?.resendAvailableAt);

  const currentMobile = otpRequest?.mobileNumber ? String(otpRequest.mobileNumber) : '';
  const displayMobile = otpRequest?.maskedMobile ?? formatCustomerMobile(currentMobile);
  const mode = searchParams.get('mode');

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
      const verification = await verifyCustomerOtp(otpRequest.requestId, otp.joined);
      const nextOnboardingMode = mode === 'login' ? 'login' : 'register';
      const nextProfile = verification.customerId
        ? {
            customerId: verification.customerId,
            mobileNumber: verification.mobileNumber ?? currentMobile,
          }
        : null;
      const leadState: CustomerLeadStatusResponse | null = (
        verification.leadId || verification.leadStatus
          ? {
              leadId: verification.leadId ?? null,
              leadStatus: verification.leadStatus ?? null
            }
          : await getCustomerLeadStatus().catch(() => null)
      );

      if (nextProfile) {
        setCustomerProfile(nextProfile);
      }

      startTransition(() => {
        clearCustomerOnboardingState();

        if (nextProfile) {
          syncCustomerOnboardingStateFromProfile(nextProfile);
        }
        syncCustomerOnboardingStateFromLeadStatus(leadState);

        updateCustomerOnboardingState({
          mobileNumber: nextProfile?.mobileNumber ?? verification.mobileNumber ?? currentMobile,
          leadUuid: leadState?.leadId ?? verification.leadId ?? undefined,
          emailMode: nextOnboardingMode,
          emailVerified: EMAIL_VERIFIED_LEAD_STATUSES.has(leadState?.leadStatus ?? ''),
        });

        router.push(`/onboarding?mode=${nextOnboardingMode}`);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify OTP right now.');
      setIsVerifying(false);
    }
  }

  const verificationCard = (
    <section className="mc-card mc-card-glow">
      <div className="mc-chip">Step 2 of 4</div>
      <h1 className="mt-[14px] mb-3 text-brand-navy text-[clamp(2.2rem,6vw,3.0rem)] leading-[0.96] tracking-[-0.05em]">
        Verify your mobile number.
      </h1>
      <p className="text-brand-muted leading-[1.6]">
        We sent a one-time password to <strong>{displayMobile}</strong>. Enter the code below to continue your
        MoneyCash journey.
      </p>

      <form onSubmit={handleVerifyOtp} className="grid gap-[14px]">
        <div className="my-[22px] mb-[18px]">
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
            Demo OTP: <strong>{otpRequest.debugOtp}</strong>
          </AlertBanner>
        )}
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {status && <AlertBanner variant="success">{status}</AlertBanner>}

        <button type="submit" className="mc-btn-primary w-full" disabled={isVerifying}>
          {isVerifying ? 'Verifying...' : 'Verify OTP'}
        </button>
      </form>

      <div className="flex flex-wrap gap-[10px] mt-4 max-sm:flex-col max-sm:items-stretch">
        <button
          type="button"
          className="mc-btn-secondary text-brand-navy bg-[rgba(20,150,243,0.08)] text-center"
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
          className="mc-btn-secondary text-brand-navy bg-[rgba(255,197,25,0.16)] border-0 cursor-pointer disabled:cursor-wait disabled:opacity-[0.76] disabled:translate-y-0 text-center"
          onClick={handleResendOtp}
          disabled={isResending || resendCountdown > 0 || !isValidCustomerMobile(currentMobile)}
        >
          {isResending ? 'Sending...' : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-[rgba(18,36,79,0.08)] text-brand-muted leading-[1.6]">
        OTPs expire in two minutes. Request a fresh code if the timer completes or you entered the wrong mobile number.
      </div>
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
