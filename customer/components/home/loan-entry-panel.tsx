'use client';

import Link from 'next/link';
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
    <section className="h-full flex flex-col justify-center" aria-labelledby="entry-heading">
      <div className="mb-8">
        {/* Modern Visual Stepper */}
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            <div className="h-2 w-8 rounded-full bg-slate-100"></div>
            <div className="h-2 w-8 rounded-full bg-slate-100"></div>
          </div>
          <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">Step 1 — Onboarding</span>
        </div>

        <h2 id="entry-heading" className="text-2xl md:text-[1.8rem] font-extrabold text-brand-navy mb-6 tracking-tight leading-[1.1] whitespace-nowrap">
          Unlock Your <span className="text-brand-blue">Instant Loan</span> ✨
        </h2>
        
        {/* Premium Info Box */}
        <div className="flex items-start gap-4 p-4 mb-2 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border border-blue-100/60 shadow-sm">
          <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-[0.95rem] text-slate-600 leading-relaxed m-0 pt-0.5">
            Enter your mobile number to begin. We'll send a <strong className="text-slate-900 font-bold">secure 6-digit OTP</strong> to verify your identity.
          </p>
        </div>
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

      {/* Trust & Legal Footer */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex items-center justify-center gap-4 mb-4">
           <div className="flex items-center gap-1.5 text-[0.7rem] font-extrabold text-slate-400 uppercase tracking-widest">
             <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             Bank-Grade Security
           </div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
           <div className="flex items-center gap-1.5 text-[0.7rem] font-extrabold text-slate-400 uppercase tracking-widest">
             <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
             </svg>
             Verified Financial Partners
           </div>
        </div>
        <div className="text-[0.75rem] text-center leading-relaxed text-slate-400">
          Legal:{' '}
          <Link
            href="/terms-and-conditions"
            className="font-bold text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline"
          >
            Terms &amp; Conditions
          </Link>
          {' · '}
          <Link
            href="/privacy-policy"
            className="font-bold text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </section>
  );
}
