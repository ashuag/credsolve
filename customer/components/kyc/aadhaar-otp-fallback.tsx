'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertBanner } from '@/components/ui/alert-banner';
import { OtpInputGrid } from '@/components/ui/otp-input-grid';
import { Spinner } from '@/components/ui/spinner';
import { downloadAadhaarXml, generateAadhaarXmlOtp } from '@/lib/api/aadhaar-xml-otp';
import { getPostDigilockerAadhaarContinuePath } from '@/lib/api/customer-session';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { useOtpInput } from '@/lib/hooks/use-otp-input';

type Step = 'aadhaar' | 'otp';

export function AadhaarOtpFallback({
  onVerified,
  onDigilockerFallback,
}: {
  onVerified?: (href: string) => void;
  onDigilockerFallback?: () => void;
}) {
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const [step, setStep] = useState<Step>('aadhaar');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const otp = useOtpInput(() => setError(''));

  async function continueAfterAadhaarVerified() {
    const next = await refresh();
    const href =
      next.authenticated === true && next.lead
        ? getPostDigilockerAadhaarContinuePath(next)
        : '/kyc/selfie';
    if (onVerified) {
      onVerified(href);
      return;
    }
    router.replace(href);
  }

  async function handleOtpFailure(out: {
    skipReason?: string;
    leadRejected?: boolean;
    terminalFailure?: boolean;
    identityMismatch?: boolean;
    digilockerFallback?: boolean;
  }) {
    if (out.identityMismatch || out.leadRejected) {
      router.replace('/thank-you-interest');
      return true;
    }
    if (out.digilockerFallback) {
      await refresh();
      if (onDigilockerFallback) {
        onDigilockerFallback();
        return true;
      }
    }
    return false;
  }

  async function handleGenerateOtp() {
    setError('');
    const digits = aadhaarNumber.replace(/\D/g, '');
    if (!/^\d{12}$/.test(digits)) {
      setError('Enter a valid 12-digit Aadhaar number.');
      return;
    }
    if (!consent) {
      setError('Please accept consent to fetch your Aadhaar details.');
      return;
    }
    setBusy(true);
    try {
      const out = await generateAadhaarXmlOtp({ aadhaarNumber: digits, consent: true });
      if (out.alreadyCaptured) {
        await continueAfterAadhaarVerified();
        return;
      }
      if (!out.ok) {
        const handled = await handleOtpFailure(out);
        if (handled) return;
        setError(out.skipReason ?? 'Unable to send OTP to the mobile number on this Aadhaar.');
        return;
      }
      otp.clear();
      setStep('otp');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to send Aadhaar OTP.';
      if (/already captured/i.test(message)) {
        await continueAfterAadhaarVerified();
        return;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setError('');
    if (otp.joined.length !== 6) {
      setError('Enter the 6-digit OTP sent to your Aadhaar-registered mobile.');
      return;
    }
    setBusy(true);
    try {
      const out = await downloadAadhaarXml({ otp: otp.joined });
      if (!out.ok) {
        const handled = await handleOtpFailure(out);
        if (handled) return;
        setError(out.skipReason ?? 'Incorrect OTP or Aadhaar download failed. Try again.');
        return;
      }
      await continueAfterAadhaarVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to verify Aadhaar OTP.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-[rgba(18,36,79,0.1)] bg-white/90 p-5">
      <p className="m-0 text-[0.95rem] font-semibold leading-relaxed text-brand-navy">
        Enter your Aadhaar number. We will send an OTP to the mobile number registered with this Aadhaar.
      </p>

      {step === 'aadhaar' ? (
        <>
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-extrabold uppercase tracking-[0.08em] text-slate-500">
              Aadhaar number
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={aadhaarNumber}
              onChange={(e) => {
                setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12));
                setError('');
              }}
              className="box-border min-h-[50px] w-full rounded-[14px] border border-[rgba(18,36,79,0.16)] bg-white px-4 text-[1.05rem] font-semibold tracking-[0.12em] text-brand-navy outline-0 focus:border-[rgba(20,150,243,0.46)] focus:shadow-[0_0_0_3px_rgba(20,150,243,0.12)]"
              placeholder="12-digit Aadhaar"
            />
          </label>
          <label className="flex items-start gap-3 text-[0.88rem] leading-relaxed text-brand-navy">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setError('');
              }}
              className="mt-1 h-4 w-4 accent-brand-blue"
            />
            <span>I consent to fetch my Aadhaar details using OTP sent to the mobile number linked with Aadhaar.</span>
          </label>
          {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
          <button type="button" className="mc-btn-primary w-full" disabled={busy} onClick={() => void handleGenerateOtp()}>
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner size={18} /> Sending OTP…
              </span>
            ) : (
              'Send Aadhaar OTP'
            )}
          </button>
        </>
      ) : (
        <>
          <p className="m-0 text-sm leading-relaxed text-brand-muted">
            Enter the OTP sent to the mobile number registered with Aadhaar ending {aadhaarNumber.slice(-4)}.
          </p>
          <OtpInputGrid
            digits={otp.digits}
            inputRefs={otp.inputRefs}
            onDigitChange={otp.updateDigit}
            onKeyDown={otp.handleKeyDown}
            onPaste={otp.handlePaste}
            ariaLabel="Aadhaar OTP"
          />
          {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}
          <button type="button" className="mc-btn-primary w-full" disabled={busy} onClick={() => void handleVerifyOtp()}>
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner size={18} /> Verifying…
              </span>
            ) : (
              'Verify OTP'
            )}
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-brand-blue"
            disabled={busy}
            onClick={() => {
              setStep('aadhaar');
              setError('');
            }}
          >
            Change Aadhaar number
          </button>
        </>
      )}
    </div>
  );
}
