'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import { LoanLandingShell } from '@/components/home/loan-landing-shell';

export default function ThankYouInterestPage() {
  const router = useRouter();
  const { loading, session } = useCustomerSession();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!session?.authenticated) {
      router.replace('/apply-for-loan');
      return;
    }

    setCustomerName(session.profile?.fullName?.trim() || null);
    setReady(true);
  }, [loading, session, router]);

  if (loading || !ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={40} />
      </div>
    );
  }

  const greeting = customerName
    ? `Dear ${customerName}, we`
    : 'We';

  const journeyPanel = (
    <div className="h-full flex flex-col justify-center">
      <div className="mb-6">
        <h1 className="text-2xl md:text-[2.5rem] font-extrabold text-brand-navy mb-4 tracking-tight leading-[1.1]">
          Thank You for Your Interest
        </h1>

        <div className="space-y-4 text-[0.95rem] text-slate-500 leading-relaxed mb-10">
          <p>
            {greeting} appreciate you taking the time to complete your application
            with us. Our team has carefully reviewed the information provided as
            part of the evaluation process.
          </p>
          <p>
            Currently, we are unable to continue with the application further. This
            is based on our existing assessment parameters and does not necessarily
            reflect future eligibility.
          </p>
          <p>
            We remain committed to providing a seamless and transparent experience
            for all our users. We encourage you to stay connected with us and
            explore future opportunities that may better suit your profile.
          </p>
          <p>
            Thank you once again for your trust and understanding. We look forward
            to serving you again in the future.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push('/my-account')}
            className="mc-btn-primary block w-full py-4 text-center text-[1rem]"
          >
            Go to My Account
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mc-btn-secondary block w-full py-4 text-center text-[1rem]"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#fffbeb,#fef3c7)] flex items-center justify-center p-4 sm:p-6 md:p-8">
      <LoanLandingShell
        journeyPanel={journeyPanel}
        leftTitle={<>Thank <span className="text-amber-400">You!</span></>}
        leftDescription="We appreciate your interest in MoneyCash. We look forward to serving you in the future."
        leftInfographic={
          <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="heartGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="160" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
            <g transform="translate(100, 100)">
              <rect x="0" y="0" width="200" height="200" rx="40" fill="url(#heartGrad)" />
              <path d="M100 160 C60 120 30 80 60 55 C80 40 100 55 100 75 C100 55 120 40 140 55 C170 80 140 120 100 160Z" fill="white" opacity="0.9" />
              <circle cx="30" cy="30" r="6" fill="#60a5fa" />
              <rect x="160" y="40" width="8" height="8" rx="2" fill="#34d399" transform="rotate(45 164 44)" />
              <circle cx="170" cy="160" r="5" fill="#f87171" />
            </g>
          </svg>
        }
      />
    </div>
  );
}
