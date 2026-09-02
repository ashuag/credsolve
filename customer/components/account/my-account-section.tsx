'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchCustomerLoansDashboard,
  initiateCustomerRepayment,
  markRepaymentPending,
  refreshCustomerRepayment,
  takeRepaymentPendingApplication,
  type CustomerLoanCard,
  type CustomerLoansDashboard,
} from '@/lib/api/customer-loans';
import { formatInr } from '@/lib/format-inr';
import {
  getCustomerJourneyResumePath,
  isCustomerJourneyIncomplete,
  isCustomerPortalSignedIn,
  hasOpenCustomerLoan,
  isLeadRejectedAndLocked,
} from '@/lib/api/customer-session';
import {
  buildCustomerJourneyProgress,
  CUSTOMER_JOURNEY_PROGRESS_STEPS,
  type CustomerJourneyProgressStep,
} from '@/lib/customer-journey-progress';
import { isCustomerSessionRequiredMessage } from '@/lib/customer-session-required';
import { cn } from '@/lib/cn';
import { formatIsoDateDdMmYyyy } from '@/lib/format-date';

type AccountTab = 'overview' | 'history';

const COMPLETE_JOURNEY_HREF = '/apply-for-loan';

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  // Loan account outcomes
  if (s === 'CLOSED' || s === 'PAID' || s === 'PAID_FULLY') {
    return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  }
  if (s === 'OVERDUE') {
    return 'bg-rose-100 text-rose-900 border-rose-300';
  }
  if (s === 'ACTIVE') {
    return 'bg-sky-100 text-sky-900 border-sky-300';
  }
  if (s === 'WRITTEN_OFF') {
    return 'bg-slate-200 text-slate-800 border-slate-300';
  }
  // Application journey statuses
  if (s === 'DISBURSED') return 'bg-indigo-100 text-indigo-900 border-indigo-200';
  if (s === 'IN_REVIEW' || s === 'UNDER_REVIEW') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (s === 'APPROVED') return 'bg-sky-100 text-sky-900 border-sky-200';
  if (s === 'REJECTED' || s === 'KYC_FAILED' || s === 'PENNYDROP_FAILED' || s === 'CANCELLED') {
    return 'bg-rose-100 text-rose-900 border-rose-200';
  }
  if (s === 'DRAFT') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-[rgba(20,150,243,0.12)] text-brand-navy border-[rgba(20,150,243,0.25)]';
}

function statusBadgeLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === 'CLOSED') return 'Paid fully';
  if (s === 'OVERDUE') return 'Overdue';
  if (s === 'ACTIVE') return 'Active';
  if (s === 'WRITTEN_OFF') return 'Written off';
  return status.replace(/_/g, ' ');
}

