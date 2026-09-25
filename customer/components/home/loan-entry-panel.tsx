'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileEntryForm } from '@/components/forms/mobile-entry-form';
import { OtpVerificationForm } from '@/app/login/otp-verification-form';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import type { SendOtpResponse } from '@/lib/api/auth';
import { getCustomerJourneyResumePath, hasActiveLoanLead, hasOpenCustomerLoan } from '@/lib/api/customer-session';
export function LoanEntryPanel() {
  const router = useRouter();
  const { loading, session, refresh } = useCustomerSession();
  const [otpRequest, setOtpRequest] = useState<SendOtpResponse | null>(null);
  const [resumePending, setResumePending] = useState(false);
  const resumeAttemptRef = useRef(false);
  const hasActiveLead = useMemo(() => hasActiveLoanLead(session), [session]);
  const hasOpenLoan = useMemo(() => hasOpenCustomerLoan(session), [session]);

  useEffect(() => {
    if (loading) return;

    if (hasOpenLoan) {
      router.replace('/active-loan');
      return;
    }

    if (!hasActiveLead) {
      resumeAttemptRef.current = false;
      setResumePending(false);
      return;
    }
    if (resumeAttemptRef.current) return;

    resumeAttemptRef.current = true;
    setResumePending(true);
    void (async () => {
      const latest = await refresh();
      if (hasOpenCustomerLoan(latest)) {
        router.replace('/active-loan');
        return;
      }
      if (hasActiveLoanLead(latest)) {
        router.replace(getCustomerJourneyResumePath(latest));
        return;
      }
      resumeAttemptRef.current = false;
      setResumePending(false);
    })();
  }, [hasActiveLead, hasOpenLoan, loading, refresh, router]);

  if (loading || resumePending || hasOpenLoan) {
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
        />
      </Suspense>
    );
  }

  return (
    <section className="flex h-full flex-col justify-center" aria-labelledby="entry-heading">
      <h2 id="entry-heading" className="mb-6 text-[1.75rem] font-[800] leading-tight tracking-tight text-[#0F2748]">
        Enter your mobile number
      </h2>

      <Suspense
        fallback={
          <div className="flex min-h-[160px] items-center justify-center">
            <Spinner size={32} />
          </div>
        }
      >
        <MobileEntryForm onSuccess={setOtpRequest} />
      </Suspense>

    </section>
  );
}
