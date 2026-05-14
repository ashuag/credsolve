'use client';

import type { CustomerLoanSelectionSnapshot } from '@/lib/api/customer-session';
import { formatIsoDateDdMmYyyy } from '@/lib/format-date';

function formatInr(amountInr: string | null): string {
  if (!amountInr?.trim()) return '—';
  const n = Number.parseFloat(amountInr);
  if (!Number.isFinite(n)) return amountInr;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatTenure(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return '—';
  if (days % 30 === 0 && days >= 30) {
    const m = days / 30;
    return `${m} mo`;
  }
  return `${Math.round(days)} days`;
}

export function LoanSummaryLeftRail({ loanSelection }: { loanSelection: CustomerLoanSelectionSnapshot | null }) {
  const hasAny =
    loanSelection &&
    (loanSelection.amountInr != null ||
      loanSelection.tenureDays != null ||
      loanSelection.maturityDate != null);

  if (!hasAny) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
        <p className="m-0 text-[0.82rem] font-[700] uppercase tracking-[0.12em] text-[#1496f3]">Loan details</p>
        <p className="mt-2 mb-0 text-[0.95rem] leading-relaxed text-slate-300 font-[500]">
          Amount and tenure appear here after you pick them in the offer step.
        </p>
      </div>
    );
  }

  const rows = [
    { label: 'Principal', value: formatInr(loanSelection!.amountInr) },
    { label: 'Tenure', value: formatTenure(loanSelection!.tenureDays) },
    {
      label: 'Maturity',
      value: formatIsoDateDdMmYyyy(loanSelection!.maturityDate),
    },
  ];

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      <p className="m-0 text-[0.72rem] font-[800] uppercase tracking-[0.14em] text-[#1496f3]">Your selection</p>
      <dl className="mt-4 grid gap-3 m-0">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] pb-3 last:border-0 last:pb-0">
            <dt className="m-0 text-[0.78rem] font-[700] uppercase tracking-[0.1em] text-slate-400">{r.label}</dt>
            <dd className="m-0 text-right text-[1.05rem] font-[800] text-white tracking-tight">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
