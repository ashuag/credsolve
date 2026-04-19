'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { fetchLoanEligibility } from '@/lib/api/eligibility';
import { ApiRequestError } from '@/lib/api/client';

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

const BENEFIT_TAGS = ['100% digital', 'Secure verification', 'Continue in minutes'] as const;

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
    <div className="relative overflow-hidden rounded-[34px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(155deg,#0d1e56,#17327e_52%,#1496f3_140%)] p-6 shadow-[0_28px_64px_rgba(17,33,88,0.28)] max-sm:p-5 min-w-0">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[-10%] top-[-14%] h-[14rem] w-[14rem] rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.3),transparent_70%)] blur-[4px]" />
        <div className="absolute right-[-16%] bottom-[-18%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_72%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.08)_42%,transparent_66%)] -translate-x-[120%] animate-sheen" />
      </div>

      <div className="absolute left-5 top-5 inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] px-3 py-2 text-[0.74rem] font-black uppercase tracking-[0.14em] text-[#fff1bb]">
        Eligible now
      </div>

      <div className="absolute right-5 top-5 inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(7,17,48,0.18)] px-3 py-2 text-[0.74rem] font-bold text-[rgba(236,243,255,0.86)]">
        Secure flow
      </div>

      <div className="relative grid min-h-[390px] place-items-center max-sm:min-h-[340px]">
        <div className="absolute h-[320px] w-[320px] rounded-full border border-[rgba(255,255,255,0.1)] animate-orbit max-sm:h-[260px] max-sm:w-[260px]" />
        <div className="absolute h-[250px] w-[250px] rounded-full border border-dashed border-[rgba(255,197,25,0.34)] animate-orbit-rev max-sm:h-[208px] max-sm:w-[208px]" />
        <div className="absolute h-[192px] w-[192px] rounded-full border border-[rgba(20,150,243,0.36)] animate-pulse-ring max-sm:h-[156px] max-sm:w-[156px]" />
        <div className="absolute h-[290px] w-[290px] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.2),transparent_68%)] animate-pulse-glow max-sm:h-[236px] max-sm:w-[236px]" />
        <div
          className="absolute h-[282px] w-[282px] rounded-full animate-scan-beam opacity-80 max-sm:h-[230px] max-sm:w-[230px]"
          style={{ background: 'conic-gradient(from 220deg, transparent 0deg, rgba(20,150,243,0.26) 58deg, transparent 120deg)' }}
        />
        <span className="absolute h-[12px] w-[12px] rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.42)] animate-orbit-1" />
        <span className="absolute h-[10px] w-[10px] rounded-full bg-brand-gold shadow-[0_0_18px_rgba(255,197,25,0.42)] animate-orbit-2" />
        <span className="absolute h-[9px] w-[9px] rounded-full bg-brand-blue shadow-[0_0_18px_rgba(20,150,243,0.42)] animate-orbit-3" />

        <div className="mc-highlight-card relative z-[1] w-full max-w-[19rem] rounded-[30px] border border-[rgba(255,255,255,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] px-6 py-7 text-center shadow-[0_24px_48px_rgba(5,13,40,0.26)] backdrop-blur-[12px]">
          <div className="text-[0.76rem] font-black uppercase tracking-[0.16em] text-[#fff1bb]">Eligible loan amount</div>
          {loading ? (
            <div className="mt-6 grid justify-items-center gap-4">
              <Spinner size={38} />
              <div className="text-[0.92rem] font-bold text-[rgba(236,243,255,0.88)]">Checking your amount</div>
            </div>
          ) : (
            <div className="mt-4 text-[clamp(3rem,8vw,4.2rem)] font-extrabold leading-none tracking-[-0.06em] text-white">
              {amount}
            </div>
          )}
          <p className="mt-4 mb-0 text-[0.94rem] leading-[1.7] text-[rgba(236,243,255,0.76)]">{caption}</p>
        </div>
      </div>

      <div className="absolute bottom-5 left-5 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] px-3 py-2 text-[0.74rem] font-bold text-[rgba(236,243,255,0.86)]">
        Quick eligibility result
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="relative overflow-hidden rounded-[36px] border border-[rgba(18,36,79,0.08)] bg-[linear-gradient(135deg,#fffefb,#f4f8ff_52%,#eef5ff)] p-6 shadow-[0_24px_54px_rgba(23,44,113,0.08)] max-sm:rounded-[30px] max-sm:p-5">
      <div className="relative grid gap-8 nav:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] nav:items-center">
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mc-chip">Pre-approved loan</span>
            <span className="inline-flex items-center rounded-full bg-[rgba(20,150,243,0.08)] px-3 py-2 text-[0.8rem] font-bold text-brand-navy">
              Checking your amount
            </span>
          </div>

          <div className="grid gap-3">
            <div className="text-[0.8rem] font-black uppercase tracking-[0.16em] text-brand-blue">Decision</div>
            <h1 className="m-0 text-[clamp(2.2rem,5vw,3.7rem)] leading-[0.94] tracking-[-0.06em] text-brand-navy">
              Preparing your pre-approved loan amount.
            </h1>
            <p className="m-0 max-w-[34rem] text-[1rem] leading-[1.75] text-brand-muted">
              We are loading the amount you are eligible for and preparing your next step.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {BENEFIT_TAGS.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full border border-[rgba(18,36,79,0.08)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-[0.84rem] font-bold text-brand-navy"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <AmountVisual amount="..." caption="Finalizing your eligible amount from the quick check." loading />
      </div>
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
  const [amountInr, setAmountInr] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return <ErrorState error={error} />;
  }

  if (amountInr === null) {
    return <LoadingState />;
  }

  const formattedAmount = formatInr(amountInr);

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[36px] border border-[rgba(18,36,79,0.08)] bg-[linear-gradient(135deg,#fffefb,#f4f8ff_52%,#eef5ff)] p-6 shadow-[0_24px_54px_rgba(23,44,113,0.08)] max-sm:rounded-[30px] max-sm:p-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute left-[-8%] top-[-12%] h-[14rem] w-[14rem] rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.22),transparent_70%)]" />
          <div className="absolute right-[-10%] top-[6%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.16),transparent_72%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.16)_42%,transparent_66%)] -translate-x-[120%] animate-sheen" />
        </div>

        <div className="relative z-[1] grid gap-8 nav:grid-cols-[minmax(0,1fr)_minmax(280px,430px)] nav:items-center">
          <div className="grid min-w-0 gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mc-chip">Pre-approved loan</span>
              <span className="inline-flex items-center rounded-full bg-[rgba(20,150,243,0.08)] px-3 py-2 text-[0.8rem] font-bold text-brand-navy">
                Ready to continue
              </span>
            </div>

            <div className="grid gap-3">
              <div className="text-[0.8rem] font-black uppercase tracking-[0.16em] text-brand-blue">Decision</div>
              <h1 className="m-0 min-w-0 max-w-full text-[clamp(1.15rem,3.4vw,3.25rem)] leading-snug tracking-[-0.06em] text-brand-navy text-balance">
                You are pre-approved for{' '}
                <span className="inline-block font-black tabular-nums [overflow-wrap:anywhere]">{formattedAmount}</span>
              </h1>
              <p className="m-0 max-w-[34rem] text-[1rem] leading-[1.75] text-brand-muted">
                This is the loan amount you can continue with right now. Complete your account details to move ahead.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/loan-selection" className="mc-btn-primary min-w-[176px]">
                Continue
              </Link>
              <Link
                href="/"
                className="mc-btn-secondary rounded-[18px] bg-[rgba(20,150,243,0.08)] px-[18px] py-[14px] text-brand-navy"
              >
                Back to home
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {SUMMARY_ITEMS.map((item, index) => (
                <article
                  key={item.label}
                  className="mc-highlight-card rounded-[22px] border border-[rgba(18,36,79,0.08)] bg-[rgba(255,255,255,0.82)] px-4 py-4 shadow-[0_16px_30px_rgba(23,44,113,0.05)]"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,rgba(20,150,243,0.12),rgba(255,197,25,0.22))] text-brand-navy">
                      <SummaryIcon kind={item.kind} />
                    </span>
                    <div>
                      <div className="text-[0.76rem] font-black uppercase tracking-[0.16em] text-brand-blue">{item.label}</div>
                      <div className="mt-1 text-[1rem] font-bold text-brand-navy">{item.value}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {BENEFIT_TAGS.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full border border-[rgba(18,36,79,0.08)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-[0.84rem] font-bold text-brand-navy"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="relative z-[1] min-w-0">
            <AmountVisual amount={formattedAmount} caption="Pre-approved from the quick eligibility check." />
          </div>
        </div>
      </section>

      <section className="mc-card mc-card-glow">
        <div className="grid gap-3 nav:grid-cols-[1fr_auto] nav:items-center">
          <div>
            <div className="text-[0.8rem] font-black uppercase tracking-[0.16em] text-brand-blue">What happens next</div>
            <p className="mt-2 mb-0 max-w-[42rem] text-[0.98rem] leading-[1.75] text-brand-muted">
              Continue to account setup now. Final approval and disbursal move forward after lending partner verification.
            </p>
          </div>
          <Link href="/loan-selection" className="mc-btn-primary">
            Continue
          </Link>
        </div>
      </section>
    </div>
  );
}
