'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchCustomerLoansDashboard,
  initiateCustomerRepayment,
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
  if (s === 'IN_REVIEW') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (s === 'APPROVED') return 'bg-sky-100 text-sky-900 border-sky-200';
  if (s === 'REJECTED' || s === 'KYC_FAILED' || s === 'CANCELLED') {
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

function ResumeArrow() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M4 10h12M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M5 10l3.5 3.5L15 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function JourneyTracker({
  steps,
  completed,
  total,
}: {
  steps: CustomerJourneyProgressStep[];
  completed: number;
  total: number;
}) {
  const pct = Math.max(6, Math.round((completed / total) * 100));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[0.72rem] font-bold uppercase tracking-wider">
        <span className="text-brand-navy">Journey progress</span>
        <span className="text-brand-blue">
          {completed} / {total} steps
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[rgba(18,36,79,0.08)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1496f3] to-[#38bdf8] shadow-[0_0_12px_rgba(20,150,243,0.5)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="flex items-start justify-between gap-0.5 sm:gap-1">
        {steps.map((step) => {
          const done = step.state === 'done';
          const current = step.state === 'current';
          const stepNumber =
            CUSTOMER_JOURNEY_PROGRESS_STEPS.findIndex((s) => s.key === step.key) + 1;
          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[0.62rem] font-black ring-2 transition-colors',
                  done
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white ring-emerald-200'
                    : current
                      ? 'animate-ring-pop bg-gradient-to-br from-[#ffc519] to-[#f6b400] text-[#12244f] ring-[#ffc519]/40'
                      : 'bg-white text-slate-400 ring-slate-200',
                )}
                aria-current={current ? 'step' : undefined}
              >
                {done ? <CheckIcon /> : stepNumber}
              </span>
              <span
                className={cn(
                  'truncate text-[0.55rem] font-bold uppercase tracking-wider sm:text-[0.62rem]',
                  done ? 'text-emerald-700' : current ? 'text-brand-navy' : 'text-slate-400',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DetailRow({ label, value, emphasize }: { label: string; value: ReactNode; emphasize?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[rgba(18,36,79,0.06)] py-3 last:border-b-0">
      <dt className="text-[0.78rem] font-semibold text-slate-500">{label}</dt>
      <dd
        className={cn(
          'text-right text-[0.92rem] font-extrabold text-brand-navy',
          emphasize && 'text-[1.05rem] text-[#1c347d]',
        )}
      >
        {value}
      </dd>
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
  const pctDone = Math.round((completed / total) * 100);
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[rgba(20,150,243,0.22)] bg-[linear-gradient(135deg,#ffffff_0%,#f0f7ff_45%,#e8f2ff_100%)] p-6 shadow-[0_28px_70px_rgba(23,44,113,0.14)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(20,150,243,0.2),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,197,25,0.16),transparent_70%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffc519] to-[#f6b400] shadow-[0_10px_22px_rgba(246,180,0,0.38)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#12244f]" fill="currentColor" aria-hidden>
              <path d="M13 2L3 14h7l-1 8 11-13h-8l1-7z" />
            </svg>
          </span>
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-amber-700">
              Application in progress
            </p>
            <p className="text-[1.15rem] font-extrabold leading-tight text-brand-navy">
              Complete your loan journey
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white/90 px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-wider text-brand-blue ring-1 ring-[rgba(20,150,243,0.2)]">
          {pctDone}% done
        </span>
      </div>

      <div className="relative mt-6 rounded-[18px] bg-white/90 p-4 ring-1 ring-[rgba(18,36,79,0.06)] backdrop-blur">
        <JourneyTracker steps={steps} completed={completed} total={total} />
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-slate-400">Up next</p>
          <p className="text-[0.95rem] font-extrabold text-brand-navy">{nextLabel}</p>
        </div>
        <Link
          href={resumeHref}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1c347d] via-[#12244f] to-[#0a1628] px-6 py-3.5 text-[0.95rem] font-extrabold text-[#fff8df] shadow-[0_14px_32px_rgba(23,44,113,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(23,44,113,0.45)]"
        >
          Complete your journey
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            <ResumeArrow />
          </span>
        </Link>
      </div>
    </div>
  );
}

function ActiveLoanCard({
  loan,
  onPaid,
}: {
  loan: CustomerLoanCard;
  onPaid?: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const amountDueToday = loan.amountDueToday ?? loan.totalRepayment;
  const amountAtMaturity = loan.amountDueAtMaturity ?? loan.totalRepayment;
  const daysLabel =
    loan.daysOutstanding == null
      ? null
      : `${loan.daysOutstanding} day${loan.daysOutstanding === 1 ? '' : 's'} of interest accrued`;

  const onPayNow = async () => {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const result = await initiateCustomerRepayment(loan.applicationUuid);
      if (!result?.success) {
        setPayError('Payment was unsuccessful. Please try again.');
        return;
      }
      if (result.paymentUrl) {
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

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[rgba(18,36,79,0.1)] bg-white shadow-[0_20px_50px_rgba(23,44,113,0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(18,36,79,0.06)] px-6 py-4">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">Loan number</p>
          <p className="mt-0.5 font-mono text-[0.95rem] font-extrabold tracking-wide text-brand-navy">
            {loan.loanNumber ?? loan.applicationUuid}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider',
            statusBadgeClass(loan.status),
          )}
        >
          {statusBadgeLabel(loan.status)}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#12244f] via-[#1c347d] to-[#0a1628] p-6 text-white lg:min-h-full">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.2),transparent_70%)]"
          />
          <p className="relative text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-300">
            Amount to be paid today
          </p>
          <p className="relative mt-2 text-[clamp(2rem,4vw,2.6rem)] font-black leading-none tracking-tight text-[#ffc519]">
            {amountDueToday ? formatInr(amountDueToday) : '—'}
          </p>
          <p className="relative mt-3 max-w-sm text-[0.85rem] leading-relaxed text-slate-300">
            Principal plus interest accrued till today.
            {daysLabel ? (
              <>
                <br />
                <span className="text-slate-400">{daysLabel}</span>
              </>
            ) : null}
          </p>

          <dl className="relative mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-3.5 py-3 ring-1 ring-white/10">
              <dt className="text-[0.58rem] font-black uppercase tracking-wider text-slate-400">
                Interest till today
              </dt>
              <dd className="mt-1 text-[1.05rem] font-extrabold text-white">
                {loan.interestTillToday != null ? formatInr(loan.interestTillToday) : '—'}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/10 px-3.5 py-3 ring-1 ring-white/10">
              <dt className="text-[0.58rem] font-black uppercase tracking-wider text-slate-400">
                Principal
              </dt>
              <dd className="mt-1 text-[1.05rem] font-extrabold text-white">
                {loan.loanAmount ? formatInr(loan.loanAmount) : '—'}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => void onPayNow()}
            disabled={paying}
            className="relative mt-6 flex w-full items-center justify-center rounded-2xl bg-[#ffc519] px-5 py-3.5 text-[1rem] font-extrabold text-[#12244f] shadow-[0_12px_28px_rgba(255,197,25,0.28)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
          >
            {paying ? 'Preparing payment…' : 'Pay Now'}
          </button>
          {payError ? (
            <p className="relative mt-3 text-[0.8rem] font-semibold text-rose-200" role="alert">
              {payError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div>
            <h3 className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-slate-400">
              Scheduled at maturity
            </h3>
            <dl className="mt-1">
              <DetailRow
                label="Principal amount"
                value={loan.loanAmount ? formatInr(loan.loanAmount) : '—'}
              />
              <DetailRow
                label="Interest at due date"
                value={loan.interestAmount ? formatInr(loan.interestAmount) : '—'}
              />
              <DetailRow
                label="Amount to be paid on maturity"
                value={amountAtMaturity ? formatInr(amountAtMaturity) : '—'}
                emphasize
              />
              <DetailRow
                label="Repayment due date"
                value={formatIsoDateDdMmYyyy(loan.maturityDate)}
              />
            </dl>
          </div>

          <div className="rounded-2xl bg-[#f4f8ff] p-4 ring-1 ring-[rgba(20,150,243,0.12)]">
            <h3 className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-brand-blue">
              Accrued till today
            </h3>
            <dl className="mt-1">
              <DetailRow
                label="Interest till today"
                value={loan.interestTillToday != null ? formatInr(loan.interestTillToday) : '—'}
              />
              <DetailRow
                label="Amount to be paid today"
                value={amountDueToday ? formatInr(amountDueToday) : '—'}
                emphasize
              />
            </dl>
          </div>

          {(loan.bankDisplay || loan.disbursedAt) && (
            <p className="text-[0.78rem] leading-relaxed text-brand-muted">
              {loan.bankDisplay ? (
                <>
                  Credited to <span className="font-semibold text-brand-navy">{loan.bankDisplay}</span>
                </>
              ) : null}
              {loan.disbursedAt ? (
                <>
                  {loan.bankDisplay ? ' · ' : null}
                  Disbursed{' '}
                  {new Date(loan.disbursedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InProgressLoanCard({ loan }: { loan: CustomerLoanCard }) {
  return (
    <div className="rounded-[20px] border border-[rgba(20,150,243,0.18)] bg-gradient-to-br from-white to-[#f4f9ff] p-5 shadow-[0_10px_28px_rgba(23,44,113,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-400">In review</p>
          <p className="mt-1 text-lg font-extrabold text-brand-navy">
            {loan.loanAmount ? formatInr(loan.loanAmount) : 'Application pending'}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider',
            statusBadgeClass(loan.status),
          )}
        >
          {statusBadgeLabel(loan.status)}
        </span>
      </div>
      <p className="mt-3 text-sm text-brand-muted">
        We will notify you once your application moves to the next stage.
      </p>
    </div>
  );
}

function LoanSummaryCard({ loan }: { loan: CustomerLoanCard }) {
  const isPaidFully = loan.status.toUpperCase() === 'CLOSED';
  const repaymentDays = isPaidFully
    ? (loan.daysOutstanding ?? loan.tenureDays)
    : loan.tenureDays;

  return (
    <div className="rounded-[20px] border border-[rgba(18,36,79,0.1)] bg-white p-5 shadow-sm transition-all hover:shadow-[0_8px_24px_rgba(23,44,113,0.06)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-wider',
            statusBadgeClass(loan.status),
          )}
        >
          {statusBadgeLabel(loan.status)}
        </span>
        <span className="font-mono text-[0.72rem] font-bold text-brand-navy">
          {loan.loanNumber ?? `${loan.applicationUuid.slice(0, 13)}…`}
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Principal</dt>
          <dd className="text-base font-extrabold text-brand-navy">{formatInr(loan.loanAmount)}</dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Total repayment</dt>
          <dd className="text-base font-extrabold text-brand-navy">{formatInr(loan.totalRepayment)}</dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
            {isPaidFully ? 'Repayment days' : 'Tenure'}
          </dt>
          <dd className="font-semibold text-brand-navy">
            {repaymentDays != null ? `${repaymentDays} days` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
            {isPaidFully ? 'Repaid on' : 'Maturity'}
          </dt>
          <dd className="font-semibold text-brand-navy">
            {isPaidFully
              ? loan.repaidAt
                ? new Date(loan.repaidAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '—'
              : formatIsoDateDdMmYyyy(loan.maturityDate)}
          </dd>
        </div>
        {loan.disbursedAt ? (
          <div className="flex justify-between border-t border-slate-50 pt-2 sm:col-span-2">
            <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Disbursed</dt>
            <dd className="text-xs font-semibold text-brand-navy">
              {new Date(loan.disbursedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </dd>
          </div>
        ) : null}
        {loan.bankDisplay ? (
          <div className="flex justify-between sm:col-span-2">
            <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Bank</dt>
            <dd className="text-xs font-semibold text-brand-navy">{loan.bankDisplay}</dd>
          </div>
        ) : null}
      </dl>
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
  journeyPct,
  hasOpenLoan,
  amountDueToday,
}: {
  greetingName: string | null;
  mobileNumber: string | null;
  journeyPct: number;
  hasOpenLoan: boolean;
  amountDueToday: string | null;
}) {
  const initial = greetingName?.charAt(0)?.toUpperCase() ?? 'M';
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[rgba(18,36,79,0.08)] bg-[linear-gradient(135deg,#12244f_0%,#1c347d_55%,#0f1f45_100%)] p-6 text-white shadow-[0_24px_60px_rgba(18,36,79,0.28)] sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(255,197,25,0.22),transparent_68%)]"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffc519] to-[#f6b400] text-xl font-black text-[#12244f] shadow-[0_10px_24px_rgba(246,180,0,0.35)]">
            {initial}
          </span>
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-slate-300">My account</p>
            <h1 className="text-[clamp(1.4rem,3.5vw,2rem)] font-extrabold tracking-tight">
              {greetingName ? `Welcome, ${greetingName}` : 'Welcome back'}
            </h1>
            {mobileNumber ? (
              <p className="mt-1 text-sm text-slate-300">+91 {mobileNumber}</p>
            ) : null}
          </div>
        </div>
        {hasOpenLoan && amountDueToday ? (
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-right ring-1 ring-white/15 backdrop-blur">
            <p className="text-[0.6rem] font-black uppercase tracking-wider text-slate-300">Due today</p>
            <p className="text-xl font-black text-[#ffc519] sm:text-2xl">{formatInr(amountDueToday)}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/15 backdrop-blur">
            <p className="text-[0.6rem] font-black uppercase tracking-wider text-slate-300">Journey</p>
            <p className="text-2xl font-black text-[#ffc519]">{journeyPct}%</p>
          </div>
        )}
      </div>
    </div>
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
        'relative flex items-center gap-2 pb-4 px-1 font-extrabold text-[0.95rem] transition-colors outline-none',
        active ? 'text-brand-blue' : 'text-slate-400 hover:text-brand-navy',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span className="rounded-full bg-[rgba(20,150,243,0.12)] px-2 py-0.5 text-[0.65rem] font-black text-brand-blue">
          {badge}
        </span>
      ) : null}
      {active ? (
        <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-brand-blue" />
      ) : null}
    </button>
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
      setData(
        res ?? {
          activeLoans: [],
          pastLoans: [],
          inProgress: [],
          repaymentSchedule: [],
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
    void loadLoans();
  }, [sessionLoading, signedIn, router, loadLoans]);

  const journeySteps = useMemo(() => buildCustomerJourneyProgress(session), [session]);
  const resumeHref =
    session && isCustomerPortalSignedIn(session)
      ? getCustomerJourneyResumePath(session)
      : COMPLETE_JOURNEY_HREF;
  const dash = data ?? { activeLoans: [], pastLoans: [], inProgress: [], repaymentSchedule: [] };
  const hasOpenLoan =
    hasOpenCustomerLoan(session) || dash.activeLoans.length > 0;
  const showIncompleteJourney = useMemo(() => {
    if (hasOpenLoan) return false;
    if (session?.authenticated === true && isLeadRejectedAndLocked(session.lead)) return false;
    return isCustomerJourneyIncomplete(session);
  }, [hasOpenLoan, session]);

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
  const journeyPct = journeySteps.percent;
  const overviewBadge =
    (showIncompleteJourney ? 1 : 0) + dash.activeLoans.length + dash.inProgress.length;
  const primaryDueToday =
    dash.activeLoans[0]?.amountDueToday ?? dash.activeLoans[0]?.totalRepayment ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in-up px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid gap-6">
        {repayFlash === 'success' ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900">
            <p className="font-bold">Payment successful. Your loan has been closed.</p>
          </div>
        ) : null}
        {repayFlash === 'failed' ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900">
            <p className="font-bold">Payment was unsuccessful. You can try Pay Now again.</p>
          </div>
        ) : null}
        {repayFlash === 'error' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
            <p className="font-bold">
              We could not confirm this payment yet. If money was deducted, contact support with your
              loan number.
            </p>
          </div>
        ) : null}

        <AccountHero
          greetingName={greetingName}
          mobileNumber={mobileNumber}
          journeyPct={journeyPct}
          hasOpenLoan={hasOpenLoan}
          amountDueToday={primaryDueToday}
        />

        <div className="flex gap-6 border-b border-[rgba(18,36,79,0.08)]">
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
          <div className="grid gap-6">
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
              <section className="grid gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-brand-navy">Applications in progress</h2>
                  <p className="mt-1 text-sm text-brand-muted">Track submissions that are still under review.</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {dash.inProgress.map((loan) => (
                    <InProgressLoanCard key={loan.applicationUuid} loan={loan} />
                  ))}
                </div>
              </section>
            ) : null}

            {dash.activeLoans.length > 0 ? (
              <section className="grid gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-brand-navy">
                    Your active loan{dash.activeLoans.length > 1 ? 's' : ''}
                  </h2>
                  <p className="mt-1 text-sm text-brand-muted">
                    Pay any time — interest accrues daily until repayment.
                  </p>
                </div>
                <div className="grid gap-5">
                  {dash.activeLoans.map((loan) => (
                    <ActiveLoanCard
                      key={loan.applicationUuid}
                      loan={loan}
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
          <div className="grid gap-6">
            <section className="grid gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-brand-navy">Previous loans</h2>
                <p className="mt-1 text-sm text-brand-muted">
                  Closed, matured, and past applications in one place.
                </p>
              </div>
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
                <div className="grid gap-4 lg:grid-cols-2">
                  {dash.pastLoans.map((loan) => (
                    <LoanSummaryCard key={loan.applicationUuid} loan={loan} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {session && isCustomerPortalSignedIn(session) && showIncompleteJourney ? (
          <p className="text-center text-[0.78rem] text-brand-muted">
            Continue from{' '}
            <span className="font-semibold text-brand-navy">{journeySteps.nextLabel}</span>
            {' · '}
            <Link href={resumeHref} className="font-bold text-brand-blue hover:underline">
              Jump to current step
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
