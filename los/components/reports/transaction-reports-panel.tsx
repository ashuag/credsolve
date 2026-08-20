'use client';

import {
  DataTable,
  isoDateTimestamp,
  LOS_LISTING_PAGE_SIZE,
  LOS_LISTING_PAGE_SIZE_OPTIONS,
  type DataTableColumn,
} from '@/components/ui/data-table';
import {
  downloadTransactionReportsExport,
  getTransactionReports,
  type LosTransactionReportListItem,
} from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const ymd = iso.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatINRExact(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercent(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value}%`;
  return `${n}%`;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function moneyColumn(
  key: string,
  label: string,
  getValue: (row: LosTransactionReportListItem) => string | null,
): DataTableColumn<LosTransactionReportListItem> {
  return {
    key,
    label,
    headerClassName: 'whitespace-nowrap text-right',
    getFilterValue: (row) => toNumber(getValue(row)),
    getSortValue: (row) => toNumber(getValue(row)),
    filter: { type: 'number', placeholder: 'Amount…' },
    cellClassName: 'text-right font-semibold text-brand-navy whitespace-nowrap',
    render: (row) => formatINRExact(getValue(row)),
  };
}

function percentColumn(
  key: string,
  label: string,
  getValue: (row: LosTransactionReportListItem) => string | null,
): DataTableColumn<LosTransactionReportListItem> {
  return {
    key,
    label,
    headerClassName: 'whitespace-nowrap text-right',
    getFilterValue: (row) => toNumber(getValue(row)),
    getSortValue: (row) => toNumber(getValue(row)),
    filter: { type: 'number', placeholder: '%…' },
    cellClassName: 'text-right font-mono text-[0.82rem] whitespace-nowrap',
    render: (row) => formatPercent(getValue(row)),
  };
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article
      className="rounded-[10px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
    >
      <span className="block text-[0.78rem] text-brand-muted">{label}</span>
      <strong className="mt-0.5 block text-[1.35rem] font-extrabold leading-none tracking-[-0.03em]">
        {value}
      </strong>
    </article>
  );
}

export function TransactionReportsPanel() {
  const [reports, setReports] = useState<LosTransactionReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getLosToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      setLoading(false);
      return;
    }
    try {
      setReports(await getTransactionReports(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load transaction reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo((): DataTableColumn<LosTransactionReportListItem>[] => [
    {
      key: 'transaction',
      label: 'Transaction',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.transactionId,
      getSortValue: (row) => row.transactionId.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search…' },
      render: (row) => (
        <Link
          href={`/loans/${row.uuid}`}
          className="font-mono text-[0.82rem] font-semibold text-brand-blue no-underline hover:underline whitespace-nowrap"
        >
          {row.transactionId}
        </Link>
      ),
    },
    {
      key: 'application',
      label: 'Application ID',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.applicationNumber,
      getSortValue: (row) => row.applicationNumber.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search…' },
      render: (row) => (
        <Link
          href={`/applications/${row.applicationUuid}`}
          className="font-mono text-[0.82rem] font-semibold text-brand-navy no-underline hover:underline whitespace-nowrap"
        >
          {row.applicationNumber}
        </Link>
      ),
    },
    {
      key: 'customer',
      label: 'Customer name',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.fullName?.trim() ?? '',
      getSortValue: (row) => (row.fullName?.trim() ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (row) => (
        <Link
          href={`/customers/${row.customerUuid}`}
          className="font-semibold text-brand-navy no-underline hover:underline whitespace-nowrap"
        >
          {formatPersonName(row.fullName)}
        </Link>
      ),
    },
    {
      key: 'mobile',
      label: 'Mobile number',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.mobileNumber,
      filter: { type: 'text', placeholder: 'Search mobile…' },
      cellClassName: 'font-mono text-[0.82rem] text-brand-text whitespace-nowrap',
      render: (row) => row.mobileNumber,
    },
    {
      key: 'email',
      label: 'Email ID',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.email ?? '',
      getSortValue: (row) => (row.email ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search email…' },
      cellClassName: 'text-[0.82rem] whitespace-nowrap',
      render: (row) => row.email?.trim() || <span className="text-brand-muted">—</span>,
    },
    {
      key: 'dob',
      label: 'DOB',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.dateOfBirth ?? '',
      getSortValue: (row) => isoDateTimestamp(row.dateOfBirth),
      filter: { type: 'date', placeholder: 'Date' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (row) => formatDate(row.dateOfBirth),
    },
    {
      key: 'pan',
      label: 'PAN number',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.panNumber ?? '',
      filter: { type: 'text', placeholder: 'Search PAN…' },
      cellClassName: 'font-mono text-[0.82rem] whitespace-nowrap',
      render: (row) => row.panNumber || <span className="text-brand-muted">—</span>,
    },
    {
      key: 'disbursedAt',
      label: 'Disbursement date',
      headerClassName: 'min-w-[140px] whitespace-nowrap',
      getFilterValue: (row) => row.disbursedAt,
      getSortValue: (row) => isoDateTimestamp(row.disbursedAt),
      filter: { type: 'datetime-range', placeholder: 'Date' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (row) => formatDate(row.disbursedAt),
    },
    moneyColumn('disbursedAmount', 'Disbursed amount', (row) => row.disbursedAmount),
    moneyColumn('interestReceived', 'Interest received', (row) => row.interestReceived),
    percentColumn('interestRate', 'Interest rate %', (row) => row.interestRate),
    percentColumn('processingFeePercent', 'Processing fees %', (row) => row.processingFeePercent),
    moneyColumn('processingFeeAmount', 'Processing fee amount', (row) => row.processingFeeAmount),
    percentColumn('gstOnPfPercent', 'GST on PF %', (row) => row.gstOnPfPercent),
    moneyColumn('gstAmount', 'GST amount', (row) => row.gstAmount),
    {
      key: 'dueDate',
      label: 'Due date',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.dueDate ?? '',
      getSortValue: (row) => isoDateTimestamp(row.dueDate),
      filter: { type: 'date', placeholder: 'Date' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (row) => formatDate(row.dueDate),
    },
    {
      key: 'repaymentAt',
      label: 'Repayment date',
      headerClassName: 'min-w-[140px] whitespace-nowrap',
      getFilterValue: (row) => row.repaymentAt ?? '',
      getSortValue: (row) => isoDateTimestamp(row.repaymentAt),
      filter: { type: 'datetime-range', placeholder: 'Date' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (row) =>
        row.repaymentAt ? formatDate(row.repaymentAt) : <span className="text-brand-muted">—</span>,
    },
    {
      key: 'daysExceeded',
      label: 'Days exceeded from due date',
      headerClassName: 'whitespace-nowrap text-right',
      getFilterValue: (row) => row.daysExceeded,
      getSortValue: (row) => row.daysExceeded,
      filter: { type: 'number', placeholder: 'Days…' },
      cellClassName: 'text-right whitespace-nowrap',
      render: (row) =>
        row.daysExceeded > 0 ? (
          <span className="font-extrabold text-[#b91c1c]">{row.daysExceeded}</span>
        ) : (
          <span className="text-brand-muted">0</span>
        ),
    },
    moneyColumn('penalCharges', 'Penal charges', (row) => row.penalCharges),
  ], []);

  const repaid = reports.filter((row) => row.repaymentAt).length;
  const delayed = reports.filter((row) => row.daysExceeded > 0).length;
  const disbursedTotal = reports.reduce((sum, row) => sum + (toNumber(row.disbursedAmount) ?? 0), 0);
  const interestTotal = reports.reduce((sum, row) => sum + (toNumber(row.interestReceived) ?? 0), 0);

  return (
    <div className="grid gap-3">
      {!loading && !fetchError ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryCard label="Total transactions" value={reports.length} />
          <SummaryCard label="Repaid" value={repaid} />
          <SummaryCard label="Delayed" value={delayed} />
          <SummaryCard label="Disbursed" value={formatINRExact(disbursedTotal.toFixed(2))} />
          <SummaryCard label="Interest received" value={formatINRExact(interestTotal.toFixed(2))} />
        </div>
      ) : null}

      <DataTable
        items={reports}
        columns={columns}
        getRowKey={(row) => row.uuid}
        entityLabel="transactions"
        loading={loading}
        error={fetchError}
        onRetry={() => void load()}
        emptyMessage="No disbursed loan transactions have been recorded yet."
        noResultsMessage="No transactions match your filters."
        minWidth="2200px"
        pageSize={LOS_LISTING_PAGE_SIZE}
        pageSizeOptions={LOS_LISTING_PAGE_SIZE_OPTIONS}
        initialSort={{ key: 'disbursedAt', dir: 'desc' }}
        toolbarActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const token = getLosToken();
                if (!token) {
                  setFetchError('Session expired — please log in again.');
                  return;
                }
                void downloadTransactionReportsExport(token).catch((err) => {
                  setFetchError(err instanceof Error ? err.message : 'Failed to download transaction report');
                });
              }}
              className="inline-flex h-[32px] cursor-pointer items-center whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)]"
            >
              ⬇ Download
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)]"
            >
              ↺ Refresh
            </button>
          </div>
        }
      />
    </div>
  );
}