function parseAmount(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseIsoDateOnly(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : startOfLocalDay(d);
}

function calendarDaysFromToday(iso: string | null | undefined): number | null {
  const target = parseIsoDateOnly(iso);
  if (!target) return null;
  return Math.round((target.getTime() - startOfLocalDay(new Date()).getTime()) / 86_400_000);
}

function formatFriendlyDate(iso: string | null | undefined): string {
  const d = parseIsoDateOnly(iso);
  if (!d) return formatIsoDateDdMmYyyy(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function dueTiming(
  days: number | null,
  overdueStatus: boolean,
  maturityDate: string | null,
): { label: string; tone: 'ok' | 'soon' | 'today' | 'overdue' } {
  if (overdueStatus || (days != null && days < 0)) {
    const past = days != null && days < 0 ? Math.abs(days) : null;
    return {
      label: past != null ? `${past} day${past === 1 ? '' : 's'} overdue` : 'Overdue',
      tone: 'overdue',
    };
  }
  if (days === 0) return { label: 'Due today', tone: 'today' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' };
  if (days != null && days > 1) {
    return { label: `Due in ${days} days`, tone: days <= 3 ? 'soon' : 'ok' };
  }
  return {
    label: maturityDate ? formatFriendlyDate(maturityDate) : 'Due date pending',
    tone: 'ok',
  };
}

function ResumeArrow() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M4 10h12M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M5 10l3.5 3.5L15 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STEP_HINT: Record<CustomerJourneyProgressStep['key'], string> = {
  mobile: 'Your mobile number is verified.',
  details: 'Add your personal details to continue.',
  loan: 'Pick the amount and tenure that work for you.',
  email: 'Confirm your email so we can send updates.',
  letter: 'Review your sanction letter before KYC.',
  digilockerKyc: 'Complete Aadhaar KYC through DigiLocker.',
  livenessKyc: 'Take a quick selfie to confirm it is you.',
  bank: 'Add the account where we should send the loan.',
  references: 'Share two people we can contact if needed.',
  esign: 'eSign your loan documents to finish.',
};

function JourneyTracker({ steps }: { steps: CustomerJourneyProgressStep[] }) {
  return (
    <ol className="m-0 list-none p-0">
      {steps.map((step, index) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const last = index === steps.length - 1;
        const stepNumber =
          CUSTOMER_JOURNEY_PROGRESS_STEPS.findIndex((s) => s.key === step.key) + 1;
        return (
          <li key={step.key} className="relative flex gap-3">
            <div className="flex h-full w-8 shrink-0 flex-col items-center self-stretch">
              <span
                className={cn(
                  'relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-[0.72rem] font-black',
                  done
                    ? 'bg-emerald-500 text-white shadow-[0_6px_14px_rgba(16,185,129,0.28)]'
                    : current
                      ? 'bg-gradient-to-br from-[#ffc519] to-[#f6b400] text-[#12244f] shadow-[0_8px_18px_rgba(246,180,0,0.38)] ring-4 ring-[#ffc519]/25'
                      : 'bg-[#eef2f8] text-slate-400',
                )}
                aria-current={current ? 'step' : undefined}
              >
                {done ? <CheckIcon /> : stepNumber}
              </span>
              {!last ? (
                <span
                  aria-hidden
                  className={cn(
                    'mt-1 w-px flex-1 min-h-[18px]',
                    done ? 'bg-emerald-200' : 'bg-[rgba(18,36,79,0.1)]',
                  )}
                />
              ) : null}
            </div>
            <div
              className={cn(
                'min-w-0 flex-1 pb-4',
                last && 'pb-0',
                current &&
                  'mb-3 rounded-2xl bg-[#fffbeb] px-3 py-2.5 ring-1 ring-[#ffc519]/35',
              )}
            >
              <p
                className={cn(
                  'm-0 text-[0.92rem] font-extrabold leading-tight',
                  done ? 'text-emerald-800' : current ? 'text-brand-navy' : 'text-slate-500',
                )}
              >
                {step.label}
              </p>
              {current ? (
                <p className="mt-1 mb-0 text-[0.78rem] font-medium leading-snug text-slate-600">
                  {STEP_HINT[step.key]}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LoanLifeBar({
  disbursedAt,
  maturityDate,
  overdue,
}: {
  disbursedAt: string | null;
  maturityDate: string | null;
  overdue: boolean;
}) {
  const start = parseIsoDateOnly(disbursedAt);
  const end = parseIsoDateOnly(maturityDate);
  if (!start || !end) return null;
  const span = end.getTime() - start.getTime();
  if (span <= 0) return null;
  const elapsed = startOfLocalDay(new Date()).getTime() - start.getTime();
  const pct = overdue ? 100 : Math.min(100, Math.max(6, Math.round((elapsed / span) * 100)));

  return (
    <div className="space-y-2">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-[rgba(18,36,79,0.08)]">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-500',
            overdue ? 'bg-rose-500' : 'bg-gradient-to-r from-[#1496f3] to-[#38bdf8]',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[0.68rem] font-semibold text-slate-500">
        <span>Disbursed {formatFriendlyDate(disbursedAt)}</span>
        <span>{overdue ? 'Past due' : `Due ${formatFriendlyDate(maturityDate)}`}</span>
      </div>
    </div>
  );
}

function CompleteJourneyCard({
  steps,
  completed,
  total,
  nextLabel,
  resumeHref,
}: {
  steps: CustomerJourneyProgressStep[];
  completed: number;
  total: number;
  nextLabel: string;
  resumeHref: string;
}) {
  const stepOrdinal = Math.min(completed + 1, total);
  const pct = Math.round((completed / total) * 100);
  const barWidth = Math.max(8, pct);

  return (
    <article className="overflow-hidden rounded-[24px] border border-[rgba(18,36,79,0.1)] bg-white shadow-[0_18px_44px_rgba(23,44,113,0.1)]">
      <div className="relative overflow-hidden bg-[linear-gradient(145deg,#12244f_0%,#1c347d_58%,#1496f3_140%)] px-5 py-5 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.22),transparent_68%)]"
        />
        <p className="relative m-0 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#ffc519]">
          Application in progress
        </p>
        <h2 className="relative mt-1.5 mb-0 text-[1.35rem] font-extrabold leading-tight tracking-tight text-white sm:text-[1.5rem]">
          Continue from {nextLabel}
        </h2>
        <p className="relative mt-1.5 mb-0 text-[0.86rem] font-medium text-white/75">
          Step {stepOrdinal} of {total}
        </p>
        <div
          className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Loan journey progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ffc519] to-[#ffe08a] transition-[width] duration-500"
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <Link
          href={resumeHref}
          className="group relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ffc519] px-5 py-3.5 text-[0.98rem] font-extrabold text-[#12244f] shadow-[0_12px_28px_rgba(246,180,0,0.28)] transition hover:brightness-105 sm:w-auto"
        >
          Continue to {nextLabel}
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            <ResumeArrow />
          </span>
        </Link>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <p className="mb-4 text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
          Your loan journey
        </p>
        <JourneyTracker steps={steps} />
      </div>
    </article>
  );
}

function ActiveLoanCard({
  loan,
  minPayAmountInr,
  onPaid,
}: {
  loan: CustomerLoanCard;
  minPayAmountInr: string;
  onPaid?: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payMode, setPayMode] = useState<'full' | 'partial' | null>(null);
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const remaining = loan.outstandingInr ?? loan.amountDueToday ?? loan.totalRepayment;
  const amountAtMaturity = loan.amountDueAtMaturity ?? loan.totalRepayment;
  const remainingN = parseAmount(remaining);
  const maturityN = parseAmount(amountAtMaturity);
  const paidN = parseAmount(loan.totalPaidInr);
  const minPayN = parseAmount(minPayAmountInr) ?? 100;
  const bounceN = parseAmount(loan.bounceFeeInr);
  const showBounce = bounceN != null && bounceN > 0;
  const savings =
    remainingN != null && maturityN != null && (paidN == null || paidN <= 0)
      ? Math.round((maturityN - remainingN) * 100) / 100
      : null;
  const showSavings = loan.usedFullTenureInterest !== true && savings != null && savings > 0.009;
  const daysUntilDue = calendarDaysFromToday(loan.maturityDate);
  const isOverdue = loan.status.toUpperCase() === 'OVERDUE' || (daysUntilDue != null && daysUntilDue < 0);
  const timing = dueTiming(daysUntilDue, isOverdue, loan.maturityDate);
  const daysUsed = loan.daysOutstanding;
  const hasPaid = paidN != null && paidN > 0.009;
  const remainingBelowMin = remainingN != null && remainingN <= minPayN + 0.009;
  const partialPrefill =
    remainingN != null ? Math.min(minPayN, remainingN).toFixed(2) : minPayN.toFixed(2);
  const [partialAmount, setPartialAmount] = useState(partialPrefill);

  const startPay = async (amountInr: number) => {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const result = await initiateCustomerRepayment(loan.applicationUuid, amountInr);
      if (!result?.success) {
        setPayError('Payment was unsuccessful. Please try again.');
        return;
      }
      if (result.paymentUrl) {
        markRepaymentPending(loan.applicationUuid);
        window.location.assign(result.paymentUrl);
        return;
      }
      await refresh();
      onPaid?.();
      router.push(result.redirectPath || '/payments');
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Payment was unsuccessful. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const onPayFull = () => {
    if (remainingN == null) {
      setPayError('Unable to calculate the remaining amount.');
      return;
    }
    void startPay(remainingN);
  };

  const onPayPartial = () => {
    const typed = Number.parseFloat(partialAmount);
    if (!Number.isFinite(typed) || typed <= 0) {
      setPayError('Enter an amount to pay.');
      return;
    }
    if (remainingN != null && typed > remainingN + 0.009) {
      setPayError(`Amount cannot exceed the remaining balance of ${formatInr(remaining)}.`);
      return;
    }
    if (remainingN != null && Math.abs(typed - remainingN) <= 0.009) {
      void startPay(remainingN);
      return;
    }
    if (typed + 0.009 < minPayN) {
      setPayError(`Minimum partial payment is ${formatInr(minPayN.toFixed(2))}.`);
      return;
    }
    void startPay(Math.round(typed * 100) / 100);
  };

  const timingChipClass =
    timing.tone === 'overdue'
      ? 'bg-rose-100 text-rose-800 ring-rose-200'
      : timing.tone === 'today'
        ? 'bg-amber-100 text-amber-900 ring-amber-200'
        : timing.tone === 'soon'
          ? 'bg-[#fff4d6] text-[#8a5a00] ring-[#ffc519]/40'
          : 'bg-[#eef6ff] text-brand-navy ring-[rgba(20,150,243,0.18)]';

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[24px] border bg-white shadow-[0_16px_40px_rgba(23,44,113,0.08)]',
        isOverdue ? 'border-rose-200' : 'border-[rgba(18,36,79,0.1)]',
      )}
    >
      <header
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 sm:px-6',
          isOverdue ? 'border-rose-100 bg-rose-50/70' : 'border-[rgba(18,36,79,0.06)] bg-[#f8fafd]',
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider',
              statusBadgeClass(loan.status),
            )}
          >
            {statusBadgeLabel(loan.status)}
          </span>
          <p className="truncate font-mono text-[0.82rem] font-bold tracking-wide text-brand-navy">
            {loan.loanNumber ?? loan.applicationUuid}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold ring-1',
            timingChipClass,
          )}
        >
          {timing.label}
        </span>
      </header>

      <div className="px-5 pb-5 pt-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-400">
              {hasPaid ? 'Remaining today' : 'Pay today'}
            </p>
            <p className="mt-1 text-[clamp(2rem,5vw,2.55rem)] font-black leading-none tracking-tight text-brand-navy">
              {remaining ? formatInr(remaining) : '—'}
            </p>
            <p className="mt-2 text-[0.8rem] font-medium text-slate-500">
              Principal + interest
              {showBounce ? ' + penal charge' : ''}
              {hasPaid ? ' − paid so far' : ''}
            </p>
            {hasPaid ? (
              <p className="mt-1 text-[0.78rem] font-semibold text-emerald-800">
                Paid so far {formatInr(loan.totalPaidInr)}
              </p>
            ) : null}
          </div>
        </div>

        {payMode == null ? (
          <div className={cn('mt-4 grid gap-2', remainingBelowMin ? 'sm:grid-cols-1' : 'sm:grid-cols-2')}>
            <button
              type="button"
              onClick={() => {
                setPayError(null);
                setPayMode('full');
              }}
              disabled={paying || remainingN == null || remainingN <= 0}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-[#ffc519] px-5 py-3.5 text-[0.95rem] font-extrabold text-[#12244f] shadow-[0_10px_24px_rgba(255,197,25,0.32)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Pay full amount
            </button>
            {remainingBelowMin ? null : (
              <button
                type="button"
                onClick={() => {
                  setPayError(null);
                  setPartialAmount(partialPrefill);
                  setPayMode('partial');
                }}
                disabled={paying || remainingN == null || remainingN <= 0}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[rgba(18,36,79,0.12)] bg-white px-5 py-3.5 text-[0.95rem] font-extrabold text-brand-navy transition hover:bg-[#f8fafd] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Pay partially
              </button>
            )}
          </div>
        ) : payMode === 'full' ? (
          <div className="mt-4 rounded-2xl bg-[#f8fafd] p-4 ring-1 ring-[rgba(18,36,79,0.08)]">
            <p className="text-[0.8rem] font-semibold text-slate-600">
              You will pay the remaining {remaining ? formatInr(remaining) : '—'}
              {showBounce ? ', including the penal charge' : ''}
              {hasPaid ? ' after earlier payments' : ''}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onPayFull()}
                disabled={paying}
                className="inline-flex min-w-[11.5rem] items-center justify-center rounded-2xl bg-[#ffc519] px-5 py-3 text-[0.95rem] font-extrabold text-[#12244f] shadow-[0_10px_24px_rgba(255,197,25,0.32)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
              >
                {paying ? 'Preparing payment…' : `Pay ${remaining ? formatInr(remaining) : ''}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayMode(null);
                  setPayError(null);
                }}
                disabled={paying}
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[0.9rem] font-bold text-slate-600 hover:bg-white"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-[#f8fafd] p-4 ring-1 ring-[rgba(18,36,79,0.08)]">
            <label className="block text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-400">
              Amount to pay
            </label>
            <input
              type="number"
              min={minPayN}
              max={remainingN ?? undefined}
              step="1"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[rgba(18,36,79,0.12)] bg-white px-4 py-3 text-[1.05rem] font-extrabold text-brand-navy outline-none focus:border-[#1496f3] focus:ring-2 focus:ring-[rgba(20,150,243,0.18)]"
            />
            <p className="mt-2 text-[0.75rem] font-medium text-slate-500">
              Minimum {formatInr(minPayN.toFixed(2))}. Remaining {remaining ? formatInr(remaining) : '—'}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onPayPartial()}
                disabled={paying}
                className="inline-flex min-w-[11.5rem] items-center justify-center rounded-2xl bg-[#ffc519] px-5 py-3 text-[0.95rem] font-extrabold text-[#12244f] shadow-[0_10px_24px_rgba(255,197,25,0.32)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
              >
                {paying ? 'Preparing payment…' : 'Pay this amount'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayMode(null);
                  setPayError(null);
                }}
                disabled={paying}
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-[0.9rem] font-bold text-slate-600 hover:bg-white"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {payError ? (
          <p className="mt-3 text-[0.8rem] font-semibold text-rose-700" role="alert">
            {payError}
          </p>
        ) : null}

        <dl className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl bg-[#f4f7fb] ring-1 ring-[rgba(18,36,79,0.06)]">
          <div className="px-3 py-3 sm:px-4">
            <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              Principal
            </dt>
            <dd className="mt-1 text-[0.92rem] font-extrabold text-brand-navy sm:text-[1.02rem]">
              {loan.loanAmount ? formatInr(loan.loanAmount) : '—'}
            </dd>
          </div>
          <div className="border-x border-[rgba(18,36,79,0.06)] px-3 py-3 sm:px-4">
            <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              Interest
            </dt>
            <dd className="mt-1 text-[0.92rem] font-extrabold text-brand-navy sm:text-[1.02rem]">
              {loan.interestTillToday != null ? formatInr(loan.interestTillToday) : '—'}
            </dd>
            <p className="mt-0.5 text-[0.62rem] font-semibold text-slate-400">
              {loan.usedFullTenureInterest
                ? 'Full tenure'
                : daysUsed != null
                  ? `${daysUsed} day${daysUsed === 1 ? '' : 's'} used`
                  : 'Till today'}
            </p>
          </div>
          <div className="px-3 py-3 sm:px-4">
            <dt className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              Due date
            </dt>
            <dd className="mt-1 text-[0.92rem] font-extrabold text-brand-navy sm:text-[1.02rem]">
              {formatFriendlyDate(loan.maturityDate)}
            </dd>
            <p className="mt-0.5 text-[0.62rem] font-semibold text-slate-400">{timing.label}</p>
          </div>
        </dl>

        {showBounce ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-[0.78rem] font-semibold text-rose-800 ring-1 ring-rose-100">
            Includes a penal charge of {formatInr(loan.bounceFeeInr)} because repayment is overdue.
          </p>
        ) : null}

        {showSavings ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[0.78rem] font-semibold text-emerald-800 ring-1 ring-emerald-100">
            Paying today saves {formatInr(savings.toFixed(2))} versus waiting until{' '}
            {formatFriendlyDate(loan.maturityDate)}.
          </p>
        ) : loan.usedFullTenureInterest ? (
          <p className="mt-3 rounded-xl bg-[#f4f8ff] px-3.5 py-2.5 text-[0.78rem] font-medium leading-relaxed text-slate-600 ring-1 ring-[rgba(20,150,243,0.1)]">
            The early-repay window has closed, so interest is charged for the
            {loan.tenureDays != null ? ` full ${loan.tenureDays}-day` : ' full'} tenure.
            {daysUsed != null
              ? ` ${daysUsed} day${daysUsed === 1 ? '' : 's'} since disbursement.`
              : null}
          </p>
        ) : daysUsed != null ? (
          <p className="mt-3 rounded-xl bg-[#f4f8ff] px-3.5 py-2.5 text-[0.78rem] font-medium leading-relaxed text-slate-600 ring-1 ring-[rgba(20,150,243,0.1)]">
            Still in the early-repay window — interest is charged only for the {daysUsed} day
            {daysUsed === 1 ? '' : 's'} used so far.
          </p>
        ) : null}

        <div className="mt-4">
          <LoanLifeBar
            disbursedAt={loan.disbursedAt}
            maturityDate={loan.maturityDate}
            overdue={isOverdue}
          />
        </div>

        {(loan.bankDisplay || loan.disbursedAt) && (
          <p className="mt-4 text-[0.75rem] leading-relaxed text-slate-500">
            {loan.bankDisplay ? (
              <>
                Credited to <span className="font-semibold text-brand-navy">{loan.bankDisplay}</span>
              </>
            ) : null}
            {loan.disbursedAt ? (
              <>
                {loan.bankDisplay ? ' · ' : null}
                Disbursed {formatDateTime(loan.disbursedAt)}
              </>
            ) : null}
          </p>
        )}
      </div>
    </article>
  );
}

function InProgressLoanCard({ loan }: { loan: CustomerLoanCard }) {
  return (
    <div className="rounded-[20px] border border-[rgba(20,150,243,0.16)] bg-white p-5 shadow-[0_8px_22px_rgba(23,44,113,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-400">
            Application
          </p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-brand-navy">
            {loan.loanAmount ? formatInr(loan.loanAmount) : 'Pending review'}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider',
            statusBadgeClass(loan.status),
          )}
        >
          {statusBadgeLabel(loan.status)}
        </span>
      </div>
      <p className="mt-3 text-[0.82rem] leading-relaxed text-slate-500">
        We will notify you once this application moves to the next stage.
      </p>
    </div>
  );
}

function LoanSummaryCard({ loan }: { loan: CustomerLoanCard }) {
  const isPaidFully = loan.status.toUpperCase() === 'CLOSED';
  const repaymentDays = isPaidFully
    ? (loan.daysOutstanding ?? loan.tenureDays)
    : loan.tenureDays;
  const accent =
    isPaidFully
      ? 'bg-emerald-400'
      : loan.status.toUpperCase() === 'WRITTEN_OFF'
        ? 'bg-slate-400'
        : 'bg-brand-blue';

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[rgba(18,36,79,0.08)] bg-white p-5 shadow-[0_6px_18px_rgba(23,44,113,0.04)]">
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', accent)} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pl-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider',
            statusBadgeClass(loan.status),
          )}
        >
          {statusBadgeLabel(loan.status)}
        </span>
        <span className="font-mono text-[0.7rem] font-bold text-slate-500">
          {loan.loanNumber ?? `${loan.applicationUuid.slice(0, 13)}…`}
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 pl-2">
        <div>
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">Principal</p>
          <p className="text-lg font-extrabold text-brand-navy">{formatInr(loan.loanAmount)}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">
            {isPaidFully ? 'Repaid' : 'Repayment'}
          </p>
          <p className="text-lg font-extrabold text-brand-navy">{formatInr(loan.totalRepayment)}</p>
        </div>
      </div>

      <p className="mt-3 pl-2 text-[0.75rem] leading-relaxed text-slate-500">
        {repaymentDays != null ? `${repaymentDays} days` : '—'}
        {' · '}
        {isPaidFully
          ? loan.repaidAt
            ? `Closed ${formatDateTime(loan.repaidAt)}`
            : 'Closed'
          : `Due ${formatFriendlyDate(loan.maturityDate)}`}
        {loan.bankDisplay ? ` · ${loan.bankDisplay}` : null}
      </p>
    </div>
  );
}

function EmptyStateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-dashed border-[rgba(20,150,243,0.28)] bg-gradient-to-br from-white to-[#f6faff] px-6 py-8 text-center">
      <div className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#eaf5ff] to-white text-brand-blue ring-1 ring-[rgba(20,150,243,0.18)] shadow-[0_8px_22px_rgba(20,150,243,0.12)]">
        {icon}
      </div>
      <p className="relative mt-4 text-base font-extrabold text-brand-navy">{title}</p>
      <p className="relative mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-brand-muted">{description}</p>
      {action ? (
        <Link
          href={action.href}
          className="relative mt-5 inline-flex items-center gap-2 rounded-full border border-[rgba(20,150,243,0.3)] bg-white px-5 py-2.5 text-[0.85rem] font-extrabold text-brand-blue shadow-[0_8px_22px_rgba(20,150,243,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#eaf5ff]"
        >
          {action.label}
          <ResumeArrow />
        </Link>
      ) : null}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 8a3 3 0 013-3h12a2 2 0 012 2v2H6a3 3 0 00-3 3v-4z" strokeLinejoin="round" />
      <path d="M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8H5a2 2 0 00-2 2z" strokeLinejoin="round" />
      <circle cx="17" cy="14" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-7 3" strokeLinecap="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccountHero({
  greetingName,
  mobileNumber,
}: {
  greetingName: string | null;
  mobileNumber: string | null;
}) {
  const initial = greetingName?.charAt(0)?.toUpperCase() ?? 'M';
  return (
    <header className="flex items-center gap-3.5 rounded-[22px] border border-[rgba(18,36,79,0.08)] bg-white/90 px-4 py-3.5 shadow-[0_8px_24px_rgba(23,44,113,0.05)] sm:px-5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffc519] to-[#f6b400] text-lg font-black text-[#12244f] shadow-[0_8px_18px_rgba(246,180,0,0.28)]">
        {initial}
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[0.64rem] font-black uppercase tracking-[0.14em] text-slate-400">
          My account
        </p>
        <h1 className="m-0 truncate text-[clamp(1.2rem,3vw,1.5rem)] font-extrabold tracking-tight text-brand-navy">
          {greetingName ? `Hi, ${greetingName}` : 'Welcome back'}
        </h1>
        {mobileNumber ? (
          <p className="m-0 mt-0.5 text-[0.82rem] font-medium text-slate-500">+91 {mobileNumber}</p>
        ) : null}
      </div>
    </header>
  );
}

function TabButton({
  active,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-[14px] px-3 py-2.5 text-[0.88rem] font-extrabold outline-none transition-colors',
        active ? 'bg-white text-brand-navy shadow-[0_4px_14px_rgba(23,44,113,0.08)]' : 'text-slate-500 hover:text-brand-navy',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[0.62rem] font-black',
            active ? 'bg-[rgba(20,150,243,0.12)] text-brand-blue' : 'bg-white/70 text-slate-500',
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function FlashBanner({
  tone,
  children,
}: {
  tone: 'success' | 'failed' | 'error';
  children: ReactNode;
}) {
  const styles =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'failed'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-amber-200 bg-amber-50 text-amber-950';
  return (
    <div className={cn('rounded-2xl border px-4 py-3.5 text-[0.9rem] font-bold', styles)} role="status">
      {children}
    </div>
  );
}

export function MyAccountSection({
  onSessionExpired,
}: {
  onSessionExpired?: () => void;
}) {
  const router = useRouter();
  const { session, loading: sessionLoading, refresh } = useCustomerSession();
  const [data, setData] = useState<CustomerLoansDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<AccountTab>('overview');
  const [tabInitialized, setTabInitialized] = useState(false);
  const [repayFlash, setRepayFlash] = useState<'success' | 'failed' | 'error' | null>(null);
  const signedIn = isCustomerPortalSignedIn(session);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const repay = params.get('repay');
    if (repay === 'success' || repay === 'failed' || repay === 'error') {
      setRepayFlash(repay);
      params.delete('repay');
      params.delete('txnid');
      params.delete('msg');
      const next = params.toString();
      const path = `${window.location.pathname}${next ? `?${next}` : ''}`;
      window.history.replaceState({}, '', path);
    }
  }, []);

  const loadLoans = useCallback(async () => {
    setFetching(true);
    setLoadError(null);
    try {
      const res = await fetchCustomerLoansDashboard();
      if (res?.reconciledPayment) {
        setRepayFlash((current) => current ?? 'success');
      }
      setData(
        res ?? {
          activeLoans: [],
          pastLoans: [],
          inProgress: [],
          repaymentSchedule: [],
          minPayAmountInr: '100.00',
        },
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to load dashboard.';
      setLoadError(message);
      setData(null);
      if (isCustomerSessionRequiredMessage(message)) {
        onSessionExpired?.();
      }
    } finally {
      setFetching(false);
    }
  }, [onSessionExpired]);

  const onLoadErrorRetry = useCallback(async () => {
    await refresh();
    await loadLoans();
  }, [refresh, loadLoans]);

  // Session is already loaded by CustomerSessionProvider — do not refresh() here
  // (that updates `session` and re-fires this effect in a loop).
  useEffect(() => {
    if (sessionLoading) return;
    if (!signedIn) {
      router.replace('/my-account?mode=login');
      return;
    }
    void (async () => {
      const pendingApp = takeRepaymentPendingApplication();
      if (pendingApp) {
        try {
          const refreshed = await refreshCustomerRepayment(pendingApp);
          if (refreshed?.outcome === 'updated' || refreshed?.loanClosed) {
            setRepayFlash('success');
          }
        } catch {
          // GET /my-loans still reconciles a closed-window QR payment.
        }
      }
      await loadLoans();
    })();
  }, [sessionLoading, signedIn, router, loadLoans]);

  const journeySteps = useMemo(() => buildCustomerJourneyProgress(session), [session]);
  const resumeHref =
    session && isCustomerPortalSignedIn(session)
      ? getCustomerJourneyResumePath(session)
      : COMPLETE_JOURNEY_HREF;
  const dash = data ?? { activeLoans: [], pastLoans: [], inProgress: [], repaymentSchedule: [], minPayAmountInr: '100.00' };
  const hasOpenLoan =
    hasOpenCustomerLoan(session) || dash.activeLoans.length > 0;
  const hasDisbursedLoan =
    hasOpenLoan ||
    dash.activeLoans.some((loan) => Boolean(loan.disbursedAt)) ||
    dash.pastLoans.some((loan) => Boolean(loan.disbursedAt) && !loan.repaidAt);
  const showIncompleteJourney = useMemo(() => {
    if (hasDisbursedLoan) return false;
    if (session?.authenticated === true && isLeadRejectedAndLocked(session.lead)) return false;
    return isCustomerJourneyIncomplete(session);
  }, [hasDisbursedLoan, session]);

  useEffect(() => {
    if (tabInitialized || fetching) return;
    const preferHistory =
      !showIncompleteJourney &&
      dash.activeLoans.length === 0 &&
      dash.inProgress.length === 0 &&
      dash.pastLoans.length > 0;
    if (preferHistory) setActiveTab('history');
    setTabInitialized(true);
  }, [tabInitialized, fetching, showIncompleteJourney, dash]);

  if ((fetching && !data) || sessionLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  // Session-expired UI is owned by the parent page (countdown modal).
  if (loadError && isCustomerSessionRequiredMessage(loadError)) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-rose-900">
        <p className="font-bold">{loadError}</p>
        <button type="button" className="mc-btn-primary mt-4" onClick={() => void onLoadErrorRetry()}>
          Try again
        </button>
      </div>
    );
  }

  const greetingName =
    session && session.authenticated
      ? session.profile?.fullName?.trim().split(/\s+/)[0] ?? null
      : null;
  const mobileNumber =
    session && session.authenticated ? session.mobileNumber.replace(/^\+?91/, '') : null;
  const overviewBadge =
    (showIncompleteJourney ? 1 : 0) + dash.activeLoans.length + dash.inProgress.length;

  return (
    <div className="mx-auto w-full max-w-[40rem] animate-fade-in-up px-4 py-5 sm:px-6 sm:py-7">
      <div className="grid gap-4 sm:gap-5">
        {repayFlash === 'success' ? (
          <FlashBanner tone="success">
            {data?.reconciledClosedLoan
              ? 'Payment successful. Your loan has been closed.'
              : 'Payment received. Your remaining amount due has been updated.'}
          </FlashBanner>
        ) : null}
        {repayFlash === 'failed' ? (
          <FlashBanner tone="failed">Payment was unsuccessful. You can try paying again.</FlashBanner>
        ) : null}
        {repayFlash === 'error' ? (
          <FlashBanner tone="error">
            We could not confirm this payment yet. If money was deducted, contact support with your
            loan number.
          </FlashBanner>
        ) : null}

        <AccountHero
          greetingName={greetingName}
          mobileNumber={mobileNumber}
        />

        <div className="grid grid-cols-2 rounded-2xl bg-[rgba(18,36,79,0.05)] p-1">
          <TabButton
            active={activeTab === 'overview'}
            label="Overview"
            badge={overviewBadge > 0 ? overviewBadge : undefined}
            onClick={() => setActiveTab('overview')}
          />
          <TabButton
            active={activeTab === 'history'}
            label="Previous loans"
            badge={dash.pastLoans.length || undefined}
            onClick={() => setActiveTab('history')}
          />
        </div>

        {activeTab === 'overview' ? (
          <div className="grid gap-5">
            {showIncompleteJourney ? (
              <CompleteJourneyCard
                steps={journeySteps.steps}
                completed={journeySteps.completed}
                total={journeySteps.total}
                nextLabel={journeySteps.nextLabel}
                resumeHref={resumeHref}
              />
            ) : null}

            {dash.inProgress.length > 0 && !hasOpenLoan ? (
              <section className="grid gap-3">
                <h2 className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-400">
                  Applications in progress
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {dash.inProgress.map((loan) => (
                    <InProgressLoanCard key={loan.applicationUuid} loan={loan} />
                  ))}
                </div>
              </section>
            ) : null}

            {dash.activeLoans.length > 0 ? (
              <section className="grid gap-3">
                {dash.activeLoans.length > 1 ? (
                  <h2 className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-400">
                    Active loans
                  </h2>
                ) : null}
                <div className="grid gap-4">
                  {dash.activeLoans.map((loan) => (
                    <ActiveLoanCard
                      key={loan.applicationUuid}
                      loan={loan}
                      minPayAmountInr={dash.minPayAmountInr}
                      onPaid={() => void loadLoans()}
                    />
                  ))}
                </div>
              </section>
            ) : !showIncompleteJourney ? (
              <EmptyStateCard
                icon={<WalletIcon />}
                title="No active loan yet"
                description="Once your application is approved and disbursed, your loan and repayment details will appear here."
                action={{ label: 'Apply for a loan', href: COMPLETE_JOURNEY_HREF }}
              />
            ) : null}
          </div>
        ) : (
          <section className="grid gap-3">
            {dash.pastLoans.length === 0 ? (
              <EmptyStateCard
                icon={<HistoryIcon />}
                title="No loan history yet"
                description="Your previous loans and closed applications will appear here once you complete a loan cycle."
                action={
                  showIncompleteJourney
                    ? { label: 'Complete your journey', href: COMPLETE_JOURNEY_HREF }
                    : hasOpenLoan
                      ? undefined
                      : { label: 'Apply for a loan', href: COMPLETE_JOURNEY_HREF }
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {dash.pastLoans.map((loan) => (
                  <LoanSummaryCard key={loan.applicationUuid} loan={loan} />
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
