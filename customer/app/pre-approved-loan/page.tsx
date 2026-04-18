'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { fetchLoanEligibility } from '@/lib/api/eligibility';
import { ApiRequestError } from '@/lib/api/client';

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function LoadingState() {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,255,0.96))] px-6 py-8 shadow-[0_22px_48px_rgba(23,44,113,0.08)] max-sm:rounded-[28px] max-sm:px-5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[-10%] top-[-14%] h-[15rem] w-[15rem] rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.24),transparent_70%)]" />
        <div className="absolute right-[-10%] top-[2%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.18),transparent_72%)]" />
      </div>

      <div className="relative mx-auto grid max-w-3xl justify-items-center gap-5 text-center">
        <span className="mc-chip">Pre-approved loan</span>

        <div className="relative grid min-h-[220px] w-full place-items-center overflow-hidden rounded-[30px] border border-[rgba(18,36,79,0.08)] bg-[rgba(255,255,255,0.7)] p-6">
          <div className="absolute h-[180px] w-[180px] rounded-full border border-[rgba(20,150,243,0.22)] animate-pulse-ring" />
          <div className="absolute h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.12),transparent_68%)] animate-pulse-glow" />
          <div className="absolute h-[240px] w-[240px] rounded-full border border-dashed border-[rgba(255,197,25,0.22)] animate-orbit-rev" />
          <div
            className="absolute h-[232px] w-[232px] rounded-full animate-scan-beam opacity-70"
            style={{ background: 'conic-gradient(from 220deg, transparent 0deg, rgba(20,150,243,0.22) 58deg, transparent 120deg)' }}
          />
          <div className="relative z-[1] grid justify-items-center gap-4">
            <Spinner size={42} />
            <div className="text-[0.8rem] font-black uppercase tracking-[0.16em] text-brand-blue">
              Checking amount
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <h1 className="m-0 text-[clamp(2.2rem,6vw,3.6rem)] leading-[0.94] tracking-[-0.06em] text-brand-navy">
            Confirming your pre-approved loan amount.
          </h1>
          <p className="m-0 max-w-[34rem] text-[0.98rem] leading-[1.7] text-brand-muted">
            One moment while we load the amount you are eligible for.
          </p>
        </div>
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

  return (
    <div className="grid gap-5">
      <section className="relative overflow-hidden rounded-[36px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,247,255,0.96))] px-6 py-8 shadow-[0_24px_54px_rgba(23,44,113,0.08)] max-sm:rounded-[28px] max-sm:px-5 max-sm:py-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute left-[-10%] top-[-16%] h-[16rem] w-[16rem] rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.26),transparent_70%)]" />
          <div className="absolute right-[-12%] top-[0%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.18),transparent_72%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.22)_42%,transparent_66%)] -translate-x-[120%] animate-sheen" />
        </div>

        <div className="relative mx-auto grid max-w-4xl justify-items-center gap-6 text-center">
          <span className="mc-chip">Pre-approved loan</span>

          <div className="grid gap-2">
            <div className="text-[0.82rem] font-black uppercase tracking-[0.16em] text-brand-blue">
              Congratulations
            </div>
            <h1 className="m-0 text-[clamp(2.3rem,6vw,4.2rem)] leading-[0.92] tracking-[-0.06em] text-brand-navy max-sm:text-[clamp(2rem,10vw,3rem)]">
              You are pre-approved for {formatInr(amountInr)}
            </h1>
            <p className="m-0 max-w-[40rem] text-[1rem] leading-[1.7] text-brand-muted">
              This is the loan amount you can continue with right now.
            </p>
          </div>

          <div className="relative grid min-h-[280px] w-full place-items-center overflow-hidden rounded-[32px] border border-[rgba(18,36,79,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.62))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="absolute h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.14),transparent_68%)] animate-pulse-glow max-sm:h-[220px] max-sm:w-[220px]" />
            <div className="absolute h-[210px] w-[210px] rounded-full border border-[rgba(20,150,243,0.2)] animate-pulse-ring max-sm:h-[178px] max-sm:w-[178px]" />
            <div className="absolute h-[250px] w-[250px] rounded-full border border-dashed border-[rgba(255,197,25,0.22)] animate-orbit-rev max-sm:h-[208px] max-sm:w-[208px]" />
            <div className="absolute h-[296px] w-[296px] rounded-full border border-[rgba(18,36,79,0.06)] animate-orbit max-sm:h-[242px] max-sm:w-[242px]" />
            <div
              className="absolute h-[276px] w-[276px] rounded-full animate-scan-beam opacity-80 max-sm:h-[226px] max-sm:w-[226px]"
              style={{ background: 'conic-gradient(from 220deg, transparent 0deg, rgba(20,150,243,0.22) 58deg, transparent 120deg)' }}
            />
            <span className="absolute h-[12px] w-[12px] rounded-full bg-brand-blue shadow-[0_0_16px_rgba(20,150,243,0.34)] animate-orbit-1" />
            <span className="absolute h-[10px] w-[10px] rounded-full bg-brand-gold shadow-[0_0_16px_rgba(255,197,25,0.34)] animate-orbit-2" />
            <span className="absolute h-[9px] w-[9px] rounded-full bg-white shadow-[0_0_16px_rgba(255,255,255,0.4)] animate-orbit-3" />

            <div className="mc-highlight-card relative z-[1] w-full max-w-[24rem] rounded-[30px] border border-[rgba(18,36,79,0.08)] bg-[rgba(255,255,255,0.88)] px-6 py-7 shadow-[0_22px_40px_rgba(23,44,113,0.09)] backdrop-blur-[8px]">
              <div className="text-[0.78rem] font-black uppercase tracking-[0.16em] text-brand-blue">
                Eligible loan amount
              </div>
              <div className="mt-3 text-[clamp(3rem,9vw,4.8rem)] font-extrabold leading-none tracking-[-0.06em] text-brand-navy">
                {formatInr(amountInr)}
              </div>
              <p className="mt-4 mb-0 text-[0.98rem] leading-[1.7] text-brand-muted">
                This is your pre-approved loan amount based on the quick check.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/account" className="mc-btn-primary min-w-[176px]">
              Continue
            </Link>
            <Link
              href="/"
              className="mc-btn-secondary rounded-[18px] bg-[rgba(20,150,243,0.08)] px-[18px] py-[14px] text-brand-navy"
            >
              Back to home
            </Link>
          </div>

          <p className="m-0 max-w-[38rem] text-[0.92rem] leading-[1.7] text-brand-muted">
            Continue now to complete your account. Final approval happens after lending partner verification.
          </p>
        </div>
      </section>

      <section className="grid gap-4 nav:grid-cols-3">
        <article className="mc-card mc-highlight-card text-center">
          <div className="text-[0.76rem] font-black uppercase tracking-[0.16em] text-brand-blue">Status</div>
          <div className="mt-2 text-[1.2rem] font-extrabold text-brand-navy">Pre-approved</div>
        </article>

        <article className="mc-card mc-highlight-card text-center" style={{ animationDelay: '90ms' }}>
          <div className="text-[0.76rem] font-black uppercase tracking-[0.16em] text-brand-blue">Next step</div>
          <div className="mt-2 text-[1.2rem] font-extrabold text-brand-navy">Complete account</div>
        </article>

        <article className="mc-card mc-highlight-card text-center" style={{ animationDelay: '180ms' }}>
          <div className="text-[0.76rem] font-black uppercase tracking-[0.16em] text-brand-blue">Final stage</div>
          <div className="mt-2 text-[1.2rem] font-extrabold text-brand-navy">Partner verification</div>
        </article>
      </section>
    </div>
  );
}
