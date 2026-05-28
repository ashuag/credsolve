'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {CustomerJourneyGuard} from '@/components/auth/customer-journey-guard';
import {useCustomerSession} from '@/components/providers/customer-session-provider';
import {Spinner} from '@/components/ui/spinner';
import {fetchLoanEligibility} from '@/lib/api/eligibility';
import {ApiRequestError} from '@/lib/api/client';
import {isLeadRejectedAndLocked} from '@/lib/api/customer-session';
import {LoanLandingShell} from '@/components/home/loan-landing-shell';

const SUMMARY_ITEMS = [
  {
    label: 'Status',
    value: 'Pre-approved',
    kind: 'check'
  },
  {
    label: 'Next step',
    value: 'Complete account',
    kind: 'profile'
  },
  {
    label: 'Final stage',
    value: 'Verification',
    kind: 'shield'
  }
] as const;

const BENEFIT_TAGS = ['100% Digital', 'Secure verification', 'Continue in minutes'] as const;

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function SummaryIcon({ kind }: { kind: (typeof SUMMARY_ITEMS)[number]['kind'] }) {
  if (kind === 'profile') {
    return (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M12 3 5 6v5.4c0 4.4 2.8 8 7 9.6 4.2-1.6 7-5.2 7-9.6V6Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m9.4 12.2 1.8 1.9 3.5-3.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="m7.5 12.5 2.6 2.6 6-6.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AmountVisual({
  amount,
  caption,
  loading = false
}: {
  amount: string;
  caption: string;
  loading?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(145deg,#0f1f57,#1b3788_58%,#1b91e8_120%)] p-4 shadow-[0_18px_40px_rgba(17,33,88,0.24)] sm:rounded-[24px] sm:p-5 min-w-0">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[-15%] top-[-20%] h-[12rem] w-[12rem] rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.24),transparent_70%)]" />
        <div className="absolute right-[-20%] bottom-[-20%] h-[16rem] w-[16rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_74%)]" />
      </div>

      <div className="absolute left-4 top-4 inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#fff1bb]">
        Eligible now
      </div>

      <div className="absolute right-4 top-4 inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(7,17,48,0.18)] px-3 py-1.5 text-[0.68rem] font-bold text-[rgba(236,243,255,0.86)]">
        Secure flow
      </div>

      <div className="relative grid min-h-[238px] place-items-center sm:min-h-[280px]">
        <div className="absolute h-[226px] w-[226px] rounded-full border border-[rgba(255,255,255,0.1)] sm:h-[250px] sm:w-[250px]" />
        <div className="absolute h-[184px] w-[184px] rounded-full border border-dashed border-[rgba(255,197,25,0.24)] sm:h-[206px] sm:w-[206px]" />
        <div className="absolute h-[140px] w-[140px] rounded-full border border-[rgba(20,150,243,0.32)] sm:h-[156px] sm:w-[156px]" />
        <div className="absolute h-[208px] w-[208px] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.16),transparent_68%)] sm:h-[230px] sm:w-[230px]" />

        <div className="relative z-[1] w-full min-w-0 max-w-[min(17rem,100%)] rounded-[20px] border border-[rgba(255,255,255,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] px-4 py-5 text-center shadow-[0_16px_32px_rgba(5,13,40,0.26)] backdrop-blur-[10px] sm:max-w-[min(19rem,100%)] sm:rounded-[24px] sm:px-6 sm:py-6">
          <div className="text-[0.76rem] font-black uppercase tracking-[0.16em] text-[#fff1bb]">Eligible loan amount</div>
          {loading ? (
            <div className="mt-6 grid justify-items-center gap-4">
              <Spinner size={38} />
              <div className="text-[0.92rem] font-bold text-[rgba(236,243,255,0.88)]">Checking your amount</div>
            </div>
          ) : (
            <div className="mt-3 w-full min-w-0 break-words text-[clamp(1.5rem,7vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.05em] text-white [overflow-wrap:anywhere]">
              {amount}
            </div>
          )}
          <p className="mt-3 mb-0 text-[0.94rem] leading-[1.6] text-[rgba(236,243,255,0.76)]">{caption}</p>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[0.68rem] font-bold text-[rgba(236,243,255,0.86)]">
        Quick eligibility result
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="grid gap-3">
      <div className="rounded-[22px] border border-[rgba(18,36,79,0.08)] bg-white/90 p-4 shadow-[0_12px_24px_rgba(23,44,113,0.07)]">
        <div className="inline-flex rounded-full bg-[rgba(20,150,243,0.08)] px-3 py-1.5 text-[0.72rem] font-black uppercase tracking-[0.14em] text-brand-blue">
          Pre-approved loan
        </div>
        <h1 className="m-0 mt-3 text-[clamp(1.35rem,6.8vw,2.1rem)] leading-tight tracking-[-0.03em] text-brand-navy">
          Preparing your pre-approved amount.
        </h1>
        <p className="m-0 mt-2 text-[0.92rem] leading-[1.55] text-brand-muted">
          We are loading your eligible amount and the next step.
        </p>
      </div>
      <AmountVisual amount="..." caption="Finalizing your eligible amount from the quick check." loading />
    </section>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <section className="mc-card mc-card-glow mx-auto grid max-w-2xl gap-4 text-center">
      <div className="mx-auto mc-chip">Pre-approved loan</div>
      <h1 className="m-0 text-[clamp(2rem,5vw,3rem)] leading-[0.96] tracking-[-0.05em] text-brand-navy">
        We could not load your loan amount.
      </h1>
      <p className="m-0 text-[0.98rem] leading-[1.7] text-brand-muted">{error}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/onboarding" className="mc-btn-primary">
          Back to onboarding
        </Link>
        <Link href="/" className="mc-btn-secondary bg-[rgba(20,150,243,0.08)] text-brand-navy">
          Back to home
        </Link>
      </div>
    </section>
  );
}

export default function PreApprovedLoanPage() {
  const router = useRouter();
  const { loading: sessionLoading, session } = useCustomerSession();
  const [amountInr, setAmountInr] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;

    if (!session?.authenticated || !session.lead) {
      router.replace('/apply-for-loan');
      return;
    }

    if (isLeadRejectedAndLocked(session.lead)) {
      router.replace('/thank-you-interest');
      return;
    }
  }, [sessionLoading, session, router]);

  useEffect(() => {
    if (sessionLoading || !session?.authenticated || !session.lead) return;
    if (isLeadRejectedAndLocked(session.lead)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetchLoanEligibility();
        if (!cancelled) {
          setAmountInr(res.preApprovedAmountInr);
        }
      } catch (e) {
        if (cancelled) {
          return;
        }

        if (e instanceof ApiRequestError && e.statusCode === 401) {
          router.replace('/apply-for-loan');
          return;
        }

        if (e instanceof ApiRequestError && e.statusCode === 403) {
          router.replace('/thank-you-interest');
          return;
        }

        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionLoading, session, router]);

  let content;

  if (error) {
    content = <ErrorState error={error} />;
  } else if (amountInr === null) {
    content = (
      <div className="h-full flex flex-col justify-center">
        <LoadingState />
      </div>
    );
  } else {
    content = (
      <div className="h-full flex flex-col justify-center py-4">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex gap-1.5">
              <div className="h-2 w-8 rounded-full bg-blue-600"></div>
              <div className="h-2 w-8 rounded-full bg-blue-600"></div>
              <div className="h-2 w-8 rounded-full bg-blue-600"></div>
              <div className="h-2 w-8 rounded-full bg-blue-600"></div>
            </div>
            <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">Step 3 — Offer</span>
          </div>

          <div className="mb-8">
            <AmountVisual amount={formatInr(amountInr)} caption="Secured offer generated." />
          </div>
          
          <p className="text-[1rem] text-slate-600 leading-relaxed mb-8 font-medium">
            Great news! You have been pre-approved for the amount shown above. Complete your account selection to move ahead to disbursement.
          </p>

          <Link href="/loan-selection" className="mc-btn-primary block w-full text-center py-4 text-[1rem]">
            Continue to Selection
          </Link>

          <div className="mt-10 flex flex-nowrap justify-between items-center gap-2 py-1 w-full border-t border-slate-100 pt-6">
            {BENEFIT_TAGS.map((tag) => (
              <div
                key={tag}
                className="flex items-center gap-1.5 text-[0.75rem] font-bold text-slate-500 uppercase tracking-tight"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const leftTitle = (
    <>
      Congratulations! <span className="text-[#facc15]">🎉</span>
    </>
  );

  return (
    <CustomerJourneyGuard>
      <LoanLandingShell
        journeyPanel={content}
        leftTitle={amountInr !== null ? leftTitle : undefined}
        leftDescription={
          amountInr !== null
            ? "Your financial profile has been verified. We have generated a custom loan offer just for you. Proceed to claim your amount."
            : "We are securely calculating your eligible loan amount based on your profile."
        }
      />
    </CustomerJourneyGuard>
  );
}
