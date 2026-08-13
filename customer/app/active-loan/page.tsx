'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerJourneyGuard } from '@/components/auth/customer-journey-guard';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { hasOpenCustomerLoan } from '@/lib/api/customer-session';
import { Spinner } from '@/components/ui/spinner';

export default function ActiveLoanPage() {
  const router = useRouter();
  const { loading, session } = useCustomerSession();

  useEffect(() => {
    if (loading) return;
    if (!session?.authenticated) {
      router.replace('/apply-for-loan');
      return;
    }
    if (!hasOpenCustomerLoan(session)) {
      router.replace('/my-account');
    }
  }, [loading, session, router]);

  if (loading || !session?.authenticated || !hasOpenCustomerLoan(session)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  const journeyPanel = (
    <div className="h-full flex flex-col justify-center">
      <div className="mb-6">
        <h1 className="text-2xl md:text-[2.5rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
          You already have an active loan.
        </h1>
        <p className="text-[1rem] text-slate-500 mb-8 leading-relaxed">
          Please repay your current loan before applying for a new one. Once repayment is complete, you can start a fresh application.
        </p>

        <div className="grid gap-4 mb-10">
          <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-brand-navy text-[1rem]">Repay first</h3>
              <p className="text-[0.85rem] text-slate-500">
                New applications stay locked until your active loan is fully repaid.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-brand-navy text-[1rem]">Pay from My Account</h3>
              <p className="text-[0.85rem] text-slate-500">
                View your outstanding amount, maturity date, and repayment details in one place.
              </p>
            </div>
          </div>
        </div>

        <Link href="/my-account" className="mc-btn-primary block w-full py-4 text-center text-[1rem]">
          Pay Now
        </Link>
      </div>
    </div>
  );

  return (
    <CustomerJourneyGuard>
      <div className="min-h-screen bg-[linear-gradient(135deg,#fffbeb,#e6f0ff)] flex items-center justify-center p-4 sm:p-6 md:p-8">
        <LoanLandingShell
          showSpeedometer={false}
          journeyPanel={journeyPanel}
          leftTitle={
            <>
              Active <span className="text-amber-400">Loan.</span>
            </>
          }
          leftDescription="You have an active loan. Please repay it before applying for a new loan."
          leftStats={[
            { label: 'Status', value: 'Active' },
            { label: 'New loan', value: 'Locked' },
            { label: 'Next step', value: 'Repay' },
          ]}
          leftFeatures={[
            { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Repay to unlock a new application' },
            { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Your loan details stay secure in My Account' },
            { icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'Pay Now to view outstanding balance' },
          ]}
          leftInfographic={
            <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="activeLoanGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <circle cx="200" cy="200" r="160" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
              <g transform="translate(100, 100)">
                <rect x="0" y="0" width="200" height="200" rx="40" fill="url(#activeLoanGrad)" />
                <path
                  d="M100 55 C70 55 55 75 55 100 C55 140 100 165 100 165 C100 165 145 140 145 100 C145 75 130 55 100 55Z"
                  fill="white"
                  opacity="0.95"
                />
                <circle cx="100" cy="95" r="18" fill="#f59e0b" />
                <path d="M100 115 v28" stroke="#f59e0b" strokeWidth="10" strokeLinecap="round" />
                <circle cx="30" cy="30" r="6" fill="#60a5fa" />
                <rect x="160" y="40" width="8" height="8" rx="2" fill="#34d399" transform="rotate(45 164 44)" />
                <circle cx="170" cy="160" r="5" fill="#f87171" />
              </g>
            </svg>
          }
        />
      </div>
    </CustomerJourneyGuard>
  );
}
