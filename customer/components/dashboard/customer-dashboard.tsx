'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchCustomerLoansDashboard,
  type CustomerLoanCard,
  type CustomerLoanRepaymentLine,
  type CustomerLoansDashboard,
} from '@/lib/api/customer-loans';
import { formatInr } from '@/lib/format-inr';
import {
  getCustomerJourneyResumePath,
  isCustomerPortalSignedIn,
  type CustomerSessionResponse,
} from '@/lib/api/customer-session';
import { cn } from '@/lib/cn';
import { formatIsoDateDdMmYyyy } from '@/lib/format-date';

type JourneyStepState = 'done' | 'current' | 'todo';

type JourneyStep = {
  key: string;
  label: string;
  shortLabel: string;
  state: JourneyStepState;
};

const ALL_STEPS: Array<{ key: string; label: string; shortLabel: string }> = [
  { key: 'mobile', label: 'Mobile verified', shortLabel: 'Mobile' },
  { key: 'details', label: 'Personal details', shortLabel: 'Details' },
  { key: 'loan', label: 'Loan selection', shortLabel: 'Loan' },
  { key: 'kyc', label: 'KYC documents', shortLabel: 'KYC' },
  { key: 'bank', label: 'Bank details', shortLabel: 'Bank' },
  { key: 'references', label: 'References', shortLabel: 'Refs' },
];

function buildJourneySteps(
  session: CustomerSessionResponse | null
): { steps: JourneyStep[]; nextLabel: string; completed: number; total: number } {
  const total = ALL_STEPS.length;

  const flags: Record<string, boolean> = {
    mobile: Boolean(session?.authenticated),
    details: Boolean(session?.authenticated && session.journey.detailsCompleted),
    loan: Boolean(session?.authenticated && session.journey.loanSelectionCompleted),
    kyc: Boolean(session?.authenticated && session.journey.kycCompleted),
    references: Boolean(session?.authenticated && session.journey.referencesCompleted),
    bank: Boolean(session?.authenticated && session.journey.bankDetailsCompleted),
  };

  let foundCurrent = false;
  let completed = 0;
  const steps: JourneyStep[] = ALL_STEPS.map((s) => {
    const isDone = flags[s.key];
    if (isDone) {
      completed += 1;
      return { ...s, state: 'done' as const };
    }
    if (!foundCurrent) {
      foundCurrent = true;
      return { ...s, state: 'current' as const };
    }
    return { ...s, state: 'todo' as const };
  });

  const next = steps.find((s) => s.state === 'current');
  return {
    steps,
    nextLabel: next ? next.label : 'All steps complete',
    completed,
    total,
  };
}

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'DISBURSED') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'IN_REVIEW') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (s === 'APPROVED') return 'bg-sky-100 text-sky-900 border-sky-200';
  if (s === 'REJECTED') return 'bg-rose-100 text-rose-900 border-rose-200';
  if (s === 'DRAFT') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-[rgba(20,150,243,0.12)] text-brand-navy border-[rgba(20,150,243,0.25)]';
}

