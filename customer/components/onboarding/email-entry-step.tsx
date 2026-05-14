'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { SendEmailOtpResponse, sendEmailOtp } from '@/lib/api/auth';
import { buildGoogleOAuthStartHref } from '@/lib/api-url';
import { AlertBanner } from '@/components/ui/alert-banner';
import { isValidEmail } from '@/lib/validators';

export type EmailMode = 'register' | 'login';
type LoginOption = 'manual' | null;

type EmailEntryStepProps = {
  initialEmail?: string;
  initialMode?: EmailMode;
  /** Active lead uuid from the server session (for Google redirect state). */
  leadUuid?: string | null;
  onNext: (email: string, mode: EmailMode, otpRequest: SendEmailOtpResponse) => void;
};

export function EmailEntryStep({ initialEmail = '', initialMode = 'register', leadUuid, onNext }: EmailEntryStepProps) {
  const mode = initialMode;
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState('');
  const [optionError, setOptionError] = useState('');
  const [selectedOption, setSelectedOption] = useState<LoginOption>(initialEmail ? 'manual' : null);
  const [isSending, setIsSending] = useState(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [email, initialEmail]);

  useEffect(() => {
    if (initialEmail) {
      setSelectedOption('manual');
    }
  }, [initialEmail]);

  useEffect(() => {
    if (selectedOption === 'manual') {
      emailInputRef.current?.focus();
    }
  }, [selectedOption]);

  function validate(value: string) {
    return isValidEmail(value);
  }

  function handleGoogleLogin() {
    setOptionError('');
    setEmailError('');
    const searchParams = new URLSearchParams({ mode });
    if (leadUuid?.trim()) {
      searchParams.set('leadId', leadUuid.trim());
    }

    window.location.assign(buildGoogleOAuthStartHref(searchParams.toString()));
  }

  function handleManualLogin() {
    setSelectedOption('manual');
    setOptionError('');
    setEmailError('');
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (!validate(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setIsSending(true);
    setOptionError('');
    setEmailError('');

    try {
      const otpRequest = await sendEmailOtp(trimmed);
      onNext(trimmed, mode, otpRequest);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Unable to send OTP right now. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <>
      <section className="h-full flex flex-col" aria-labelledby="email-heading">
        <div className="mb-4">
          <h2
            id="email-heading"
            className="text-xl md:text-[1.8rem] font-extrabold text-brand-navy mb-3 tracking-tight leading-[1.1]"
          >
            {isLogin ? (
              <>
                Continue with <span className="text-brand-blue">email</span> ✨
              </>
            ) : (
              <>
                Verify Your <span className="text-brand-blue">Email</span> ✨
              </>
            )}
          </h2>

          <div className="flex items-start gap-3 p-3 mb-2 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60">
            <div className="p-1.5 bg-white rounded-xl shadow-sm text-blue-600 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <p className="text-[0.88rem] text-slate-600 leading-relaxed m-0 pt-0.5">
              {isLogin
                ? 'Choose Google login or enter your email ID manually to continue.'
                : 'Choose an option below to securely link your email address.'}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full rounded-[20px] border border-[rgba(18,36,79,0.14)] bg-white px-5 py-4 text-left shadow-[0_12px_24px_rgba(23,44,113,0.06)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[rgba(20,150,243,0.2)] hover:shadow-[0_18px_32px_rgba(23,44,113,0.1)]"
          >
            <span className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(18,36,79,0.08)] bg-[rgba(255,255,255,0.96)] shadow-[0_8px_18px_rgba(23,44,113,0.08)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M21.6 12.23c0-.68-.06-1.34-.17-1.97H12v3.73h5.39a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.97-4.33 2.97-7.31Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.9 6.61-2.44l-3.24-2.52c-.9.6-2.05.96-3.37.96-2.59 0-4.78-1.75-5.56-4.1H3.09v2.6A9.99 9.99 0 0 0 12 22Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.44 13.9A5.99 5.99 0 0 1 6.13 12c0-.66.11-1.3.31-1.9V7.5H3.09A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.09 4.5l3.35-2.6Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.98c1.47 0 2.79.5 3.83 1.48l2.87-2.87C16.95 2.96 14.69 2 12 2A9.99 9.99 0 0 0 3.09 7.5l3.35 2.6c.78-2.35 2.97-4.12 5.56-4.12Z"
                  />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[1rem] font-extrabold text-brand-navy">Login with Google</span>
                <span className="mt-1 block text-[0.92rem] leading-[1.55] text-brand-muted">
                  Use your Google account to continue.
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleManualLogin}
            className={`w-full rounded-[20px] border px-5 py-4 text-left shadow-[0_12px_24px_rgba(23,44,113,0.06)] transition-all duration-[220ms] ${
              selectedOption === 'manual'
                ? 'border-[rgba(20,150,243,0.34)] bg-[rgba(20,150,243,0.08)] shadow-[0_0_0_4px_rgba(20,150,243,0.08),0_18px_32px_rgba(23,44,113,0.08)]'
                : 'border-[rgba(18,36,79,0.14)] bg-white hover:-translate-y-0.5 hover:border-[rgba(20,150,243,0.2)] hover:shadow-[0_18px_32px_rgba(23,44,113,0.1)]'
            }`}
            aria-pressed={selectedOption === 'manual'}
          >
            <span className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(18,36,79,0.08)] bg-[rgba(20,150,243,0.08)] shadow-[0_8px_18px_rgba(23,44,113,0.08)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-navy" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9Z" />
                  <path d="m5 7 7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[1rem] font-extrabold text-brand-navy">Login manually</span>
                <span className="mt-1 block text-[0.92rem] leading-[1.55] text-brand-muted">
                  Enter your email id to receive a one-time password.
                </span>
              </span>
            </span>
          </button>
        </div>

        {optionError && (
          <div className="mt-3">
            <AlertBanner variant="error">{optionError}</AlertBanner>
          </div>
        )}

        {selectedOption === 'manual' ? (
          <form onSubmit={handleSubmit} className="grid gap-3 mt-[22px] group/form" noValidate>
            <label
              htmlFor="email"
              className="text-[0.95rem] font-extrabold text-brand-navy transition-colors duration-[180ms] group-focus-within/form:text-brand-blue group-focus-within/form:-translate-y-px"
            >
              Email address
            </label>

            <div
              className={`group/field relative isolate overflow-hidden grid items-center min-h-[56px] rounded-[16px] border bg-white shadow-[0_10px_18px_rgba(23,44,113,0.04)] transition-all duration-[220ms] focus-within:-translate-y-0.5 focus-within:scale-[1.01] focus-within:border-[rgba(20,150,243,0.46)] focus-within:shadow-[0_22px_42px_rgba(23,44,113,0.12),0_0_0_6px_rgba(20,150,243,0.08)] ${
                emailError
                  ? 'border-[rgba(193,57,43,0.42)] shadow-[0_0_0_3px_rgba(193,57,43,0.08)]'
                  : 'border-[rgba(18,36,79,0.16)]'
              }`}
              style={{ gridTemplateColumns: '58px 1fr' }}
            >
              <span className="inline-flex justify-center items-center h-full border-r border-[rgba(18,36,79,0.1)] text-brand-navy transition-colors duration-[180ms] group-focus-within/field:text-brand-blue group-focus-within/field:border-r-[rgba(20,150,243,0.16)]">
                <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path
                    d="M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm0 0v1.5a2 2 0 0 0 4 0V10a8 8 0 1 0-3.3 6.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => {
                  const next = event.target.value;
                  setEmail(next);
                  if (emailError && validate(next.trim())) setEmailError('');
                }}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'email-error' : 'email-help'}
                className="w-full h-full px-4 border-0 outline-0 bg-transparent text-brand-navy text-[1.08rem] font-bold tracking-[0.01em] caret-brand-blue placeholder:text-[#93a0c1] placeholder:tracking-normal transition-transform duration-[220ms] group-focus-within/field:translate-x-0.5"
              />
            </div>

            <p
              id={emailError ? 'email-error' : 'email-help'}
              className={`text-[0.9rem] leading-[1.55] ${emailError ? 'text-[#b2372d]' : 'text-brand-muted'}`}
            >
              {emailError || (isLogin
                ? "We'll send a 6-digit OTP to this email to authenticate you."
                : 'Your email is only used for loan-related communications.')}
            </p>

          <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm mt-4 pb-[max(12px,env(safe-area-inset-bottom))] -mx-5 px-5 pt-3 border-t border-slate-100 lg:mx-0 lg:px-0">
            <button type="submit" className="mc-btn-primary w-full" disabled={isSending}>
              <span className="inline-flex items-center justify-center gap-[10px]">
                {isSending ? (
                  <span
                    className="w-[18px] h-[18px] rounded-full border-2 border-[rgba(255,248,223,0.28)] border-t-[#fff8df] animate-spin-btn"
                    aria-hidden
                  />
                ) : null}
                <span>{isSending ? 'Sending OTP...' : isLogin ? 'Send login OTP' : 'Send verification OTP'}</span>
              </span>
            </button>
          </div>
          </form>
        ) : null}
      </section>
    </>
  );
}
