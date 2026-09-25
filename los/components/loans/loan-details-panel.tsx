'use client';

import { getLoanDetails, fetchLoanNocPdfBlob, markApplicationInternalTesting, refreshLoanPayment, sendLoanNocLetter, waiveLoanCharges, type LosLoanDetails } from '@/lib/api';
import { canWaiveLoanCharges } from '@/lib/access';
import { useCanSendLoanNoc } from '@/components/loans/send-noc-button';
import { getLosStoredUser, LOS_STORAGE_KEY } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import { RefreshPaymentButton } from '@/components/loans/refresh-payment-button';
import { LosStatusPill, losStatusPillStyles } from '@/components/shared/los-status-pill';
import { MarkInternalTestingButton } from '@/components/shared/mark-internal-testing-button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
            className="mt-0.5 shrink-0 rounded-md border border-[rgba(15,39,72,0.1)] bg-white px-1.5 py-0.5 text-[0.58rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted hover:border-brand-blue/30 hover:text-brand-blue"
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
      className={`overflow-hidden rounded-[18px] border border-[rgba(15,39,72,0.1)] bg-white shadow-[0_8px_28px_rgba(15,39,72,0.04)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[rgba(15,39,72,0.06)] bg-gradient-to-r from-[#f8fbff] to-white px-5 py-3.5">
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
      className={`relative overflow-hidden rounded-[16px] border bg-white px-4 py-4 shadow-[0_6px_20px_rgba(15,39,72,0.04)] ${
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
      <p className="m-0 text-[0.62rem] font-extrabold uppercase leading-snug tracking-[0.08em] text-brand-muted">{label}</p>
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
  size = 'md',
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: 'ghost' | 'primary' | 'soft';
  size?: 'md' | 'sm';
}) {
  const base =
    size === 'sm'
      ? 'inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[0.74rem] font-bold no-underline transition-colors'
      : 'inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[0.8rem] font-bold no-underline transition-colors';
  const styles =
    variant === 'primary'
      ? 'bg-[#0F2748] text-[#4ADE80] hover:bg-[#152a66]'
      : variant === 'soft'
        ? 'border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-brand-blue hover:bg-[rgba(34,197,94,0.14)]'
        : 'border border-[rgba(15,39,72,0.12)] bg-white text-brand-text hover:bg-[rgba(34,197,94,0.06)]';

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

function isClosedLoan(closedAt: string | null | undefined, statusCode: string): boolean {
  const code = statusCode.toUpperCase();
  return (
    Boolean(closedAt) ||
    code === 'CLOSED' ||
    code === 'SETTLED' ||
    code.includes('CLOSED') ||
    code === 'WRITTEN_OFF'
  );
}

/** Fully repaid and eligible for manual NOC send (matches backend CLOSED/SETTLED + closedAt). */
function canSendNocLetter(row: {
  isNocSent: boolean;
  closedAt: string | null;
  loanStatusCode: string;
}): boolean {
  if (row.isNocSent) return false;
  const code = row.loanStatusCode.toUpperCase();
  if (code === 'WRITTEN_OFF') return false;
  return Boolean(row.closedAt) || code === 'CLOSED' || code === 'SETTLED';
}

function maturityMeta(daysToMaturity: number, closed: boolean, statusCode = '') {
  if (closed) {
    return {
      label: statusCode.toUpperCase() === 'WRITTEN_OFF' ? 'Written off' : 'Paid fully',
      tone: 'good' as const,
      color: '#047857',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.22)',
    };
  }
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

function lifecycleTone(state: 'done' | 'active' | 'pending' | 'danger') {
  switch (state) {
    case 'done':
      return {
        dot: '#059669',
        ring: 'rgba(16,185,129,0.22)',
        line: '#34d399',
        text: 'text-emerald-800',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      };
    case 'active':
      return {
        dot: '#22C55E',
        ring: 'rgba(34,197,94,0.22)',
        line: 'rgba(34,197,94,0.4)',
        text: 'text-brand-navy',
        badge: 'border-sky-200 bg-sky-50 text-brand-navy',
      };
    case 'danger':
      return {
        dot: '#dc2626',
        ring: 'rgba(239,68,68,0.22)',
        line: '#fca5a5',
        text: 'text-red-800',
        badge: 'border-red-200 bg-red-50 text-red-800',
      };
    default:
      return {
        dot: '#cbd5e1',
        ring: 'rgba(148,163,184,0.2)',
        line: '#e2e8f0',
        text: 'text-brand-muted',
        badge: 'border-slate-200 bg-slate-50 text-brand-muted',
      };
  }
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
  const closed = isClosedLoan(closedAt, statusCode);
  const overdue = daysToMaturity < 0 && !closed;
  const steps: Array<{
    key: string;
    label: string;
    detail: string;
    state: 'done' | 'active' | 'pending' | 'danger';
  }> = [
    {
      key: 'disbursed',
      label: 'Disbursed',
      detail: formatDate(disbursedAt),
      state: disbursedAt ? 'done' : 'pending',
    },
    {
      key: 'active',
      label: overdue ? 'Overdue' : 'Collecting',
      detail: overdue ? `${Math.abs(daysToMaturity)}d late` : closed ? 'Repaid' : 'Awaiting repayment',
      state: overdue ? 'danger' : closed ? 'done' : disbursedAt ? 'active' : 'pending',
    },
    {
      key: 'maturity',
      label: 'Maturity',
      detail: formatDate(maturityDate),
      state:
        closed || daysToMaturity < 0
          ? 'done'
          : !closed && daysToMaturity <= 7
            ? 'active'
            : 'pending',
    },
    {
      key: 'closed',
      label: closed ? 'Paid fully' : 'Closure',
      detail: closed ? formatDate(closedAt) : 'Pending',
      state: closed ? 'done' : 'pending',
    },
  ];

  return (
    <ol className="m-0 flex min-w-[520px] list-none p-0">
      {steps.map((step, idx) => {
        const tone = lifecycleTone(step.state);
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.key} className="relative flex min-w-0 flex-1 flex-col items-center px-1 text-center">
            {!isLast ? (
              <span
                className="pointer-events-none absolute left-[calc(50%+14px)] top-[13px] h-[2px] w-[calc(100%-28px)]"
                style={{ background: tone.line }}
                aria-hidden
              />
            ) : null}
            <span
              className="relative z-[1] inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{ background: tone.dot, boxShadow: `0 0 0 4px ${tone.ring}` }}
              aria-hidden
            >
              {step.state === 'done' ? (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : step.state === 'danger' ? (
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                  <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                </svg>
              ) : (
                <span className="text-[0.68rem] font-extrabold">{idx + 1}</span>
              )}
            </span>
            <span className={`mt-2 block text-[0.7rem] font-extrabold uppercase tracking-[0.06em] ${tone.text}`}>
              {step.label}
            </span>
            <span
              className={`mt-1 inline-block max-w-[9.5rem] truncate rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold ${tone.badge}`}
            >
              {step.detail}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function HeroStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent: string;
}) {
  return (
    <div
      className="min-w-[7.25rem] rounded-[12px] border bg-white px-3.5 py-2.5 shadow-[0_1px_10px_rgba(15,39,72,0.06)]"
      style={{ borderColor: `${accent}33`, background: `linear-gradient(180deg, #fff, ${accent}0d)` }}
    >
      <p className="m-0 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">{label}</p>
      <p className="m-0 mt-1 text-[1.02rem] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: accent }}>
        {value}
      </p>
      {hint ? <p className="m-0 mt-0.5 text-[0.68rem] font-semibold text-brand-muted">{hint}</p> : null}
    </div>
  );
}

function ContactChip({ href, children }: { href?: string; children: ReactNode }) {
  const className =
    'inline-flex items-center rounded-full border border-[rgba(15,39,72,0.1)] bg-white px-2.5 py-1 text-[0.74rem] font-semibold text-brand-text no-underline transition-colors hover:border-brand-blue/30 hover:text-brand-blue';
  if (href) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:w-[13.5rem] sm:shrink-0">
        <p className="m-0 text-[0.88rem] font-extrabold text-brand-navy">
          {fullyPaid ? 'Fully collected' : `${pct}% collected`}
        </p>
        <p className="m-0 text-[0.7rem] font-semibold text-brand-muted">
          {formatINR(totalPaid)} paid · {formatINR(outstanding)} due
        </p>
      </div>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(15,39,72,0.08)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: fullyPaid
              ? 'linear-gradient(90deg,#059669,#10b981)'
              : pct === 0
                ? '#cbd5e1'
                : 'linear-gradient(90deg,#0F2748,#22C55E)',
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
  const penal = Number(row.penalAmount);
  const hasPenal = Number.isFinite(penal) && penal > 0;
  const overdueInterest = Number(row.overdueInterestInr);
  const hasOverdueInterest = Number.isFinite(overdueInterest) && overdueInterest > 0;
  const waived = Number(row.waivedAmountInr);
  const hasWaiver = Number.isFinite(waived) && waived > 0;
  const penalLabel = 'Penal charge';
  const lines: Array<{
    label: string;
    value: string;
    strong?: boolean;
    muted?: boolean;
    accent?: string;
  }> = [
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
    { label: 'Total repayable', value: formatINR(row.totalRepaymentAmount), accent: '#0F2748', strong: true },
    // Only charged once the loan is past due, so the rows stay hidden on a healthy loan.
    ...(hasOverdueInterest || hasPenal || hasWaiver
      ? [
          ...(hasOverdueInterest
            ? [
                {
                  label:
                    row.overdueDays > 0
                      ? `Overdue interest (${row.overdueDays} ${row.overdueDays === 1 ? 'day' : 'days'})`
                      : 'Overdue interest',
                  value: `+ ${formatINRExact(row.overdueInterestInr)}`,
                  accent: '#b91c1c',
                },
              ]
            : []),
          ...(hasPenal
            ? [
                {
                  label: penalLabel,
                  value: `+ ${formatINRExact(row.penalAmount)}`,
                  accent: '#b91c1c',
                },
              ]
            : []),
          ...(hasWaiver
            ? [
                {
                  label: 'Waived (penal + overdue interest)',
                  value: `− ${formatINRExact(row.waivedAmountInr)}`,
                  accent: '#3730a3',
                },
              ]
            : []),
          {
            label: 'Total due today',
            value: formatINR(row.totalRepaymentWithPenalAmount),
            accent: hasWaiver ? '#3730a3' : '#b91c1c',
            strong: true,
          },
        ]
      : []),
  ];

  return (
    <div className="overflow-hidden rounded-[14px] border border-[rgba(15,39,72,0.08)]">
      {lines.map((line, i) => (
        <div
          key={line.label}
          className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
            i % 2 === 0 ? 'bg-[#fbfcff]' : 'bg-white'
          } ${i < lines.length - 1 ? 'border-b border-[rgba(15,39,72,0.05)]' : ''}`}
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

function WaiverCard({
  row,
  onSaved,
}: {
  row: LosLoanDetails;
  onSaved: (next: LosLoanDetails) => void;
}) {
  const canWaive = canWaiveLoanCharges(getLosStoredUser()?.roleName ?? getLosStoredUser()?.role, getLosStoredUser()?.hierarchyLevel);
  const maxWaiver = Math.max(0, Math.round((Number(row.penalAmount) + Number(row.overdueInterestInr)) * 100) / 100);
  const [amount, setAmount] = useState(row.waivedAmountInr ?? '0.00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(row.waivedAmountInr ?? '0.00');
  }, [row.waivedAmountInr]);

  const save = async () => {
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n < 0) {
      setError('Enter a waiver of ₹0 or more.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await waiveLoanCharges(token, row.uuid, Math.round(n * 100) / 100));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the waiver.');
    } finally {
      setBusy(false);
    }
  };

  if (Number(row.waivedAmountInr) > 0) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MoneyTile
          label="Waived off amount"
          value={formatINRExact(row.waivedAmountInr)}
          hint={
            [row.waivedByName ? `By ${row.waivedByName}` : null, row.waivedAt ? formatDateTime(row.waivedAt) : null]
              .filter(Boolean)
              .join(' · ') || 'Penal + overdue-days interest'
          }
          accent="#3730a3"
        />
        <MoneyTile
          label="Outstanding amount"
          value={formatINR(row.outstandingAmount)}
          hint={
            Number(row.outstandingAmount) <= 0
              ? row.loanStatusCode.toUpperCase() === 'SETTLED'
                ? 'Settled'
                : 'Nothing due'
              : 'Still to collect'
          }
          accent={Number(row.outstandingAmount) > 0 ? '#b45309' : '#047857'}
          emphasis
        />
      </div>
    );
  }

  if (row.closedAt || maxWaiver <= 0) {
    return null;
  }

  return (
    <SectionCard
      title="Charge waiver"
      subtitle={`Waive any amount of penal + overdue interest (max ${formatINRExact(String(maxWaiver.toFixed(2)))}). Principal and tenure interest stay due.`}
    >
      {canWaive ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[10rem] flex-col gap-1">
            <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
              Waive amount
            </span>
            <input
              type="number"
              min={0}
              max={maxWaiver}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-10 rounded-[10px] border border-[rgba(15,39,72,0.14)] bg-white px-3 text-[0.9rem] font-bold text-brand-navy"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="h-10 cursor-pointer rounded-[10px] border border-[rgba(79,70,229,0.28)] bg-[rgba(79,70,229,0.08)] px-4 text-[0.8rem] font-extrabold text-[#3730a3] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save waiver'}
          </button>
        </div>
      ) : (
        <p className="m-0 text-[0.8rem] font-semibold text-brand-muted">Only Admin can waive charges.</p>
      )}
      {error ? (
        <p className="m-0 mt-2 text-[0.78rem] font-semibold text-[#b91c1c]" role="alert">
          {error}
        </p>
      ) : null}
    </SectionCard>
  );
}

export function LoanDetailsPanel({ loanUuid }: { loanUuid: string }) {
  const router = useRouter();
  const [row, setRow] = useState<LosLoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingInternal, setMarkingInternal] = useState(false);
  const [refreshingPayment, setRefreshingPayment] = useState(false);
  const [openingNoc, setOpeningNoc] = useState(false);
  const [sendingNoc, setSendingNoc] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const canSendNoc = useCanSendLoanNoc();

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

  const markAsInternalTesting = useCallback(async () => {
    if (!row) return;
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    setMarkingInternal(true);
    setError(null);
    try {
      await markApplicationInternalTesting(token, row.applicationUuid);
      router.replace('/loans');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark loan as internal testing');
    } finally {
      setMarkingInternal(false);
    }
  }, [row, router]);

  const refreshPayment = useCallback(async () => {
    if (!row) return;
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    setRefreshingPayment(true);
    setStatusMessage(null);
    try {
      const result = await refreshLoanPayment(token, loanUuid);
      if (result.outcome === 'updated') {
        setStatusMessage({ tone: 'ok', text: result.message });
        setRow(await getLoanDetails(token, loanUuid));
        return;
      }
      setStatusMessage({
        tone: result.outcome === 'retrieve_failed' ? 'err' : 'warn',
        text: result.message,
      });
      setRow((prev) =>
        prev
          ? {
              ...prev,
              unsettledPaymentLink: result.unsettledPaymentLink,
              closedAt: result.closedAt,
              loanStatusCode: result.loanStatusCode,
              loanStatusLabel: result.loanStatusLabel,
            }
          : prev,
      );
    } catch (e) {
      setStatusMessage({
        tone: 'err',
        text: e instanceof Error ? e.message : 'Failed to refresh payment status',
      });
    } finally {
      setRefreshingPayment(false);
    }
  }, [row, loanUuid]);

  const openNocPdf = useCallback(async () => {
    if (!row?.isNocSent) return;
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    setOpeningNoc(true);
    setError(null);
    try {
      const blob = await fetchLoanNocPdfBlob(token, loanUuid);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open NOC letter.');
    } finally {
      setOpeningNoc(false);
    }
  }, [row?.isNocSent, loanUuid]);

  const sendNoc = useCallback(async () => {
    if (!row || row.isNocSent) return;
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    setSendingNoc(true);
    setError(null);
    setStatusMessage(null);
    try {
      const updated = await sendLoanNocLetter(token, loanUuid);
      setRow(updated);
      setStatusMessage({
        tone: 'ok',
        text: updated.nocSentAt
          ? `NOC letter sent at ${formatDateTime(updated.nocSentAt)}.`
          : 'NOC letter sent.',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send NOC letter.');
    } finally {
      setSendingNoc(false);
    }
  }, [row, loanUuid]);

  const name = useMemo(
    () => (row ? formatPersonName(row.fullName, 'Borrower (name pending)') : ''),
    [row],
  );

  if (loading) {
    return (
      <div className="flex animate-pulse flex-col gap-4">
        <div className="h-[280px] rounded-[14px] bg-[rgba(15,39,72,0.06)]" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[96px] rounded-[16px] bg-[rgba(15,39,72,0.06)]" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[96px] rounded-[16px] bg-[rgba(15,39,72,0.06)]" />
          ))}
        </div>
        <div className="h-[220px] rounded-[18px] bg-[rgba(15,39,72,0.06)]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-[320px] rounded-[18px] bg-[rgba(15,39,72,0.06)]" />
          <div className="h-[320px] rounded-[18px] bg-[rgba(15,39,72,0.06)]" />
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

  const closed = isClosedLoan(row.closedAt, row.loanStatusCode);
  const showSendNoc = canSendNoc && canSendNocLetter(row);
  const maturity = maturityMeta(row.daysToMaturity, closed, row.loanStatusCode);
  const statusStyles = losStatusPillStyles(row.loanStatusCode);
  const transfer = row.disbursementTransfer;
  const transferUtr = transfer?.uniqueTransactionReference ?? row.utr;
  const overdueInterestInr = Number(row.overdueInterestInr) || 0;
  const penalAmountInr = Number(row.penalAmount) || 0;
  const totalRepayAmountInr =
    Math.round(((Number(row.totalRepaymentAmount) || 0) + overdueInterestInr + penalAmountInr) * 100) / 100;

  return (
    <div className="flex flex-col gap-4">
      {statusMessage ? (
        <p
          className="m-0 rounded-[10px] border px-3 py-2 text-[0.84rem] font-bold"
          style={
            statusMessage.tone === 'ok'
              ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.28)', color: '#047857' }
              : statusMessage.tone === 'err'
                ? { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.24)', color: '#b91c1c' }
                : { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.28)', color: '#b45309' }
          }
        >
          {statusMessage.text}
        </p>
      ) : null}
      {/* Hero */}
      <header className="overflow-hidden rounded-[14px] border border-[rgba(15,39,72,0.1)] bg-gradient-to-b from-white to-[#f4f8ff] shadow-[0_8px_28px_rgba(15,39,72,0.05)]">
        <div
          className="h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, ${statusStyles.text}, ${statusStyles.text}55)` }}
          aria-hidden
        />
        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[0.82rem] font-extrabold text-white"
                style={{ background: `linear-gradient(135deg, ${statusStyles.text}, #0F2748)` }}
                aria-hidden
              >
                {getInitials(name)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                    Loan account
                  </span>
                  <LosStatusPill code={row.loanStatusCode} label={row.loanStatusLabel} />
                  <ContactChip>App · {row.applicationStatusLabel}</ContactChip>
                </div>

                <h1 className="m-0 mt-1 text-[1.2rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-navy">
                  {name}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ContactChip>
                    <span className="font-mono text-[0.74rem] font-bold tracking-tight">{row.loanNumber}</span>
                  </ContactChip>
                  <button
                    type="button"
                    onClick={() => copyText(row.loanNumber)}
                    className="rounded-full border border-[rgba(15,39,72,0.1)] bg-white px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted transition-colors hover:border-brand-blue/30 hover:text-brand-blue"
                    title="Copy loan number"
                  >
                    Copy
                  </button>
                  <ContactChip href={`tel:${row.mobileNumber}`}>{row.mobileNumber}</ContactChip>
                  {row.email ? <ContactChip href={`mailto:${row.email}`}>{row.email}</ContactChip> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <HeroStat
                label="Maturity"
                value={maturity.label}
                hint={row.loanMaturityDate ? formatDate(row.loanMaturityDate) : undefined}
                accent={maturity.color}
              />
              <HeroStat label="Paid" value={formatINR(row.totalPaidAmount)} hint="Recorded collections" accent="#047857" />
              <HeroStat
                label="Outstanding"
                value={formatINR(row.outstandingAmount)}
                hint={closed ? 'Nothing due' : 'Balance remaining'}
                accent={closed || Number(row.outstandingAmount) <= 0 ? '#047857' : row.daysToMaturity < 0 ? '#b91c1c' : '#0F2748'}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[rgba(15,39,72,0.07)] pt-3">
            <ActionBtn href="/loans" size="sm">
              ← All loans
            </ActionBtn>
            <ActionBtn href={`/applications/${row.applicationUuid}`} variant="soft" size="sm">
              Open application
            </ActionBtn>
            <ActionBtn onClick={() => void load()} size="sm">
              Refresh
            </ActionBtn>
            {!row.closedAt ? (
              <RefreshPaymentButton busy={refreshingPayment} onClick={() => void refreshPayment()} />
            ) : null}
            {showSendNoc ? (
              <button
                type="button"
                disabled={sendingNoc}
                onClick={() => void sendNoc()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.12)] px-3 py-1.5 text-[0.72rem] font-extrabold text-[#047857] hover:bg-[rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingNoc ? 'Sending NOC…' : 'Send NOC'}
              </button>
            ) : null}
            <MarkInternalTestingButton busy={markingInternal} onConfirm={() => void markAsInternalTesting()} />
          </div>
        </div>

        <div className="border-t border-[rgba(15,39,72,0.07)] bg-[rgba(248,250,255,0.7)] px-4 py-4 sm:px-5">
          <p className="m-0 mb-3 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
            Loan lifecycle
          </p>
          <div className="overflow-x-auto">
            <LoanLifecycle
              disbursedAt={row.disbursedAt}
              maturityDate={row.loanMaturityDate}
              daysToMaturity={row.daysToMaturity}
              closedAt={row.closedAt}
              statusCode={row.loanStatusCode}
            />
          </div>
          <div className="mt-4 border-t border-[rgba(15,39,72,0.06)] pt-3">
            <p className="m-0 mb-2 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
              Collection progress
            </p>
            <RepaymentProgress
              totalRepayable={row.totalRepaymentAmount}
              totalPaid={row.totalPaidAmount}
              outstanding={row.outstandingAmount}
            />
          </div>
        </div>
      </header>

      {/* Money snapshot */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MoneyTile 
          label="Principal" 
          value={formatINR(row.principalAmount)} 
          hint="Sanctioned amount" 
          accent="#0F2748" 
        />
        <MoneyTile label="Net disbursed" value={formatINR(row.netDisbursedAmount)} hint="Credited to borrower" accent="#047857" />
        
        <MoneyTile
          label="Interest till repay date"
          value={formatINRExact(row.interestAmount)}
          hint={
            row.expectedRepaymentDays != null
              ? `Full tenure (${row.expectedRepaymentDays} days)`
              : 'Full tenure interest'
          }
          accent="#4338ca"
        />
        <MoneyTile
          label="Repayable till repayment date"
          value={formatINR(row.totalRepaymentAmount)}
          hint="Principal + tenure interest"
          accent="#4338ca"
        />
        
        <MoneyTile
          label="Repay date"
          value={formatDate(row.loanMaturityDate)}
          hint="Loan maturity"
          accent="#0F2748"
        />

      </div>

      {row.overdueDays > 0 ? (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MoneyTile
          label="Overdue days"
          value={String(row.overdueDays ?? 0)}
          hint={row.overdueDays === 1 ? 'Day past repay date' : 'Days past repay date'}
          accent="#b91c1c"
        />
        <MoneyTile
          label="Interest of overdue days"
          value={formatINRExact(row.overdueInterestInr)}
          hint={`${row.overdueDays} overdue day${row.overdueDays === 1 ? '' : 's'}`}
          accent={overdueInterestInr > 0 ? '#b91c1c' : '#64748b'}
        />
        <MoneyTile
          label="Penal charges"
          value={formatINRExact(row.penalAmount)}
          hint="Capped penal fee"
          accent={penalAmountInr > 0 ? '#b91c1c' : '#64748b'}
        />
        <MoneyTile
          label="Total repay amount"
          value={formatINR(String(totalRepayAmountInr.toFixed(2)))}
          hint="Principal + interest + overdue + penal"
          accent="#0F2748"
        />
        <MoneyTile
          label="Amount paid"
          value={formatINR(row.totalPaidAmount)}
          hint="Recorded repayments"
          accent="#047857"
        />
        <MoneyTile
          label="Repayable after penal + overdue interest"
          value={formatINR(String(totalRepayAmountInr.toFixed(2)))}
          hint="Till-date repayable + overdue-days interest + penal"
          accent="#b45309"
          emphasis
        />
      </div>
      ) : null}

      <WaiverCard row={row} onSaved={setRow} />

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
                    {closed
                      ? 'Closed'
                      : row.daysToMaturity < 0
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
                    {closed
                      ? maturity.label
                      : row.daysToMaturity < 0
                        ? 'Overdue'
                        : row.daysToMaturity === 0
                          ? 'Due today'
                          : 'On track'}
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

          <div className="mt-5 rounded-[14px] border border-[rgba(15,39,72,0.08)] bg-gradient-to-br from-[#f8fbff] to-white p-4">
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
          <div className="rounded-[14px] border border-dashed border-[rgba(15,39,72,0.16)] bg-[#f8fafc] px-4 py-6 text-center">
            <p className="m-0 text-[0.9rem] font-bold text-brand-navy">No gateway transfer log</p>
            <p className="mt-1 mb-0 text-[0.8rem] font-semibold text-brand-muted">
              {row.utr ? `UTR on loan record: ${row.utr}` : 'Transfer may have been skipped or recorded offline.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[14px] border border-[rgba(15,39,72,0.08)] bg-[#fbfcff] px-4 py-3">
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
              <div className="rounded-[14px] border border-[rgba(15,39,72,0.08)] bg-[#fbfcff] px-4 py-3 sm:col-span-2">
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

            <details className="rounded-[12px] border border-[rgba(15,39,72,0.08)] bg-[#f8fafc] px-4 py-3">
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
          <span className="rounded-full bg-[rgba(15,39,72,0.06)] px-2.5 py-1 text-[0.72rem] font-extrabold text-brand-muted">
            {row.repayments.length} record{row.repayments.length === 1 ? '' : 's'}
          </span>
        }
      >
        {row.repayments.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[rgba(15,39,72,0.16)] bg-[#f8fafc] px-4 py-8 text-center">
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
                      className="border-b border-[rgba(15,39,72,0.08)] px-3 py-2.5 text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.repayments.map((payment) => {
                  const failed = payment.status === 'FAILED';
                  const partial = payment.status === 'PARTIAL';
                  return (
                    <tr
                      key={payment.uuid}
                      className="border-b border-[rgba(15,39,72,0.05)] last:border-0 hover:bg-[rgba(34,197,94,0.03)]"
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
                              : partial
                                ? { background: 'rgba(245,158,11,0.16)', color: '#b45309' }
                                : { background: 'rgba(16,185,129,0.14)', color: '#047857' }
                          }
                        >
                          {failed ? 'Unsuccessful' : partial ? 'Partially paid' : 'Paid fully'}
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

      <SectionCard
        title="NOC / closure letter"
        subtitle="Loan closure NOC emailed to the borrower after full repayment"
        action={
          row.isNocSent ? (
            <button
              type="button"
              disabled={openingNoc}
              onClick={() => void openNocPdf()}
              className="cursor-pointer rounded-full border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.08)] px-3.5 py-1.5 text-[0.72rem] font-extrabold text-brand-blue hover:bg-[rgba(34,197,94,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {openingNoc ? 'Opening…' : 'View NOC PDF'}
            </button>
          ) : showSendNoc ? (
            <button
              type="button"
              disabled={sendingNoc}
              onClick={() => void sendNoc()}
              className="cursor-pointer rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.1)] px-3.5 py-1.5 text-[0.72rem] font-extrabold text-[#047857] hover:bg-[rgba(16,185,129,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingNoc ? 'Sending…' : 'Send NOC'}
            </button>
          ) : null
        }
      >
        {row.isNocSent ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.06)] px-4 py-3">
              <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-[#047857]">Status</p>
              <p className="m-0 mt-1 text-[1rem] font-extrabold text-[#047857]">Sent</p>
            </div>
            <div className="rounded-[14px] border border-[rgba(15,39,72,0.08)] bg-[#fbfcff] px-4 py-3">
              <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Sent at
              </p>
              <p className="m-0 mt-1 text-[0.95rem] font-extrabold text-brand-navy">
                {row.nocSentAt ? formatDateTime(row.nocSentAt) : '—'}
              </p>
            </div>
            <div className="rounded-[14px] border border-[rgba(15,39,72,0.08)] bg-[#fbfcff] px-4 py-3">
              <p className="m-0 text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Letter number
              </p>
              <p className="m-0 mt-1 break-all font-mono text-[0.88rem] font-extrabold text-brand-navy">
                {row.nocLetterNumber ?? '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-[rgba(15,39,72,0.16)] bg-[#f8fafc] px-4 py-5 text-center">
            <p className="m-0 text-[0.9rem] font-bold text-brand-navy">
              {showSendNoc ? 'NOC not sent yet' : 'Not available yet'}
            </p>
            <p className="mt-1 mb-0 text-[0.8rem] font-semibold text-brand-muted">
              {showSendNoc
                ? 'Loan is fully repaid. Use Send NOC to generate the letter, store it, and email the borrower.'
                : 'The NOC letter and sent timestamp appear here after the loan is fully repaid.'}
            </p>
            {showSendNoc ? (
              <button
                type="button"
                disabled={sendingNoc}
                onClick={() => void sendNoc()}
                className="mt-4 cursor-pointer rounded-full border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)] px-4 py-2 text-[0.78rem] font-extrabold text-[#047857] hover:bg-[rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingNoc ? 'Sending NOC…' : 'Send NOC'}
              </button>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
