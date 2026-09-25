'use client';

import {
  DataTable,
  isoDateTimestamp,
  LOS_LISTING_PAGE_SIZE,
  LOS_LISTING_PAGE_SIZE_OPTIONS,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { getLoans, markApplicationInternalTesting, refreshLoanPayment, sendLoanNocLetter, type LosLoan } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import { RefreshPaymentButton, useCanRefreshLoanPayment } from '@/components/loans/refresh-payment-button';
import { loanNeedsNoc, SendNocButton, useCanSendLoanNoc } from '@/components/loans/send-noc-button';
import { MarkInternalTestingButton, useCanMarkInternalTesting } from '@/components/shared/mark-internal-testing-button';
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
  if (code === 'CLOSED' || code === 'SETTLED' || code.includes('WRITE')) return false;
  if (code === 'OVERDUE') return true;
  const maturityYmd = loan.loanMaturityDate?.slice(0, 10);
  if (!maturityYmd || !/^\d{4}-\d{2}-\d{2}$/.test(maturityYmd)) return false;
  return istCalendarYmd(asOf) > maturityYmd;
}

function effectiveStatusCode(loan: LosLoan): string {
  if (isLoanPastDue(loan)) return 'OVERDUE';
  return loan.loanStatusCode;
}

const GRADE_TONE: Record<string, { background: string; color: string }> = {
  A: { background: 'rgba(16,185,129,0.1)', color: '#10b981' },
  B: { background: 'rgba(16,185,129,0.1)', color: '#10b981' },
  C: { background: 'rgba(16,185,129,0.1)', color: '#10b981' },
  D: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  E: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  F: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  G: { background: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  H: { background: 'rgba(239,68,68,0.1)', color: '#ef4444' },
};

function GradeBadge({ category }: { category: string | null | undefined }) {
  if (!category) return <span className="text-brand-muted">—</span>;
  const style = GRADE_TONE[category] ?? { background: 'rgba(99,102,241,0.12)', color: '#4f46e5' };
  return (
    <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold" style={style}>
      {category}
    </span>
  );
}

function StatusPill({ label, code }: { label: string; code?: string }) {
  const s = (code ?? label).toUpperCase();
  const isSettled = s === 'SETTLED';
  const isClosed = s.includes('CLOSED') || s.includes('WRITE') || s === 'PAID';
  const isOverdue = s.includes('OVERDUE');
  const isActive = s === 'ACTIVE' || s.includes('DISBURS');
  const style = isOverdue
    ? { background: 'rgba(239,68,68,0.14)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.28)' }
    : isSettled
      ? { background: 'rgba(79,70,229,0.14)', color: '#3730a3', border: '1px solid rgba(79,70,229,0.28)' }
      : isClosed
        ? { background: 'rgba(16,185,129,0.14)', color: '#047857', border: '1px solid rgba(16,185,129,0.3)' }
        : isActive
          ? { background: 'rgba(14,165,233,0.14)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.28)' }
          : { background: 'rgba(99,102,241,0.12)', color: '#4338ca', border: '1px solid rgba(99,102,241,0.22)' };
  const display =
    isSettled
      ? 'Settled'
      : isClosed && !s.includes('WRITE')
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
  const [busyUuid, setBusyUuid] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const canMarkTesting = useCanMarkInternalTesting();
  const canRefreshPayment = useCanRefreshLoanPayment();
  const canSendNoc = useCanSendLoanNoc();

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

  const markAsInternalTesting = useCallback(async (loan: LosLoan) => {
    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      return;
    }
    setBusyUuid(loan.uuid);
    setFetchError(null);
    try {
      await markApplicationInternalTesting(token, loan.applicationUuid);
      setLoans((prev) => prev.filter((row) => row.uuid !== loan.uuid));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to mark loan as internal testing');
    } finally {
      setBusyUuid(null);
    }
  }, []);

  const sendNoc = useCallback(async (loan: LosLoan) => {
    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      return;
    }
    setBusyUuid(loan.uuid);
    setFetchError(null);
    setActionMessage(null);
    try {
      const updated = await sendLoanNocLetter(token, loan.uuid);
      setLoans((prev) =>
        prev.map((row) =>
          row.uuid === loan.uuid ? { ...row, isNocSent: updated.isNocSent } : row,
        ),
      );
      setActionMessage({
        tone: 'ok',
        text: `NOC sent for ${loan.loanNumber}.`,
      });
    } catch (err) {
      setActionMessage({
        tone: 'err',
        text: err instanceof Error ? err.message : 'Failed to send NOC letter',
      });
    } finally {
      setBusyUuid(null);
    }
  }, []);

  const refreshPayment = useCallback(async (loan: LosLoan) => {
    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      return;
    }
    setBusyUuid(loan.uuid);
    setFetchError(null);
    setActionMessage(null);
    try {
      const result = await refreshLoanPayment(token, loan.uuid);
      if (result.outcome === 'updated') {
        setActionMessage({ tone: 'ok', text: result.message });
        setLoans(await getLoans(token));
        return;
      }
      setActionMessage({
        tone: result.outcome === 'retrieve_failed' ? 'err' : 'warn',
        text: result.message,
      });
      setLoans((prev) =>
        prev.map((row) =>
          row.uuid === loan.uuid
            ? {
                ...row,
                unsettledPaymentLink: result.unsettledPaymentLink,
                closedAt: result.closedAt,
                loanStatusCode: result.loanStatusCode,
                loanStatusLabel: result.loanStatusLabel,
              }
            : row,
        ),
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to refresh payment status');
    } finally {
      setBusyUuid(null);
    }
  }, []);

  const allColumns = useMemo((): DataTableColumn<LosLoan>[] => [
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
      key: 'grade',
      label: 'Grade',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.cibilCreditAssessmentCategory ?? '',
      getSortValue: (row) => row.cibilCreditAssessmentCategory ?? '',
      filter: {
        type: 'select',
        options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((g) => ({ value: g, label: g })),
        matches: (row, value) => row.cibilCreditAssessmentCategory === value,
      },
      render: (loan) => <GradeBadge category={loan.cibilCreditAssessmentCategory} />,
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
      key: 'repaymentWithPenal',
      label: 'Repayment + penal',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.totalRepaymentWithPenalAmount ?? '',
      getSortValue: (row) => {
        const n = Number(row.totalRepaymentWithPenalAmount);
        return Number.isFinite(n) ? n : null;
      },
      filter: false,
      cellClassName: 'whitespace-nowrap',
      render: (loan) => {
        const penal = Number(loan.penalAmount);
        const hasPenal = Number.isFinite(penal) && penal > 0;
        return (
          <>
            <div className={hasPenal ? 'font-bold text-[#b91c1c]' : 'font-bold text-brand-text'}>
              {formatINR(loan.totalRepaymentWithPenalAmount)}
            </div>
            {hasPenal || Number(loan.overdueInterestInr) > 0 || Number(loan.waivedAmountInr) > 0 ? (
              <div className="text-[0.72rem] text-brand-muted mt-0.5">
                {[
                  Number(loan.overdueInterestInr) > 0
                    ? `${formatINR(loan.overdueInterestInr)} overdue interest`
                    : null,
                  hasPenal ? `${formatINR(loan.penalAmount)} penal` : null,
                  Number(loan.waivedAmountInr) > 0
                    ? `${formatINR(loan.waivedAmountInr)} waived`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            ) : null}
          </>
        );
      },
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
      key: 'waived',
      label: 'Waived',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.waivedAmountInr ?? '',
      getSortValue: (row) => {
        const n = Number(row.waivedAmountInr);
        return Number.isFinite(n) ? n : 0;
      },
      filter: false,
      cellClassName: 'whitespace-nowrap',
      render: (loan) =>
        Number(loan.waivedAmountInr) > 0 ? (
          <span className="font-bold text-[#3730a3]">{formatINR(loan.waivedAmountInr)}</span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      key: 'overdueDays',
      label: 'Overdue days',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => (row.overdueDays > 0 ? String(row.overdueDays) : ''),
      getSortValue: (row) => row.overdueDays ?? 0,
      filter: false,
      cellClassName: 'whitespace-nowrap',
      render: (loan) =>
        loan.overdueDays > 0 ? (
          <span className="font-bold text-[#b91c1c]">
            {loan.overdueDays} {loan.overdueDays === 1 ? 'day' : 'days'}
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
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
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'whitespace-nowrap',
      sortable: false,
      filter: false,
      render: (loan) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {!loan.closedAt ? (
            <RefreshPaymentButton
              busy={busyUuid === loan.uuid}
              onClick={() => void refreshPayment(loan)}
            />
          ) : null}
          {loanNeedsNoc(loan) ? (
            <SendNocButton busy={busyUuid === loan.uuid} onClick={() => void sendNoc(loan)} />
          ) : null}
          <MarkInternalTestingButton
            busy={busyUuid === loan.uuid}
            onConfirm={() => void markAsInternalTesting(loan)}
          />
        </div>
      ),
    },
  ], [busyUuid, markAsInternalTesting, refreshPayment, sendNoc]);

  const columns = canMarkTesting || canRefreshPayment || canSendNoc
    ? allColumns
    : allColumns.filter((column) => column.key !== 'actions');

  const overdueCount = loans.filter((loan) => isLoanPastDue(loan)).length;
  const activeCount = loans.filter((loan) => effectiveStatusCode(loan).toUpperCase() === 'ACTIVE').length;
  const totalDisbursed = loans.reduce((sum, loan) => sum + (Number(loan.netDisbursedAmount) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {!loading && !fetchError ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Loans" value={loans.length} color="#22C55E" />
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

      {actionMessage ? (
        <p
          className="m-0 rounded-[10px] border px-3 py-2 text-[0.84rem] font-bold"
          style={
            actionMessage.tone === 'ok'
              ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.28)', color: '#047857' }
              : actionMessage.tone === 'err'
                ? { background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.24)', color: '#b91c1c' }
                : { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.28)', color: '#b45309' }
          }
        >
          {actionMessage.text}
        </p>
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
        pageSize={LOS_LISTING_PAGE_SIZE}
        pageSizeOptions={LOS_LISTING_PAGE_SIZE_OPTIONS}
        renderRowClassName={(loan) =>
          isLoanPastDue(loan)
            ? 'border-b border-[rgba(239,68,68,0.12)] bg-[rgba(239,68,68,0.06)] transition-colors hover:bg-[rgba(239,68,68,0.1)]'
            : undefined
        }
        toolbarActions={
          <button
            type="button"
            onClick={() => void loadLoans()}
            className="h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(34,197,94,0.06)]"
          >
            ↺ Refresh
          </button>
        }
      />
    </div>
  );
}
