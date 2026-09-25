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

  const mobileFieldClassName = [
    'flex h-14 items-center rounded-full border bg-white px-5 transition-[border-color,box-shadow] duration-200',
    error
      ? 'border-[#C1392B] shadow-[0_0_0_4px_rgba(193,57,43,0.1)]'
      : isFocused
        ? 'border-[#0F2748] shadow-[0_0_0_4px_rgba(15,39,72,0.06)]'
        : 'border-slate-200',
  ].join(' ');

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
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <label className="sr-only" htmlFor="mobile">
        Mobile number
      </label>
      <div className={mobileFieldClassName}>
        <span className="mr-3 shrink-0 text-[0.95rem] font-[600] text-slate-400">+91</span>
        <input
          id="mobile"
          name="mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          placeholder="Mobile number linked with Aadhaar"
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
          className="h-full w-full border-0 bg-transparent text-[1rem] font-[600] text-[#0F2748] caret-[#22C55E] outline-none placeholder:font-[500] placeholder:text-slate-400"
        />
      </div>

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

      <label className="flex cursor-pointer items-start gap-3 text-[0.84rem] leading-snug text-slate-600">
        <input
          type="checkbox"
          name="acceptTerms"
          checked={acceptedTerms}
          onChange={(e) => {
            setAcceptedTerms(e.target.checked);
            if (error?.includes('accept')) setError('');
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#22C55E] focus:ring-[#22C55E]"
        />
        <span>
          I agree to the{' '}
          <Link
            href="/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#16A34A] underline underline-offset-2 hover:text-brand-navy"
            onClick={(e) => e.stopPropagation()}
          >
            Terms
          </Link>
          {' · '}
          <Link
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#16A34A] underline underline-offset-2 hover:text-brand-navy"
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
                className="w-[18px] h-[18px] rounded-full border-2 border-[rgba(15,39,72,0.2)] border-t-[#0F2748] animate-spin-btn"
                aria-hidden
              />
            ) : null}
            <span>{isSubmitting ? 'Sending OTP...' : 'Get OTP'}</span>
          </span>
      </button>
    </form>
  );
}