function repaymentStatusClass(status: CustomerLoanRepaymentLine['status']): string {
  switch (status) {
    case 'overdue':
      return 'bg-rose-100 text-rose-900';
    case 'due':
      return 'bg-amber-100 text-amber-900';
    case 'scheduled':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-emerald-100 text-emerald-900';
  }
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
  steps: JourneyStep[];
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
      <ol className="flex items-start justify-between gap-1">
        {steps.map((step) => {
          const done = step.state === 'done';
          const current = step.state === 'current';
          return (
            <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[0.62rem] font-black ring-2 transition-colors',
                  done
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white ring-emerald-200'
                    : current
                      ? 'animate-ring-pop bg-gradient-to-br from-[#ffc519] to-[#f6b400] text-[#12244f] ring-[#ffc519]/40'
                      : 'bg-white text-slate-400 ring-slate-200'
                )}
                aria-current={current ? 'step' : undefined}
              >
                {done ? <CheckIcon /> : ALL_STEPS.findIndex((s) => s.key === step.key) + 1}
              </span>
              <span
                className={cn(
                  'truncate text-[0.62rem] font-bold uppercase tracking-wider',
                  done ? 'text-emerald-700' : current ? 'text-brand-navy' : 'text-slate-400'
                )}
              >
                {step.shortLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/80 p-3 ring-1 ring-[rgba(18,36,79,0.06)] backdrop-blur">
      <p className="text-[0.62rem] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-[1.05rem] font-extrabold text-brand-navy">{value}</p>
    </div>
  );
}

function ResumeJourneyCard({
  loan,
  resumeHref,
  steps,
  completed,
  total,
  nextLabel,
}: {
  loan: CustomerLoanCard;
  resumeHref: string;
  steps: JourneyStep[];
  completed: number;
  total: number;
  nextLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[rgba(20,150,243,0.28)] bg-[linear-gradient(135deg,#fff_0%,#eef6ff_50%,#e8f0ff_100%)] p-6 shadow-[0_24px_60px_rgba(23,44,113,0.12)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(20,150,243,0.22),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,197,25,0.18),transparent_70%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffc519] to-[#f6b400] shadow-[0_8px_18px_rgba(246,180,0,0.4)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#12244f]" fill="currentColor" aria-hidden>
              <path d="M13 2L3 14h7l-1 8 11-13h-8l1-7z" />
            </svg>
          </span>
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-amber-700">Action needed</p>
            <p className="text-[1.05rem] font-extrabold leading-tight text-brand-navy">Resume your application</p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-wider',
            statusBadgeClass(loan.status)
          )}
        >
          {loan.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
        <StatBlock
          label="Loan amount"
          value={loan.loanAmount ? formatInr(loan.loanAmount) : '—'}
        />
        <StatBlock
          label="Tenure"
          value={loan.tenureDays != null ? `${loan.tenureDays} days` : '—'}
        />
        <StatBlock
          label="Total repayment"
          value={loan.totalRepayment ? formatInr(loan.totalRepayment) : '—'}
        />
      </div>

      <div className="relative mt-6 rounded-[16px] bg-white/85 p-4 ring-1 ring-[rgba(18,36,79,0.06)] backdrop-blur">
        <JourneyTracker steps={steps} completed={completed} total={total} />
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-slate-400">Next step</p>
          <p className="text-[0.95rem] font-extrabold text-brand-navy">{nextLabel}</p>
        </div>
        <Link
          href={resumeHref}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1c347d] via-[#12244f] to-[#0a1628] px-6 py-3 text-[0.95rem] font-extrabold text-[#fff8df] shadow-[0_14px_32px_rgba(23,44,113,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(23,44,113,0.45)]"
        >
          Resume journey
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            <ResumeArrow />
          </span>
        </Link>
      </div>
    </div>
  );
}

function LoanSummaryCard({ loan, emphasize }: { loan: CustomerLoanCard; emphasize?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[20px] border p-5 shadow-sm transition-shadow',
        emphasize
          ? 'border-[rgba(18,36,79,0.14)] bg-[linear-gradient(145deg,rgba(244,249,255,0.95),#ffffff)] shadow-[0_12px_40px_rgba(23,44,113,0.08)]'
          : 'border-[rgba(18,36,79,0.1)] bg-white'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-wider',
            statusBadgeClass(loan.status)
          )}
        >
          {loan.status.replace(/_/g, ' ')}
        </span>
        <span className="font-mono text-[0.72rem] text-brand-muted">{loan.applicationUuid.slice(0, 13)}…</span>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Principal</dt>
          <dd className="text-lg font-extrabold text-brand-navy">{formatInr(loan.loanAmount)}</dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Total repayment</dt>
          <dd className="text-lg font-extrabold text-brand-navy">{formatInr(loan.totalRepayment)}</dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Tenure</dt>
          <dd className="font-bold text-brand-navy">{loan.tenureDays != null ? `${loan.tenureDays} days` : '—'}</dd>
        </div>
        <div>
          <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Maturity</dt>
          <dd className="font-bold text-brand-navy">{formatIsoDateDdMmYyyy(loan.maturityDate)}</dd>
        </div>
        {loan.disbursedAt && (
          <div className="sm:col-span-2">
            <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Disbursed</dt>
            <dd className="font-semibold text-brand-navy">
              {new Date(loan.disbursedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </dd>
          </div>
        )}
        {loan.bankDisplay && (
          <div className="sm:col-span-2">
            <dt className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">Bank</dt>
            <dd className="font-semibold text-brand-navy">{loan.bankDisplay}</dd>
          </div>
        )}
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
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle_at_center,rgba(20,150,243,0.12),transparent_70%)]"
      />
      <div className="relative mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#eaf5ff] to-white text-brand-blue ring-1 ring-[rgba(20,150,243,0.18)] shadow-[0_8px_22px_rgba(20,150,243,0.12)]">
        {icon}
      </div>
      <p className="relative mt-4 text-base font-extrabold text-brand-navy">{title}</p>
      <p className="relative mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-brand-muted">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="relative mt-5 inline-flex items-center gap-2 rounded-full border border-[rgba(20,150,243,0.3)] bg-white px-5 py-2.5 text-[0.85rem] font-extrabold text-brand-blue shadow-[0_8px_22px_rgba(20,150,243,0.15)] transition-all hover:-translate-y-0.5 hover:bg-[#eaf5ff]"
        >
          {action.label}
          <ResumeArrow />
        </Link>
      )}
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
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

export function CustomerDashboard() {
  const router = useRouter();
  const { loading: sessionLoading, session } = useCustomerSession();
  const [data, setData] = useState<CustomerLoansDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  const load = useCallback(async () => {
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
        }
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Unable to load dashboard.');
      setData(null);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!isCustomerPortalSignedIn(session)) {
      router.replace('/my-account');
      return;
    }
    void load();
  }, [sessionLoading, session, router, load]);

  const resumeHref =
    session && isCustomerPortalSignedIn(session) ? getCustomerJourneyResumePath(session) : '/apply-for-loan';

  const journey = useMemo(() => buildJourneySteps(session), [session]);

  if (sessionLoading || (!sessionLoading && !isCustomerPortalSignedIn(session))) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (fetching && !data) {
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
        <button type="button" className="mc-btn-primary mt-4" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  const dash = data ?? { activeLoans: [], pastLoans: [], inProgress: [], repaymentSchedule: [] };
  const hasResumeable = dash.inProgress.length > 0;
  const greetingName =
    session && session.authenticated ? session.profile?.fullName?.trim().split(/\s+/)[0] ?? null : null;

  return (
    <div className="grid gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-slate-400">Overview</p>
          <h1 className="mt-1 text-[clamp(1.75rem,4vw,2.25rem)] font-extrabold tracking-tight text-brand-navy">
            {greetingName ? `Welcome back, ${greetingName}` : 'My accounts'}
          </h1>
          <p className="mt-2 max-w-xl text-brand-muted leading-relaxed">
            Loans, repayments, and applications in one place.
          </p>
        </div>
      </div>

      {hasResumeable && (
        <ResumeJourneyCard
          loan={dash.inProgress[0]}
          resumeHref={resumeHref}
          steps={journey.steps}
          completed={journey.completed}
          total={journey.total}
          nextLabel={journey.nextLabel}
        />
      )}

      {dash.inProgress.length > 1 && (
        <section className="grid gap-4">
          <h2 className="text-lg font-extrabold text-brand-navy">Other applications in progress</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {dash.inProgress.slice(1).map((loan) => (
              <LoanSummaryCard key={loan.applicationUuid} loan={loan} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4">
        <h2 className="text-lg font-extrabold text-brand-navy">Running loan{dash.activeLoans.length !== 1 ? 's' : ''}</h2>
        {dash.activeLoans.length === 0 ? (
          <EmptyStateCard
            icon={<WalletIcon />}
            title="No active loan yet"
            description={
              hasResumeable
                ? 'Once your application is approved and disbursed, your active loan will appear here.'
                : 'Once you take a MoneyCash loan it shows up here with principal, repayment, and bank info.'
            }
            action={hasResumeable ? undefined : { label: 'Apply for a loan', href: '/apply-for-loan' }}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {dash.activeLoans.map((loan) => (
              <LoanSummaryCard key={loan.applicationUuid} loan={loan} emphasize />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-extrabold text-brand-navy">Repayment — running loan</h2>
        {dash.repaymentSchedule.length === 0 ? (
          <EmptyStateCard
            icon={<CalendarIcon />}
            title="No repayments scheduled"
            description="Once a loan is active and a maturity date is set, your repayment schedule will appear here."
          />
        ) : (
          <div className="overflow-hidden rounded-[20px] border border-[rgba(18,36,79,0.1)] bg-white shadow-sm">
            <ul className="divide-y divide-[rgba(18,36,79,0.06)]">
              {dash.repaymentSchedule.map((line, idx) => (
                <li
                  key={`${line.dueDate}-${idx}`}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-bold text-brand-navy">{line.label}</p>
                    <p className="text-sm text-brand-muted">Due {formatIsoDateDdMmYyyy(line.dueDate)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xl font-extrabold text-brand-navy">{formatInr(line.amount)}</span>
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-wide',
                        repaymentStatusClass(line.status)
                      )}
                    >
                      {line.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-[rgba(18,36,79,0.06)] bg-slate-50/80 px-5 py-3 text-[0.8rem] text-brand-muted leading-relaxed">
              Short-term loans are structured as a single repayment on the maturity date. Complete payment through your
              registered bank mandate or the instructions sent by MoneyCash.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-extrabold text-brand-navy">Previous loans</h2>
        {dash.pastLoans.length === 0 ? (
          <EmptyStateCard
            icon={<HistoryIcon />}
            title="No history yet"
            description="Closed and matured loans will appear here so you always have a record of your MoneyCash activity."
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
  );
}
