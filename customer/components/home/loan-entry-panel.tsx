'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileEntryForm } from '@/components/forms/mobile-entry-form';
import { OtpVerificationForm } from '@/app/login/otp-verification-form';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import type { SendOtpResponse } from '@/lib/api/auth';
import { getCustomerJourneyResumePath, hasActiveLoanLead } from '@/lib/api/customer-session';

export function LoanEntryPanel() {
  const router = useRouter();
  const { loading, session } = useCustomerSession();
  const [otpRequest, setOtpRequest] = useState<SendOtpResponse | null>(null);
  const hasActiveLead = useMemo(() => hasActiveLoanLead(session), [session]);
  const resumePath = useMemo(() => getCustomerJourneyResumePath(session), [session]);

  useEffect(() => {
    if (loading) return;
    if (hasActiveLead) {
      router.replace(resumePath);
    }
  }, [hasActiveLead, loading, resumePath, router]);

  if (loading || hasActiveLead) {
    return (
      <section className="mc-card mc-card-glow">
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner size={32} />
        </div>
      </section>
    );
  }

  if (otpRequest) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-[220px] items-center justify-center">
            <Spinner size={32} />
          </div>
        }
      >
        <OtpVerificationForm
          compact
          initialOtpRequest={otpRequest}
          onChangeNumber={() => setOtpRequest(null)}
        />
      </Suspense>
    );
  }

  return (
    <section className="mc-card mc-card-glow" aria-labelledby="entry-heading">
      <div className="mb-[18px] grid gap-[10px]">
        <div className="mc-chip">Step 1 of 4 — Onboarding</div>
        <h2 id="entry-heading" className="m-0 text-[clamp(1.8rem,5vw,2.2rem)] tracking-[-0.04em] text-brand-navy">
          Enter mobile number
        </h2>
        <p className="m-0 leading-[1.6] text-brand-muted">
          We will send a one-time password to continue your loan journey securely.
        </p>
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

      <div className="mt-4 text-sm leading-[1.6] text-brand-muted">
        By continuing, you agree to verification checks and consent to receive an OTP on the entered mobile number.
      </div>

      <div className="mt-[18px] grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <div className="mc-inner-card grid gap-1">
          <span className="text-[0.78rem] font-bold uppercase tracking-[0.11em] text-brand-blue">Journey</span>
          <strong className="text-brand-navy">Eligibility to payout</strong>
        </div>
        <div className="mc-inner-card grid gap-1">
          <span className="text-[0.78rem] font-bold uppercase tracking-[0.11em] text-brand-blue">Instant Cash</span>
          <strong className="text-brand-navy">Short Term Loan</strong>
        </div>
      </div>
    </section>
  );
}
