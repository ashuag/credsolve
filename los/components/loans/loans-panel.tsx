'use client';

import {
  DataTable,
  isoDateTimestamp,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { getLoans, type LosLoan } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

function istCalendarYmd(asOf: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(asOf);
}

/** True when IST calendar day is after repay-by (maturity day itself is still on time). */
function isLoanPastDue(loan: LosLoan, asOf: Date = new Date()): boolean {
  if (loan.closedAt) return false;
  const code = loan.loanStatusCode.toUpperCase();
  if (code === 'CLOSED' || code.includes('WRITE')) return false;
  if (code === 'OVERDUE') return true;
  const maturityYmd = loan.loanMaturityDate?.slice(0, 10);
  if (!maturityYmd || !/^\d{4}-\d{2}-\d{2}$/.test(maturityYmd)) return false;
  return istCalendarYmd(asOf) > maturityYmd;
}

function effectiveStatusCode(loan: LosLoan): string {
  if (isLoanPastDue(loan)) return 'OVERDUE';
  return loan.loanStatusCode;
}

function StatusPill({ label, code }: { label: string; code?: string }) {
  const s = (code ?? label).toUpperCase();
  const isClosed = s.includes('CLOSED') || s.includes('WRITE') || s === 'PAID';
  const isOverdue = s.includes('OVERDUE');
  const isActive = s === 'ACTIVE' || s.includes('DISBURS');
  const style = isOverdue
    ? { background: 'rgba(239,68,68,0.14)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.28)' }
    : isClosed
      ? { background: 'rgba(16,185,129,0.14)', color: '#047857', border: '1px solid rgba(16,185,129,0.3)' }
      : isActive
        ? { background: 'rgba(14,165,233,0.14)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.28)' }
        : { background: 'rgba(99,102,241,0.12)', color: '#4338ca', border: '1px solid rgba(99,102,241,0.22)' };
  const display =
    isClosed && !s.includes('WRITE')
      ? 'Paid fully'
      : isOverdue
        ? 'Overdue'
        : label;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap" style={style}>
      {display}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 rounded-[14px] border"
      style={{ background: `${color}09`, borderColor: `${color}22` }}
    >
      <span className="text-[0.68rem] font-extrabold tracking-[0.14em] uppercase" style={{ color: `${color}cc` }}>
        {label}
      </span>
      <span className="text-[1.45rem] font-extrabold leading-none tracking-tight" style={{ color }}>
        {value}
      </span>
      {sub ? <span className="text-[0.72rem] text-brand-muted">{sub}</span> : null}
    </div>
  );
}

