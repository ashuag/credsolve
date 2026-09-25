'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountLoginMobileStrip } from '@/components/account/account-login-mobile-strip';
import { MobileEntryForm } from '@/components/forms/mobile-entry-form';
import { OtpVerificationForm } from '@/app/login/otp-verification-form';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import type { SendOtpResponse } from '@/lib/api/auth';
import {
  getCustomerJourneyResumePath,
  hasActiveLoanLead,
  isCustomerPortalSignedIn,
} from '@/lib/api/customer-session';

export function CustomerLoginPanel() {
  const router = useRouter();
  const { loading, session } = useCustomerSession();
  const [otpRequest, setOtpRequest] = useState<SendOtpResponse | null>(null);
  const hasActiveLead = useMemo(() => hasActiveLoanLead(session), [session]);
  const resumePath = useMemo(() => getCustomerJourneyResumePath(session), [session]);

  useEffect(() => {
    if (loading) return;
    if (isCustomerPortalSignedIn(session) && !session.lead) {
      router.replace('/apply-for-loan');
    }
  }, [loading, router, session]);

  useEffect(() => {
    if (loading) return;
    if (hasActiveLead) {
      router.replace(resumePath);
    }
  }, [hasActiveLead, loading, resumePath, router]);

  if (loading || hasActiveLead || (isCustomerPortalSignedIn(session) && !session.lead)) {
    return (
      <section className="h-full w-full">
        <div className="flex min-h-[220px] h-full items-center justify-center">
          <Spinner size={32} />
        </div>
      </section>
    );
  }

  if (otpRequest) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-[220px] h-full items-center justify-center">
            <Spinner size={32} />
          </div>
        }
      >
        <OtpVerificationForm
          compact
          initialOtpRequest={otpRequest}
          onChangeNumber={() => setOtpRequest(null)}
          successRedirect="/my-account"
        />
      </Suspense>
    );
  }

  return (
    <section className="h-full flex flex-col justify-center" aria-labelledby="login-entry-heading">
      <div className="mb-6 lg:mb-8">
        <div className="lg:hidden mb-5">
          <AccountLoginMobileStrip />
        </div>

        <h2
          id="login-entry-heading"
          className="text-2xl md:text-[1.75rem] font-bold tracking-tight text-brand-navy leading-[1.1]"
        >
          Sign in
        </h2>
        <p className="mt-2 text-[0.9rem] font-medium text-brand-muted">Registered mobile · OTP</p>
      </div>

      <Suspense
        fallback={
          <div className="flex min-h-[160px] items-center justify-center">
            <Spinner size={32} />
          </div>
        }
      >
        <MobileEntryForm onSuccess={setOtpRequest} />
      </Suspense>

      <div className="mt-7 flex flex-col items-center gap-3 border-t border-slate-100 pt-6">
        <Link
          href="/apply-for-loan"
          className="text-[0.88rem] font-bold text-brand-blue underline-offset-4 hover:text-brand-navy hover:underline"
        >
          New here — apply for a loan
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.72rem] text-slate-400">
          <Link href="/terms-and-conditions" className="font-semibold text-blue-600 hover:underline underline-offset-2">
            Terms
          </Link>
          <span aria-hidden className="text-slate-300">
            ·
          </span>
          <Link href="/privacy-policy" className="font-semibold text-blue-600 hover:underline underline-offset-2">
            Privacy
          </Link>
        </div>
      </div>
    </section>
  );
}
