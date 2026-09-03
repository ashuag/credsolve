'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { hasOpenCustomerLoan } from '@/lib/api/customer-session';
import { Spinner } from '@/components/ui/spinner';

function ThankYouContent() {
  const router = useRouter();
  const { loading, session, refresh } = useCustomerSession();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading || !session?.authenticated) return;
    // Loan fully repaid → active lead is cleared so customer can apply again.
    // Do not keep them on the post-application thank-you screen.
    if (!hasOpenCustomerLoan(session) && !session.lead) {
      router.replace('/my-account');
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (session?.authenticated && !hasOpenCustomerLoan(session) && !session.lead) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  const bankVerificationFailed =
    session?.authenticated === true && session.journey.bankVerificationFailed === true;

  const journeyPanel = (
    <div className="h-full flex flex-col justify-center">
      <div className="mb-6">
        <h1 className="text-2xl md:text-[2.5rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
          {bankVerificationFailed ? 'Thank you.' : 'Application Received.'}
        </h1>
        <p className="text-[1rem] text-slate-500 mb-8 leading-relaxed">
          {bankVerificationFailed
            ? 'Thank you for completing your application. Bank verification could not be completed automatically. One of our representatives will call you shortly.'
            : 'Your application is now being processed by our automated systems and lending partners.'}
        </p>

        <div className="grid gap-4 mb-10">
          <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-brand-navy text-[1rem]">
                {bankVerificationFailed ? 'A representative will call' : 'Under Review'}
              </h3>
              <p className="text-[0.85rem] text-slate-500">
                {bankVerificationFailed
                  ? 'One of our team members will contact you shortly to complete bank verification.'
                  : 'Most applications are reviewed within 1–2 business days.'}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-brand-navy text-[1rem]">Check your Email</h3>
              <p className="text-[0.85rem] text-slate-500">
                We&apos;ll notify you via email and SMS as soon as the status changes.
              </p>
            </div>
          </div>
        </div>

        <Link href="/my-account" className="mc-btn-primary block w-full py-4 text-center text-[1rem]">
          Go to My accounts
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f0fdf4,#e6f0ff)] flex items-center justify-center p-4 sm:p-6 md:p-8">
      <LoanLandingShell
        showSpeedometer={!hasOpenCustomerLoan(session)}
        journeyPanel={journeyPanel}
        leftTitle={
          bankVerificationFailed ? (
            <>
              We&apos;ll <span className="text-green-400">call you.</span>
            </>
          ) : (
            <>
              Awesome! <span className="text-green-400">Success.</span>
            </>
          )
        }
        leftDescription={
          bankVerificationFailed
            ? 'Your application is in. A MoneyCash representative will contact you shortly about bank verification.'
            : 'Your loan application journey is complete. Sit back and relax while we handle the rest.'
        }
        leftInfographic={
          <svg
            viewBox="0 0 400 400"
            className="w-full h-full drop-shadow-2xl"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="successGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <circle
              cx="200"
              cy="200"
              r="160"
              fill="rgba(255,255,255,0.1)"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="4"
            />
            <g transform="translate(100, 100)">
              <rect x="0" y="0" width="200" height="200" rx="40" fill="url(#successGrad)" />
              <path
                d="M50 100 L85 135 L150 70"
                stroke="white"
                strokeWidth="24"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        }
        leftStats={[
          { label: '100% paperless', value: '✓' },
          { label: 'Instant approval', value: '✓' },
          { label: 'Zero hidden fees', value: '✓' },
        ]}
      />
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <CustomerJourneyGuard>
      <ThankYouContent />
    </CustomerJourneyGuard>
  );
}
