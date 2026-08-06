'use client';

import { getLoanDetails, type LosLoanDetails } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import { LosStatusPill, losStatusPillStyles } from '@/components/shared/los-status-pill';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

function formatINR(value: string | null | undefined) {
  if (!value) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatINRExact(value: string | null | undefined) {
  if (!value) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function copyText(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  void navigator.clipboard.writeText(value);
}

function Field({
  label,
  value,
  mono,
  copyValue,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  copyValue?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">{label}</span>
      <div className={`flex items-start gap-1.5 text-[0.9rem] font-bold text-brand-text break-words ${mono ? 'font-mono text-[0.82rem]' : ''}`}>
        <span className="min-w-0">{value ?? '—'}</span>
        {copyValue ? (
          <button
            type="button"
            onClick={() => copyText(copyValue)}
            className="mt-0.5 shrink-0 rounded-md border border-[rgba(23,44,113,0.1)] bg-white px-1.5 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted hover:border-brand-blue/30 hover:text-brand-blue"
            title="Copy"
          >
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[18px] border border-[rgba(23,44,113,0.1)] bg-white shadow-[0_8px_28px_rgba(23,44,113,0.04)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[rgba(23,44,113,0.06)] bg-gradient-to-r from-[#f8fbff] to-white px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="m-0 text-[0.95rem] font-extrabold tracking-tight text-brand-navy">{title}</h2>
          {subtitle ? <p className="mt-0.5 mb-0 text-[0.74rem] font-semibold text-brand-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MoneyTile({
  label,
  value,
  hint,
  accent,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[16px] border bg-white px-4 py-4 shadow-[0_6px_20px_rgba(23,44,113,0.04)] ${
        emphasis ? 'sm:col-span-1' : ''
      }`}
      style={{ borderColor: `${accent}28` }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.12]"
        style={{ background: accent }}
        aria-hidden
      />
      <p className="m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">{label}</p>
      <p className="m-0 mt-2 text-[1.45rem] font-extrabold leading-none tracking-[-0.03em]" style={{ color: accent }}>
        {value}
      </p>
      {hint ? <p className="m-0 mt-2 text-[0.72rem] font-semibold text-brand-muted">{hint}</p> : null}
    </div>
  );
}

function ActionBtn({
  href,
  onClick,
  children,
  variant = 'ghost',
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: 'ghost' | 'primary' | 'soft';
}) {
  const base =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[0.8rem] font-bold no-underline transition-colors';
  const styles =
    variant === 'primary'
      ? 'bg-[#1c347d] text-[#ffc519] hover:bg-[#152a66]'
      : variant === 'soft'
        ? 'border border-[rgba(20,150,243,0.22)] bg-[rgba(20,150,243,0.08)] text-brand-blue hover:bg-[rgba(20,150,243,0.14)]'
        : 'border border-[rgba(23,44,113,0.12)] bg-white text-brand-text hover:bg-[rgba(20,150,243,0.06)]';

  if (href) {
    return (
      <Link href={href} className={`${base} ${styles}`}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function maturityMeta(daysToMaturity: number) {
  if (daysToMaturity < 0) {
    return {
      label: `${Math.abs(daysToMaturity)} day${Math.abs(daysToMaturity) === 1 ? '' : 's'} overdue`,
      tone: 'danger' as const,
      color: '#b91c1c',
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.22)',
    };
  }
  if (daysToMaturity === 0) {
    return {
      label: 'Due today',
      tone: 'warn' as const,
      color: '#b45309',
      bg: 'rgba(245,158,11,0.1)',
      border: 'rgba(245,158,11,0.28)',
    };
  }
  if (daysToMaturity <= 7) {
    return {
      label: `${daysToMaturity} day${daysToMaturity === 1 ? '' : 's'} left`,
      tone: 'warn' as const,
      color: '#b45309',
      bg: 'rgba(245,158,11,0.1)',
      border: 'rgba(245,158,11,0.28)',
    };
  }
  return {
    label: `${daysToMaturity} days to maturity`,
    tone: 'good' as const,
    color: '#047857',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.22)',
  };
}

function LoanLifecycle({
  disbursedAt,
  maturityDate,
  daysToMaturity,
  closedAt,
  statusCode,
}: {
  disbursedAt: string | null;
  maturityDate: string | null;
  daysToMaturity: number;
  closedAt: string | null;
  statusCode: string;
}) {
  const closed = Boolean(closedAt) || statusCode.toUpperCase().includes('CLOSED');
  const overdue = daysToMaturity < 0 && !closed;
  const steps = [
    {
      key: 'disbursed',
      label: 'Disbursed',
      detail: formatDate(disbursedAt),
      done: Boolean(disbursedAt),
      active: Boolean(disbursedAt) && !closed && daysToMaturity >= 0,
    },
    {
      key: 'active',
      label: overdue ? 'Overdue' : 'Collecting',
      detail: overdue ? `${Math.abs(daysToMaturity)}d late` : 'Awaiting repayment',
      done: closed || overdue,
      active: !closed && Boolean(disbursedAt) && daysToMaturity >= 0,
      danger: overdue,
    },
    {
      key: 'maturity',
      label: 'Maturity',
      detail: formatDate(maturityDate),
      done: closed || daysToMaturity <= 0,
      active: !closed && daysToMaturity <= 7 && daysToMaturity >= 0,
    },
    {
      key: 'closed',
      label: closed ? 'Paid fully' : 'Closure',
      detail: closed ? formatDate(closedAt) : 'Pending',
      done: closed,
      active: closed,
    },
  ];

  return (
    <div className="rounded-[16px] border border-[rgba(23,44,113,0.08)] bg-gradient-to-br from-[#f7faff] to-white p-4">
      <p className="m-0 mb-3 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
        Loan lifecycle
      </p>
      <ol className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
        {steps.map((step, idx) => {
          const color = step.danger ? '#b91c1c' : step.done || step.active ? '#1496f3' : '#94a3b8';
          return (
            <li key={step.key} className="relative flex items-start gap-2.5">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[0.68rem] font-extrabold text-white"
                  style={{
                    background: step.done || step.active ? color : '#e2e8f0',
                    color: step.done || step.active ? '#fff' : '#64748b',
                    boxShadow: step.active ? `0 0 0 4px ${color}22` : undefined,
                  }}
                >
                  {step.done ? '✓' : idx + 1}
                </span>
                {idx < steps.length - 1 ? (
                  <span className="mt-1 hidden h-full w-px bg-[rgba(23,44,113,0.08)] lg:block" aria-hidden />
                ) : null}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="m-0 text-[0.8rem] font-extrabold text-brand-navy">{step.label}</p>
                <p className="m-0 mt-0.5 text-[0.72rem] font-semibold text-brand-muted">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RepaymentProgress({
  totalRepayable,
  totalPaid,
  outstanding,
}: {
  totalRepayable: string;
  totalPaid: string;
  outstanding: string;
}) {
  const total = Number(totalRepayable) || 0;
  const paid = Number(totalPaid) || 0;
  const owed = Number(outstanding) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const fullyPaid = owed <= 0 && paid > 0;

  return (
    <div className="rounded-[16px] border border-[rgba(23,44,113,0.08)] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">Collection progress</p>
          <p className="m-0 mt-1 text-[1.05rem] font-extrabold text-brand-navy">
            {fullyPaid ? 'Fully collected' : `${pct}% collected`}
          </p>
        </div>
        <div className="text-right">
          <p className="m-0 text-[0.72rem] font-semibold text-brand-muted">
            Paid {formatINR(totalPaid)} · Due {formatINR(outstanding)}
          </p>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[rgba(23,44,113,0.08)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: fullyPaid
              ? 'linear-gradient(90deg,#059669,#10b981)'
              : pct === 0
                ? '#cbd5e1'
                : 'linear-gradient(90deg,#1c347d,#1496f3)',
          }}
        />
      </div>
    </div>
  );
}

function formatPercent(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value}%`;
  const trimmed = Number.isInteger(n) ? String(n) : String(n);
  return `${trimmed}%`;
}

function FeeStack({ row }: { row: LosLoanDetails }) {
  const processingFeePct = formatPercent(row.processingFeePercentage);
  const gstPct = formatPercent(row.gstPercentage);
  const lines = [
    { label: 'Principal sanctioned', value: formatINR(row.principalAmount), strong: true },
    {
      label: processingFeePct ? `Processing fee (${processingFeePct})` : 'Processing fee',
      value: `− ${formatINR(row.processingFeeAmount)}`,
      muted: true,
    },
    {
      label: gstPct ? `GST on fee (${gstPct})` : 'GST on fee',
      value: `− ${formatINR(row.gstAmount)}`,
      muted: true,
    },
    { label: 'Net disbursed to bank', value: formatINR(row.netDisbursedAmount), accent: '#047857' },
    { label: 'Interest', value: `+ ${formatINR(row.interestAmount)}`, muted: true },
    { label: 'Total repayable', value: formatINR(row.totalRepaymentAmount), accent: '#1c347d', strong: true },
  ];

  return (
    <div className="overflow-hidden rounded-[14px] border border-[rgba(23,44,113,0.08)]">
      {lines.map((line, i) => (
        <div
          key={line.label}
          className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
            i % 2 === 0 ? 'bg-[#fbfcff]' : 'bg-white'
          } ${i < lines.length - 1 ? 'border-b border-[rgba(23,44,113,0.05)]' : ''}`}
        >
          <span className={`text-[0.8rem] font-semibold ${line.strong ? 'text-brand-navy font-extrabold' : 'text-brand-muted'}`}>
            {line.label}
          </span>
          <span
            className={`text-[0.88rem] font-extrabold tabular-nums ${line.muted ? 'text-brand-muted' : 'text-brand-navy'}`}
            style={line.accent ? { color: line.accent } : undefined}
          >
            {line.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LoanDetailsPanel({ loanUuid }: { loanUuid: string }) {
  const [row, setRow] = useState<LosLoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      setLoading(false);
      return;
    }
    try {
      setRow(await getLoanDetails(token, loanUuid));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loan details.');
    } finally {
      setLoading(false);
    }
  }, [loanUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = useMemo(
    () => (row ? formatPersonName(row.fullName, 'Borrower (name pending)') : ''),
    [row],
  );

  if (loading) {
    return (
      <div className="flex animate-pulse flex-col gap-4">
        <div className="h-[168px] rounded-[18px] bg-[rgba(23,44,113,0.06)]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[96px] rounded-[16px] bg-[rgba(23,44,113,0.06)]" />
          ))}
        </div>
        <div className="h-[220px] rounded-[18px] bg-[rgba(23,44,113,0.06)]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[320px] rounded-[18px] bg-[rgba(23,44,113,0.06)]" />
          <div className="h-[320px] rounded-[18px] bg-[rgba(23,44,113,0.06)]" />
        </div>
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="max-w-xl rounded-[18px] border border-[rgba(239,68,68,0.25)] bg-[#fef2f2] p-6">
        <strong className="text-[#b91c1c]">Unable to load this loan.</strong>
        <p className="mt-2 mb-0 text-[0.9rem] text-[#991b1b]">{error ?? 'Loan not found.'}</p>
        <div className="mt-4 flex gap-2">
          <ActionBtn href="/loans">Back to loans</ActionBtn>
          <ActionBtn variant="primary" onClick={() => void load()}>
            Retry
          </ActionBtn>
        </div>
      </div>
    );
  }

  const maturity = maturityMeta(row.daysToMaturity);
  const statusStyles = losStatusPillStyles(row.loanStatusCode);
  const transfer = row.disbursementTransfer;
  const transferUtr = transfer?.uniqueTransactionReference ?? row.utr;

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <header className="overflow-hidden rounded-[18px] border border-[rgba(23,44,113,0.1)] bg-gradient-to-br from-white via-[#f7fbff] to-[#eef6ff] shadow-[0_10px_32px_rgba(23,44,113,0.05)]">
        <div
          className="h-[3px] w-full"
          style={{ background: `linear-gradient(90deg, ${statusStyles.text}, ${statusStyles.text}55)` }}
          aria-hidden
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-[1rem] font-extrabold text-white shadow-[0_10px_24px_rgba(23,44,113,0.2)]"
                style={{ background: `linear-gradient(145deg, ${statusStyles.text}, #1c347d)` }}
                aria-hidden
              >
                {getInitials(name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
                    Loan account
                  </span>
                  <LosStatusPill code={row.loanStatusCode} label={row.loanStatusLabel} />
                  <span className="text-[0.72rem] font-semibold text-brand-muted">
                    App · {row.applicationStatusLabel}
                  </span>
                </div>

                <h1 className="m-0 mt-2 text-[clamp(1.35rem,2.2vw,1.75rem)] font-extrabold tracking-[-0.03em] text-brand-navy">
                  {name}
                </h1>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <p className="m-0 font-mono text-[0.95rem] font-bold tracking-tight text-brand-text">
                    {row.loanNumber}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(row.loanNumber)}
                    className="rounded-md border border-[rgba(23,44,113,0.1)] bg-white px-1.5 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted transition-colors hover:border-brand-blue/30 hover:text-brand-blue"
                    title="Copy loan number"
                  >
                    Copy
                  </button>
                </div>

                <p className="mt-2.5 mb-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] font-semibold text-brand-muted">
                  <a
                    href={`tel:${row.mobileNumber}`}
                    className="text-brand-text no-underline transition-colors hover:text-brand-blue"
                  >
                    {row.mobileNumber}
                  </a>
                  {row.email ? (
                    <>
                      <span className="text-[rgba(23,44,113,0.25)]" aria-hidden>
                        ·
                      </span>
                      <a
                        href={`mailto:${row.email}`}
                        className="min-w-0 truncate text-brand-text no-underline transition-colors hover:text-brand-blue"
                      >
                        {row.email}
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:items-end">
              <div
                className="inline-flex min-w-[9.5rem] flex-col rounded-[14px] border px-3.5 py-2.5 sm:text-right"
                style={{
                  color: maturity.color,
                  background: maturity.bg,
                  borderColor: maturity.border,
                }}
              >
                <span className="text-[0.58rem] font-extrabold uppercase tracking-[0.12em] opacity-80">
                  Maturity
                </span>
                <span className="mt-0.5 text-[0.92rem] font-extrabold leading-tight">{maturity.label}</span>
                {row.loanMaturityDate ? (
                  <span className="mt-0.5 text-[0.7rem] font-semibold opacity-80">
                    {formatDate(row.loanMaturityDate)}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <ActionBtn href="/loans">← All loans</ActionBtn>
                <ActionBtn href={`/applications/${row.applicationUuid}`} variant="soft">
                  Open application
                </ActionBtn>
                <ActionBtn onClick={() => void load()}>Refresh</ActionBtn>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <LoanLifecycle
              disbursedAt={row.disbursedAt}
              maturityDate={row.loanMaturityDate}
              daysToMaturity={row.daysToMaturity}
              closedAt={row.closedAt}
              statusCode={row.loanStatusCode}
            />
            <RepaymentProgress
              totalRepayable={row.totalRepaymentAmount}
              totalPaid={row.totalPaidAmount}
              outstanding={row.outstandingAmount}
            />
          </div>
        </div>
      </header>

      {/* Money snapshot */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MoneyTile label="Principal" value={formatINR(row.principalAmount)} hint="Sanctioned amount" accent="#1c347d" />
        <MoneyTile label="Net disbursed" value={formatINR(row.netDisbursedAmount)} hint="Credited to borrower" accent="#047857" />
        <MoneyTile label="Total repayable" value={formatINR(row.totalRepaymentAmount)} hint={`Interest ${formatINR(row.interestAmount)}`} accent="#4338ca" />
        <MoneyTile
          label="Outstanding"
          value={formatINR(row.outstandingAmount)}
          hint={Number(row.outstandingAmount) > 0 ? 'Still to collect' : 'Nothing due'}
          accent={Number(row.outstandingAmount) > 0 ? '#b45309' : '#047857'}
          emphasis
        />
      </div>

      {/* Interest till today */}
      <SectionCard
        title="Interest till today"
        subtitle={
          row.closedAt
            ? 'Interest charged for the days the loan was open'
            : 'Accrued interest from disbursement through today'
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[14px] border border-[rgba(67,56,202,0.16)] bg-[rgba(67,56,202,0.05)] px-4 py-3.5">
            <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-[#4338ca]">
              Interest till today
            </p>
            <p className="m-0 mt-1.5 text-[1.35rem] font-extrabold tracking-tight text-[#4338ca]">
              {formatINRExact(row.interestTillToday)}
            </p>
            <p className="m-0 mt-1 text-[0.72rem] font-semibold text-brand-muted">
              @ {row.interestRate}% / day
            </p>
          </div>
          <div className="rounded-[14px] border border-[rgba(23,44,113,0.08)] bg-[#fbfcff] px-4 py-3.5">
            <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
              Amount due today
            </p>
            <p className="m-0 mt-1.5 text-[1.35rem] font-extrabold tracking-tight text-brand-navy">
              {formatINRExact(row.amountDueToday)}
            </p>
            <p className="m-0 mt-1 text-[0.72rem] font-semibold text-brand-muted">
              {Number(row.bounceFeeInr) > 0
                ? `Principal + interest + bounce (${formatINRExact(row.bounceFeeInr)})`
                : 'Principal + interest till today'}
            </p>
          </div>
          <div className="rounded-[14px] border border-[rgba(23,44,113,0.08)] bg-[#fbfcff] px-4 py-3.5">
            <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
              Days outstanding
            </p>
            <p className="m-0 mt-1.5 text-[1.35rem] font-extrabold tracking-tight text-brand-navy">
              {row.daysOutstanding != null ? row.daysOutstanding : '—'}
            </p>
            <p className="m-0 mt-1 text-[0.72rem] font-semibold text-brand-muted">
              {row.closedAt
                ? 'Inclusive days until closure'
                : 'Inclusive days since disbursement'}
            </p>
          </div>
          <div className="rounded-[14px] border border-[rgba(23,44,113,0.08)] bg-[#fbfcff] px-4 py-3.5">
            <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
              Interest at maturity
            </p>
            <p className="m-0 mt-1.5 text-[1.35rem] font-extrabold tracking-tight text-brand-navy">
              {formatINRExact(row.interestAmount)}
            </p>
            <p className="m-0 mt-1 text-[0.72rem] font-semibold text-brand-muted">
              Full tenure ({row.expectedRepaymentDays != null ? `${row.expectedRepaymentDays} days` : '—'})
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Terms + Borrower */}
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Loan terms & money trail"
          subtitle="How the sanctioned amount became net disbursed and total due"
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Loan number" value={row.loanNumber} mono copyValue={row.loanNumber} />
              <Field label="Application no." value={row.applicationNumber} mono copyValue={row.applicationNumber} />
              <Field label="Interest rate" value={`${row.interestRate}% / day`} />
              <Field
                label="Tenure"
                value={row.expectedRepaymentDays != null ? `${row.expectedRepaymentDays} days` : '—'}
              />
              <Field label="Purpose" value={row.purposeOfLoan} />
              <Field label="Disbursed at" value={formatDateTime(row.disbursedAt)} />
              <Field label="Maturity date" value={formatDate(row.loanMaturityDate)} />
              <Field
                label="Days to maturity"
                value={
                  <span style={{ color: maturity.color }}>
                    {row.daysToMaturity < 0
                      ? `${Math.abs(row.daysToMaturity)} day(s) overdue`
                      : `${row.daysToMaturity} day(s)`}
                  </span>
                }
              />
              <Field label="UTR" value={row.utr ?? '— (gateway skipped)'} mono copyValue={row.utr} />
              <Field
                label="Documents accepted"
                value={row.loanDocumentsAcceptedAt ? formatDateTime(row.loanDocumentsAcceptedAt) : '—'}
              />
            </div>
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Amount breakdown
              </p>
              <FeeStack row={row} />
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[12px] border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.06)] px-3.5 py-3">
                  <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-[#047857]">Total paid</p>
                  <p className="m-0 mt-1 text-[1.15rem] font-extrabold text-[#047857]">{formatINR(row.totalPaidAmount)}</p>
                </div>
                <div
                  className="rounded-[12px] border px-3.5 py-3"
                  style={{ borderColor: maturity.border, background: maturity.bg }}
                >
                  <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em]" style={{ color: maturity.color }}>
                    Maturity
                  </p>
                  <p className="m-0 mt-1 text-[1.05rem] font-extrabold" style={{ color: maturity.color }}>
                    {row.daysToMaturity < 0 ? 'Overdue' : row.daysToMaturity === 0 ? 'Due today' : 'On track'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Borrower & bank"
          subtitle="Identity and payout destination"
          action={
            <div className="flex flex-wrap gap-1.5">
              <ActionBtn href={`/customers/${row.customerUuid}`} variant="soft">
                Customer
              </ActionBtn>
              <ActionBtn href={`/leads/${row.leadUuid}`}>Lead</ActionBtn>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Borrower" value={name} />
            <Field label="Mobile" value={row.mobileNumber} copyValue={row.mobileNumber} />
            <Field label="Email" value={row.email ?? '—'} copyValue={row.email} />
            <Field label="PAN" value={row.panNumber ?? '—'} mono copyValue={row.panNumber} />
            <div className="sm:col-span-2">
              <Field label="Address" value={row.address ?? '—'} />
            </div>
          </div>

          <div className="mt-5 rounded-[14px] border border-[rgba(23,44,113,0.08)] bg-gradient-to-br from-[#f8fbff] to-white p-4">
            <p className="m-0 mb-3 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
              Disbursement account
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Bank" value={row.bankName ?? '—'} />
              <Field label="IFSC" value={row.ifscCode ?? '—'} mono copyValue={row.ifscCode} />
              <div className="sm:col-span-2">
                <Field
                  label="Account"
                  value={row.bankAccountMasked ?? row.bankAccountNumber ?? '—'}
                  mono
                  copyValue={row.bankAccountNumber ?? row.bankAccountMasked}
                />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Disbursement transfer */}
      <SectionCard
        title="Disbursement transfer"
        subtitle="Gateway payout trail for accounts reconciliation"
        action={
          transfer ? (
            <LosStatusPill
              code={transfer.status ?? 'UNKNOWN'}
              label={transfer.status ?? 'Unknown'}
            />
          ) : null
        }
      >
        {transfer == null ? (
          <div className="rounded-[14px] border border-dashed border-[rgba(23,44,113,0.16)] bg-[#f8fafc] px-4 py-6 text-center">
            <p className="m-0 text-[0.9rem] font-bold text-brand-navy">No gateway transfer log</p>
            <p className="mt-1 mb-0 text-[0.8rem] font-semibold text-brand-muted">
              {row.utr ? `UTR on loan record: ${row.utr}` : 'Transfer may have been skipped or recorded offline.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-[rgba(23,44,113,0.08)] bg-[#fbfcff] px-4 py-3">
                <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">Amount sent</p>
                <p className="m-0 mt-1 text-[1.2rem] font-extrabold text-brand-navy">
                  {transfer.amount != null
                    ? `${formatINRExact(transfer.amount)}${
                        transfer.currency && transfer.currency !== 'INR' ? ` ${transfer.currency}` : ''
                      }`
                    : '—'}
                </p>
                {transfer.paymentMode ? (
                  <p className="m-0 mt-1 text-[0.72rem] font-bold text-brand-muted">{transfer.paymentMode}</p>
                ) : null}
              </div>
              <div className="rounded-[14px] border border-[rgba(23,44,113,0.08)] bg-[#fbfcff] px-4 py-3 sm:col-span-2">
                <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">UTR</p>
                <p className="m-0 mt-1 break-all font-mono text-[0.95rem] font-extrabold text-brand-navy">
                  {transferUtr ?? '—'}
                </p>
                <p className="m-0 mt-1 text-[0.72rem] font-semibold text-brand-muted">
                  Transfer at{' '}
                  {formatDateTime(transfer.successAt ?? transfer.transferDate ?? transfer.createdAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Request number" value={transfer.uniqueRequestNumber ?? '—'} mono copyValue={transfer.uniqueRequestNumber} />
              <Field label="Transfer id" value={transfer.id ?? '—'} mono copyValue={transfer.id} />
              <Field label="Narration" value={transfer.narration ?? '—'} />
              <Field label="Beneficiary" value={transfer.beneficiaryAccountName ?? '—'} />
              <Field
                label="Beneficiary account"
                value={transfer.beneficiaryAccountNumber ?? '—'}
                mono
                copyValue={transfer.beneficiaryAccountNumber}
              />
              <Field
                label="Beneficiary IFSC"
                value={transfer.beneficiaryAccountIfsc ?? '—'}
                mono
                copyValue={transfer.beneficiaryAccountIfsc}
              />
              <Field label="Bank" value={transfer.beneficiaryBankName ?? '—'} />
              <Field label="Source VA" value={transfer.sourceVirtualAccount ?? '—'} mono />
              <Field
                label="Service charge (incl. GST)"
                value={
                  transfer.serviceChargeWithGst != null
                    ? formatINRExact(transfer.serviceChargeWithGst)
                    : '—'
                }
              />
              {transfer.failureReason ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="rounded-[12px] border border-[rgba(239,68,68,0.22)] bg-[#fef2f2] px-4 py-3">
                    <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-[#b91c1c]">
                      Failure reason
                    </p>
                    <p className="m-0 mt-1 text-[0.88rem] font-bold text-[#991b1b]">{transfer.failureReason}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <details className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-[#f8fafc] px-4 py-3">
              <summary className="cursor-pointer text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                Raw transfer JSON
              </summary>
              <pre className="mt-3 mb-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[0.72rem] text-brand-text">
                {JSON.stringify(transfer.raw, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </SectionCard>

      {/* Repayments */}
      <SectionCard
        title="Repayments"
        subtitle="Inbound collections against this loan"
        action={
          <span className="rounded-full bg-[rgba(23,44,113,0.06)] px-2.5 py-1 text-[0.72rem] font-extrabold text-brand-muted">
            {row.repayments.length} record{row.repayments.length === 1 ? '' : 's'}
          </span>
        }
      >
        {row.repayments.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[rgba(23,44,113,0.16)] bg-[#f8fafc] px-4 py-8 text-center">
            <p className="m-0 text-[0.92rem] font-extrabold text-brand-navy">No repayments yet</p>
            <p className="mt-1 mb-0 text-[0.8rem] font-semibold text-brand-muted">
              Outstanding remains {formatINR(row.outstandingAmount)}.
            </p>
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-[0.84rem]">
              <thead>
                <tr className="text-left">
                  {['Date', 'Amount', 'Mode', 'Status', 'UTR / note'].map((h) => (
                    <th
                      key={h}
                      className="border-b border-[rgba(23,44,113,0.08)] px-3 py-2.5 text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.repayments.map((payment) => {
                  const failed = payment.status === 'FAILED';
                  return (
                    <tr
                      key={payment.uuid}
                      className="border-b border-[rgba(23,44,113,0.05)] last:border-0 hover:bg-[rgba(20,150,243,0.03)]"
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-brand-text">
                        {formatDateTime(payment.paidAt)}
                      </td>
                      <td className="px-3 py-3 font-extrabold text-brand-navy">{formatINR(payment.amount)}</td>
                      <td className="px-3 py-3 font-semibold text-brand-muted">{payment.paymentMode}</td>
                      <td className="px-3 py-3">
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold"
                          style={
                            failed
                              ? { background: 'rgba(239,68,68,0.14)', color: '#b91c1c' }
                              : { background: 'rgba(16,185,129,0.14)', color: '#047857' }
                          }
                        >
                          {failed ? 'Unsuccessful' : 'Paid fully'}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.78rem] text-brand-text">
                        {failed ? (payment.failureMessage ?? 'Payment unsuccessful') : (payment.utr ?? '—')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