export function LoansPanel() {
  const [loans, setLoans] = useState<LosLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      setLoading(false);
      return;
    }
    try {
      setLoans(await getLoans(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  const columns = useMemo((): DataTableColumn<LosLoan>[] => [
    {
      key: 'loan',
      label: 'Loan',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => `${row.loanNumber} ${row.applicationNumber}`,
      getSortValue: (row) => (row.loanNumber ?? '').toUpperCase(),
      filter: { type: 'text', placeholder: 'Search loan no…' },
      render: (loan) => (
        <Link href={`/loans/${loan.uuid}`} className="no-underline group">
          <div className="font-extrabold text-brand-navy group-hover:text-brand-blue">
            {loan.loanNumber}
          </div>
          <div className="text-[0.72rem] text-brand-muted mt-0.5">
            App {loan.applicationNumber}
          </div>
        </Link>
      ),
    },
    {
      key: 'borrower',
      label: 'Borrower',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) =>
        [row.fullName, row.mobileNumber, row.email].filter(Boolean).join(' '),
      getSortValue: (row) => (row.fullName ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name, mobile…' },
      render: (loan) => {
        const name = formatPersonName(loan.fullName, 'Borrower (name pending)');
        return (
          <>
            <div className="font-bold text-brand-text">{name}</div>
            <div className="text-[0.72rem] text-brand-muted mt-0.5">{loan.mobileNumber}</div>
          </>
        );
      },
    },
    {
      key: 'principal',
      label: 'Principal',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.principalAmount ?? '',
      getSortValue: (row) => {
        const n = Number(row.principalAmount);
        return Number.isFinite(n) ? n : null;
      },
      filter: false,
      cellClassName: 'font-bold text-brand-text whitespace-nowrap',
      render: (loan) => formatINR(loan.principalAmount),
    },
    {
      key: 'netDisbursed',
      label: 'Net disbursed',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.netDisbursedAmount ?? '',
      getSortValue: (row) => {
        const n = Number(row.netDisbursedAmount);
        return Number.isFinite(n) ? n : null;
      },
      filter: false,
      cellClassName: 'font-bold text-[#047857] whitespace-nowrap',
      render: (loan) => formatINR(loan.netDisbursedAmount),
    },
    {
      key: 'repayBy',
      label: 'Repay by',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.loanMaturityDate ?? '',
      getSortValue: (row) => isoDateTimestamp(row.loanMaturityDate),
      filter: { type: 'date' },
      cellClassName: 'whitespace-nowrap text-brand-text',
      render: (loan) => {
        const overdue = isLoanPastDue(loan);
        return (
          <span className={overdue ? 'font-bold text-[#b91c1c]' : undefined}>
            {formatDate(loan.loanMaturityDate)}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => (isLoanPastDue(row) ? 'Overdue' : row.loanStatusLabel),
      getSortValue: (row) =>
        (isLoanPastDue(row) ? 'Overdue' : row.loanStatusLabel).toLowerCase(),
      filter: { type: 'text', placeholder: 'Search status…' },
      render: (loan) => (
        <StatusPill
          label={isLoanPastDue(loan) ? 'Overdue' : loan.loanStatusLabel}
          code={effectiveStatusCode(loan)}
        />
      ),
    },
    {
      key: 'disbursed',
      label: 'Disbursed',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.disbursedAt ?? '',
      getSortValue: (row) => isoDateTimestamp(row.disbursedAt),
      filter: { type: 'date' },
      cellClassName: 'whitespace-nowrap text-brand-muted',
      render: (loan) => formatDateTime(loan.disbursedAt),
    },
  ], []);

  const overdueCount = loans.filter((loan) => isLoanPastDue(loan)).length;
  const activeCount = loans.filter((loan) => effectiveStatusCode(loan).toUpperCase() === 'ACTIVE').length;
  const totalDisbursed = loans.reduce((sum, loan) => sum + (Number(loan.netDisbursedAmount) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {!loading && !fetchError ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Loans" value={loans.length} color="#1496f3" />
          <StatCard label="Active" value={activeCount} color="#10b981" sub={`of ${loans.length}`} />
          <StatCard label="Overdue" value={overdueCount} color="#ef4444" />
          <StatCard
            label="Net Disbursed"
            value={formatINR(String(totalDisbursed))}
            color="#6366f1"
            sub="all time"
          />
        </div>
      ) : null}

      <DataTable
        items={loans}
        columns={columns}
        getRowKey={(loan) => loan.uuid}
        entityLabel="loans"
        loading={loading}
        error={fetchError}
        onRetry={() => void loadLoans()}
        emptyMessage="No disbursed loans yet. Approve and disburse an application to see it here."
        noResultsMessage="No loans match your filters."
        renderRowClassName={(loan) =>
          isLoanPastDue(loan)
            ? 'border-b border-[rgba(239,68,68,0.12)] bg-[rgba(239,68,68,0.06)] transition-colors hover:bg-[rgba(239,68,68,0.1)]'
            : undefined
        }
        toolbarActions={
          <button
            type="button"
            onClick={() => void loadLoans()}
            className="h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)]"
          >
            ↺ Refresh
          </button>
        }
      />
    </div>
  );
}
