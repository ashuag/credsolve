'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { sendCustomerOtp, type SendOtpResponse } from '@/lib/api/auth';
import { isVpnBlockedError } from '@/lib/api/client';
import { isValidCustomerMobile, normalizeCustomerMobile } from '@/lib/mobile';

const MOBILE_ERROR = 'Please enter a valid mobile number.';

export function MobileEntryForm({ onSuccess }: { onSuccess?: (otpRequest: SendOtpResponse) => void }) {
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [vpnBlocked, setVpnBlocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const hasActiveMobileBorder = !error && (isFocused || mobileNumber.length > 0);
  const mobileFieldClassName = `group/field relative isolate overflow-hidden grid items-center min-h-[56px] rounded-[16px] border bg-white transition-all duration-[220ms] ${error ? 'border-[rgba(193,57,43,0.42)] shadow-[0_0_0_3px_rgba(193,57,43,0.08)]' : hasActiveMobileBorder ? 'border-[rgba(20,150,243,0.46)] shadow-[0_22px_42px_rgba(23,44,113,0.12),0_0_0_6px_rgba(20,150,243,0.08)]' : 'border-[rgba(18,36,79,0.16)] shadow-[0_10px_18px_rgba(23,44,113,0.04)]'} ${isFocused ? 'focus-within:-translate-y-0.5 focus-within:scale-[1.01] focus-within:animate-mobile-border-pulse' : ''}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedMobile = normalizeCustomerMobile(mobileNumber);

    if (!isValidCustomerMobile(normalizedMobile)) {
      setError(MOBILE_ERROR);
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setVpnBlocked(false);

    try {
      const otpRequest = await sendCustomerOtp(normalizedMobile);

      onSuccess?.(otpRequest);
    } catch (submissionError) {
      setVpnBlocked(isVpnBlockedError(submissionError));
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to send OTP right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 group/form" noValidate>
      <label
        className="text-[0.95rem] font-extrabold text-brand-navy transition-colors duration-[180ms] group-focus-within/form:text-brand-blue group-focus-within/form:-translate-y-px"
        htmlFor="mobile"
      >
        Mobile number
      </label>

      <div className={mobileFieldClassName} style={{ gridTemplateColumns: '78px 1fr' }}>
          <span
            className="inline-flex justify-center items-center h-full border-r border-[rgba(18,36,79,0.1)] text-brand-navy font-extrabold transition-colors duration-[180ms] group-focus-within/field:text-brand-blue group-focus-within/field:border-r-[rgba(20,150,243,0.16)]"
          >
            +91
          </span>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          placeholder="9876543210"
          required
          value={mobileNumber}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          onChange={(event) => {
            const nextValue = normalizeCustomerMobile(event.target.value);
            setMobileNumber(nextValue);
            if (error && isValidCustomerMobile(nextValue)) {
              setError('');
            }
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'mobile-error' : 'mobile-help-sr'}
          className="w-full h-full px-4 border-0 outline-0 bg-transparent text-brand-navy text-[1.08rem] font-bold tracking-[0.01em] caret-brand-blue placeholder:text-[#93a0c1] placeholder:tracking-normal transition-transform duration-[220ms] group-focus-within/field:translate-x-0.5"
        />
      </div>

      <p className="-mt-0.5 flex items-center gap-2 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">
        <svg className="h-3.5 w-3.5 text-[#1496f3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        OTP · SMS
      </p>

      <span id="mobile-help-sr" className="sr-only">
        We send a one-time 6-digit code by SMS to verify your mobile number.
      </span>
      {error && vpnBlocked ? (
        <div
          id="mobile-error"
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[0.88rem] leading-[1.5] text-amber-900"
        >
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14A2 2 0 003.83 21h16.34a2 2 0 001.72-3.14l-8.18-14a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="m-0 font-bold">VPN / proxy detected</p>
            <p className="m-0 mt-0.5">{error}</p>
            <p className="m-0 mt-1.5 text-[0.78rem] font-semibold text-amber-700">
              Turn off your VPN or proxy app, then tap Get OTP again.
            </p>
          </div>
        </div>
      ) : error ? (
        <div id="mobile-error" className="text-[0.9rem] leading-[1.55] text-[#b2372d]">
          {error}
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[rgba(18,36,79,0.08)] bg-gradient-to-br from-white to-[rgba(244,249,255,0.95)] px-4 py-3.5 text-[0.82rem] leading-snug text-slate-700 shadow-[0_8px_24px_rgba(23,44,113,0.05)] transition-[border-color,box-shadow] hover:border-[rgba(20,150,243,0.22)] hover:shadow-[0_12px_28px_rgba(23,44,113,0.07)]">
        <input
          type="checkbox"
          name="acceptTerms"
          checked={acceptedTerms}
          onChange={(e) => {
            setAcceptedTerms(e.target.checked);
            if (error?.includes('accept')) setError('');
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
        />
        <span>
          I agree to the{' '}
          <Link
            href="/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-blue underline underline-offset-2 hover:text-brand-navy"
            onClick={(e) => e.stopPropagation()}
          >
            Terms
          </Link>
          {' · '}
          <Link
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-blue underline underline-offset-2 hover:text-brand-navy"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy
          </Link>
        </span>
      </label>

      <button type="submit" className="mc-btn-primary w-full" disabled={isSubmitting || !acceptedTerms}>
          <span className="inline-flex items-center justify-center gap-[10px]">
            {isSubmitting ? (
              <span
                className="w-[18px] h-[18px] rounded-full border-2 border-[rgba(255,248,223,0.28)] border-t-[#fff8df] animate-spin-btn"
                aria-hidden
              />
            ) : null}
            <span>{isSubmitting ? 'Sending OTP...' : 'Get OTP'}</span>
          </span>
      </button>
    </form>
  );
}
