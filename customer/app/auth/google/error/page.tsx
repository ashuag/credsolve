'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { buildGoogleOAuthStartHref } from '@/lib/api-url';
import { CUSTOMER_EMAIL_VERIFY_PATH } from '@/lib/api/customer-session';

function GoogleAuthErrorContent() {
  const params = useSearchParams();
  const statusRaw = params?.get('status') ?? '';
  const reasonRaw = params?.get('reason')?.trim() ?? '';
  const modeParam = params?.get('mode');
  const leadId = params?.get('leadId')?.trim() ?? undefined;

  const httpStatus = Number.parseInt(statusRaw, 10);
  const isUnauthorized = httpStatus === 401;

  const reason = useMemo(() => (
    reasonRaw.length > 0
      ? reasonRaw
      : 'Google sign-in could not be started. Please sign in with mobile OTP and try again.'
  ), [reasonRaw]);

  const mode = modeParam === 'login' ? 'login' : 'register';

  const retryHref = useMemo(() => {
    const q = new URLSearchParams({ mode });
    if (leadId) {
      q.set('leadId', leadId);
    }
    return buildGoogleOAuthStartHref(q.toString());
  }, [leadId, mode]);

  const backHref = mode === 'login' ? CUSTOMER_EMAIL_VERIFY_PATH : '/email-verify';

  return (
    <div className="flex min-h-[520px] items-center justify-center px-4 py-8">
      <section className="mc-card mc-card-glow w-full max-w-[680px] text-center">
        <div className="mc-chip mx-auto w-fit">Google login</div>
        <h1 className="mt-4 text-brand-navy text-[clamp(2rem,5vw,2.8rem)] tracking-[-0.04em]">
          {isUnauthorized ? 'Please sign in first' : 'Could not continue with Google'}
        </h1>
        <p className="mt-3 text-brand-muted leading-[1.7]">{reason}</p>

        <div className={`mt-7 grid gap-3 ${isUnauthorized ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {isUnauthorized ? (
            <Link href="/apply-for-loan" className="mc-btn-primary inline-flex justify-center">
              Sign in with mobile OTP
            </Link>
          ) : null}
          <Link
            href={retryHref}
            className={`inline-flex justify-center ${isUnauthorized ? 'mc-btn-secondary bg-[rgba(20,150,243,0.08)] text-brand-navy' : 'mc-btn-primary'}`}
          >
            Try Google again
          </Link>
          <Link
            href={backHref}
            className="mc-btn-secondary inline-flex justify-center bg-[rgba(20,150,243,0.08)] text-brand-navy"
          >
            Back to email step
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function GoogleAuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="mc-card w-full max-w-[560px] text-center">
            <div className="mc-chip mx-auto w-fit">Google login</div>
            <p className="mt-4 text-brand-muted">Loading…</p>
          </div>
        </div>
      }
    >
      <GoogleAuthErrorContent />
    </Suspense>
  );
}
