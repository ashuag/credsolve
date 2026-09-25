'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchCustomerPaymentHistory,
  type CustomerPaymentHistoryItem,
} from '@/lib/api/customer-loans';
import { isCustomerPortalSignedIn } from '@/lib/api/customer-session';
import { isCustomerSessionRequiredMessage } from '@/lib/customer-session-required';
import { LoggedOutRedirectModal } from '@/components/auth/logged-out-redirect-modal';
import { formatInr } from '@/lib/format-inr';
import { cn } from '@/lib/cn';
import { useRouter } from 'next/navigation';

function formatPaidAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PaymentCard({ payment }: { payment: CustomerPaymentHistoryItem }) {
  const failed = payment.status === 'FAILED';
  const partial = payment.status === 'PARTIAL';
  return (
    <article
      className={cn(
        'rounded-[22px] border bg-white p-5 shadow-[0_12px_32px_rgba(23,44,113,0.06)]',
        failed ? 'border-rose-200' : partial ? 'border-amber-200' : 'border-[rgba(18,36,79,0.1)]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">
            Loan {payment.loanNumber}
          </p>
          <p className="mt-1 text-[1.55rem] font-black tracking-tight text-brand-navy">
            {formatInr(payment.amount)}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-wider',
            failed
              ? 'bg-rose-100 text-rose-800'
              : partial
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800',
          )}
        >
          {failed ? 'Unsuccessful' : partial ? 'Partially paid' : 'Paid fully'}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-[0.9rem]">
        <div className="flex justify-between gap-3 border-t border-[rgba(18,36,79,0.06)] pt-3">
          <dt className="text-brand-muted">Paid on</dt>
          <dd className="font-bold text-brand-navy">{formatPaidAt(payment.paidAt)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Mode</dt>
          <dd className="font-bold text-brand-navy">{payment.paymentMode}</dd>
        </div>
        {failed ? (
          <div className="mt-1 rounded-xl bg-rose-50 px-3 py-2.5 text-[0.85rem] font-semibold text-rose-800">
            {payment.failureMessage ?? 'Payment was unsuccessful.'}
          </div>
        ) : (
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Reference</dt>
            <dd className="font-mono text-[0.82rem] font-bold text-brand-navy">
              {payment.utr ?? '—'}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export default function PaymentsPage() {
  const router = useRouter();
  const { session, loading: sessionLoading, refresh } = useCustomerSession();
  const signedIn = isCustomerPortalSignedIn(session);
  const [payments, setPayments] = useState<CustomerPaymentHistoryItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    setLoadError(null);
    try {
      const res = await fetchCustomerPaymentHistory();
      setPayments(res?.payments ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to load payment history.';
      setLoadError(message);
      setPayments([]);
      if (isCustomerSessionRequiredMessage(message)) {
        setSessionExpired(true);
      }
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (sessionExpired) return;
    if (sessionLoading) return;
    if (!signedIn) {
      router.replace('/my-account?mode=login');
      return;
    }
    void load();
  }, [sessionLoading, signedIn, router, load, sessionExpired]);

  const onRetry = async () => {
    await refresh();
    await load();
  };

  if (sessionExpired) {
    return <LoggedOutRedirectModal />;
  }

  if (sessionLoading || (fetching && payments.length === 0 && !loadError)) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  const successful = payments.filter((p) => p.status === 'SUCCESS' || p.status === 'PARTIAL');
  const failed = payments.filter((p) => p.status === 'FAILED');
  const latestSuccess = successful[0] ?? null;

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(20,150,243,0.12),transparent_70%)]" />
        <div className="absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.16),transparent_70%)]" />
      </div>

      <div className="relative grid gap-6">
        <header>
          <p className="inline-flex rounded-full bg-[rgba(20,150,243,0.12)] px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-brand-navy">
            Payments
          </p>
          <h1 className="mt-3 text-[clamp(1.7rem,4vw,2.2rem)] font-bold tracking-tight text-brand-navy">
            Your repayment history
          </h1>
          <p className="mt-2 max-w-xl text-brand-muted leading-relaxed">
            Actual amounts paid toward your CredSolve loans — including unsuccessful attempts.
          </p>
        </header>

        {latestSuccess ? (
          <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-5 py-5">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-emerald-700">
              Latest successful payment
            </p>
            <p className="mt-2 text-[1.8rem] font-black text-brand-navy">
              {formatInr(latestSuccess.amount)}
            </p>
            <p className="mt-1 text-[0.9rem] text-brand-muted">
              Loan {latestSuccess.loanNumber} · {formatPaidAt(latestSuccess.paidAt)}
            </p>
            <Link
              href="/my-account"
              className="mt-4 inline-flex rounded-2xl bg-brand-navy px-4 py-2.5 text-[0.9rem] font-extrabold text-white"
            >
              Back to My Account
            </Link>
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-rose-900">
            <p className="font-bold">{loadError}</p>
            <button type="button" className="mc-btn-primary mt-4" onClick={() => void onRetry()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loadError && payments.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[rgba(18,36,79,0.18)] bg-white/80 px-5 py-10 text-center">
            <p className="text-lg font-extrabold text-brand-navy">No payments yet</p>
            <p className="mt-2 text-brand-muted">
              When you repay an active loan, the real amount and status will appear here.
            </p>
            <Link href="/my-account" className="mc-btn-primary mt-5 inline-flex">
            Go to My Account
          </Link>
          <Link
            href="/apply-for-loan"
            className="mt-3 inline-flex rounded-2xl border border-[rgba(18,36,79,0.15)] bg-white px-4 py-2.5 text-[0.9rem] font-extrabold text-brand-navy"
          >
            Apply for a new loan
          </Link>
          </div>
        ) : null}

        {successful.length > 0 ? (
          <section className="grid gap-3">
            <h2 className="text-[0.8rem] font-black uppercase tracking-[0.14em] text-slate-400">
              Successful ({successful.length})
            </h2>
            {successful.map((payment) => (
              <PaymentCard key={payment.uuid} payment={payment} />
            ))}
          </section>
        ) : null}

        {failed.length > 0 ? (
          <section className="grid gap-3">
            <h2 className="text-[0.8rem] font-black uppercase tracking-[0.14em] text-slate-400">
              Unsuccessful ({failed.length})
            </h2>
            {failed.map((payment) => (
              <PaymentCard key={payment.uuid} payment={payment} />
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
