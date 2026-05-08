'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { sendCustomerOtp, type SendOtpResponse } from '@/lib/api/auth';
import { isValidCustomerMobile, normalizeCustomerMobile } from '@/lib/mobile';

const MOBILE_ERROR = 'Please enter a valid mobile number.';

export function MobileEntryForm({ onSuccess }: { onSuccess?: (otpRequest: SendOtpResponse) => void }) {
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
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

    try {
      const otpRequest = await sendCustomerOtp(normalizedMobile);

      onSuccess?.(otpRequest);
    } catch (submissionError) {
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
          aria-describedby={error ? 'mobile-error' : 'mobile-help'}
          className="w-full h-full px-4 border-0 outline-0 bg-transparent text-brand-navy text-[1.08rem] font-bold tracking-[0.01em] caret-brand-blue placeholder:text-[#93a0c1] placeholder:tracking-normal transition-transform duration-[220ms] group-focus-within/field:translate-x-0.5"
        />
      </div>

      <div
        id={error ? 'mobile-error' : 'mobile-help'}
        className={`text-[0.9rem] leading-[1.55] ${error ? 'text-[#b2372d]' : 'text-brand-muted'}`}
      >
        {error || 'We will send a 6-digit OTP to this number to continue.'}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-[0.85rem] leading-snug text-slate-700 transition-colors hover:bg-slate-50">
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
            Terms &amp; Conditions
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-brand-blue underline underline-offset-2 hover:text-brand-navy"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </Link>{' '}
          of MoneyCash.
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
