'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {CustomerJourneyGuard} from '@/components/auth/customer-journey-guard';
import {useCustomerSession} from '@/components/providers/customer-session-provider';
import {Spinner} from '@/components/ui/spinner';
import {fetchLoanEligibility} from '@/lib/api/eligibility';
import {ApiRequestError} from '@/lib/api/client';
import {
  isLeadRejectedAndLocked,
  type CustomerSessionResponse,
} from '@/lib/api/customer-session';
import {LoanLandingShell} from '@/components/home/loan-landing-shell';

const BENEFIT_TAGS = ['100% Digital', 'Secure verification', 'Continue in minutes'] as const;

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function AmountVisual({ amount, caption }: { amount: string; caption: string }) {
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
          <div className="mt-2 text-[clamp(1.75rem,6vw,2.35rem)] font-black tracking-tight text-white break-words">
            {amount}
          </div>
          <p className="mt-3 text-[0.82rem] font-medium leading-snug text-[rgba(236,243,255,0.82)]">{caption}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Spinner size={40} />
      <p className="m-0 text-sm font-semibold text-brand-muted">Calculating your pre-approved amount…</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-rose-900">
      <p className="m-0 font-bold">{error}</p>
      <button type="button" className="mc-btn-primary mt-4" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function readPreApprovedAmount(session: CustomerSessionResponse | null | undefined): number | null {
  if (!session || session.authenticated !== true) return null;
  const amount = session.preApprovedAmountInr;
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : null;
}

export default function PreApprovedLoanPage() {
  const router = useRouter();
  const { loading: sessionLoading, session, refresh } = useCustomerSession();
  const [amountInr, setAmountInr] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (sessionLoading) return;

    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestIdRef.current === requestId;

    (async () => {
      setError(null);

      // 1) Fast path: amount already on session (post-BRE).
      const fromSession = readPreApprovedAmount(session);
      if (fromSession != null) {
        if (isCurrent()) setAmountInr(fromSession);
        return;
      }

      // 2) Refresh session once (cookie may have just been set after OTP).
      const latest = await refresh();
      if (!isCurrent()) return;

      if (latest.authenticated && latest.lead && isLeadRejectedAndLocked(latest.lead)) {
        router.replace('/thank-you-interest');
        return;
      }

      const fromRefresh = readPreApprovedAmount(latest);
      if (fromRefresh != null) {
        setAmountInr(fromRefresh);
        return;
      }

      // 3) Always try eligibility with the session cookie — do not gate on client session shape.
      try {
        const res = await fetchLoanEligibility();
        if (!isCurrent()) return;
        if (typeof res.preApprovedAmountInr === 'number' && res.preApprovedAmountInr > 0) {
          setAmountInr(res.preApprovedAmountInr);
          return;
        }
        setError('No pre-approved amount is available for your profile yet.');
      } catch (e) {
        if (!isCurrent()) return;
        if (e instanceof ApiRequestError && e.statusCode === 403) {
          router.replace('/thank-you-interest');
          return;
        }
        if (e instanceof ApiRequestError && e.statusCode === 401) {
          setError('Your session expired. Please sign in again and return to this page.');
          return;
        }
        setError(
          e instanceof Error ? e.message : 'Unable to load your pre-approved amount. Please try again.',
        );
      }
    })();
  // `session` is read once at start; `refresh()` loads the latest. Do not depend on `session`
  // or every provider update cancels an in-flight eligibility request.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadKey = manual retry
  }, [sessionLoading, loadKey, router, refresh]);

  let content;

  if (error) {
    content = (
      <ErrorState
        error={error}
        onRetry={() => {
          setError(null);
          setAmountInr(null);
          setLoadKey((k) => k + 1);
        }}
      />
    );
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
            <span className="ml-3 text-[0.7rem] font-black text-slate-400 uppercase tracking-widest">
              Step 3 — Offer
            </span>
          </div>

          <div className="mb-8">
            <AmountVisual amount={formatInr(amountInr)} caption="Secured offer generated." />
          </div>

          <p className="text-[1rem] text-slate-600 leading-relaxed mb-8 font-medium">
            Great news! You have been pre-approved for the amount shown above. Complete your account
            selection to move ahead to disbursement.
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
      <div className="min-h-screen bg-[linear-gradient(135deg,#f0fdf4,#e6f0ff)] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <LoanLandingShell
          journeyPanel={content}
          leftTitle={amountInr !== null ? leftTitle : undefined}
          leftDescription={
            amountInr !== null
              ? 'Your financial profile has been verified. We have generated a custom loan offer just for you. Proceed to claim your amount.'
              : 'We are securely calculating your eligible loan amount based on your profile.'
          }
        />
      </div>
    </CustomerJourneyGuard>
  );
}
