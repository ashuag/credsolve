'use client';

import {
  DataTable,
  isoDateTimestamp,
  LOS_LISTING_PAGE_SIZE,
  LOS_LISTING_PAGE_SIZE_OPTIONS,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { losStatusPillStyles } from '@/components/shared/los-status-pill';
import { downloadLeadReportsExport, getLeadReports, type LosLeadReportListItem } from '@/lib/api';
import { formatReviewDateOnly, formatReviewInr } from '@/lib/application-review-format';
import { getLosToken } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function uniqueStatusOptions(
  rows: LosLeadReportListItem[],
  getCode: (row: LosLeadReportListItem) => string | null,
  getLabel: (row: LosLeadReportListItem) => string | null,
) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const code = getCode(row);
    if (!code || code === 'NOT_APPLICABLE') {
      seen.set('__none__', 'None');
      continue;
    }
    if (!seen.has(code)) seen.set(code, getLabel(row) ?? code);
  }
  return [...seen.entries()].map(([value, label]) => ({ value, label }));
}

function StatusBadge({ code, label }: { code: string | null; label: string | null }) {
  if (!code || !label || code === 'NOT_APPLICABLE') {
    return <span className="text-brand-muted">—</span>;
  }
  const s = losStatusPillStyles(code);
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.07em] ring-1 ring-inset"
      style={{ backgroundColor: s.bg, color: s.text, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article
      className="rounded-[10px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
    >
      <span className="block text-[0.78rem] text-brand-muted">{label}</span>
      <strong className="mt-0.5 block text-[1.55rem] font-extrabold leading-none tracking-[-0.03em]">
        {value}
      </strong>
    </article>
  );
}

export function LeadReportsPanel() {
  const [reports, setReports] = useState<LosLeadReportListItem[]>([]);
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
      setReports(await getLeadReports(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load lead reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const leadStatusOptions = useMemo(
    () => uniqueStatusOptions(reports, (row) => row.leadStatusCode, (row) => row.leadStatusLabel),
    [reports],
  );
  const applicationStatusOptions = useMemo(
    () => uniqueStatusOptions(reports, (row) => row.applicationStatusCode, (row) => row.applicationStatusLabel),
    [reports],
  );
  const loanStatusOptions = useMemo(
    () => uniqueStatusOptions(reports, (row) => row.loanStatusCode, (row) => row.loanStatusLabel),
    [reports],
  );
  const repaymentStatusOptions = useMemo(
    () => uniqueStatusOptions(reports, (row) => row.repaymentStatusCode, (row) => row.repaymentStatusLabel),
    [reports],
  );

  const columns = useMemo((): DataTableColumn<LosLeadReportListItem>[] => [
    {
      key: 'lead',
      label: 'Lead ID',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.leadNumber,
      getSortValue: (row) => row.leadNumber.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search lead…' },
      render: (row) => (
        <Link
          href={`/reports/lead-report/${row.uuid}`}
          className="font-mono text-[0.82rem] font-semibold text-brand-blue no-underline hover:underline whitespace-nowrap"
        >
          {row.leadNumber}
        </Link>
      ),
    },
    {
      key: 'customer',
      label: 'PAN card name',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.panCardName?.trim() ?? row.fullName?.trim() ?? '',
      getSortValue: (row) => (row.panCardName?.trim() ?? row.fullName?.trim() ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (row) => (
        <Link
          href={`/reports/lead-report/${row.uuid}`}
          className="font-semibold text-brand-navy no-underline hover:underline whitespace-nowrap"
        >
          {formatPersonName(row.panCardName ?? row.fullName)}
        </Link>
      ),
    },
    {
      key: 'mobile',
      label: 'Mobile',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.mobileNumber,
      filter: { type: 'text', placeholder: 'Search mobile…' },
      cellClassName: 'font-mono text-[0.82rem] text-brand-text whitespace-nowrap',
      render: (row) => row.mobileNumber,
    },
    {
      key: 'dob',
      label: 'DOB',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.dateOfBirth ?? '',
      getSortValue: (row) => row.dateOfBirth ?? '',
      filter: { type: 'date', placeholder: 'Date' },
      cellClassName: 'whitespace-nowrap text-[0.82rem] text-brand-text',
      render: (row) => formatReviewDateOnly(row.dateOfBirth),
    },
    {
      key: 'city',
      label: 'City',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.city ?? '',
      getSortValue: (row) => (row.city ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search city…' },
      cellClassName: 'whitespace-nowrap',
      render: (row) => row.city ?? '—',
    },
    {
      key: 'state',
      label: 'State',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.state ?? '',
      getSortValue: (row) => (row.state ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search state…' },
      cellClassName: 'whitespace-nowrap',
      render: (row) => row.state ?? '—',
    },
    {
      key: 'purpose',
      label: 'Purpose of loan',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.purposeOfLoan ?? '',
      getSortValue: (row) => (row.purposeOfLoan ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search purpose…' },
      cellClassName: 'whitespace-nowrap',
      render: (row) => row.purposeOfLoan ?? '—',
    },
    {
      key: 'offerAmount',
      label: 'Loan offer amount',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.loanOfferAmount,
      getSortValue: (row) => row.loanOfferAmount == null ? null : Number(row.loanOfferAmount),
      filter: { type: 'number', placeholder: 'Amount…' },
      cellClassName: 'whitespace-nowrap font-semibold text-brand-navy',
      render: (row) => formatReviewInr(row.loanOfferAmount),
    },
    {
      key: 'selectedAmount',
      label: 'Loan selected amount',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.loanSelectedAmount,
      getSortValue: (row) => row.loanSelectedAmount == null ? null : Number(row.loanSelectedAmount),
      filter: { type: 'number', placeholder: 'Amount…' },
      cellClassName: 'whitespace-nowrap font-semibold text-brand-navy',
      render: (row) => formatReviewInr(row.loanSelectedAmount),
    },
    {
      key: 'leadStatus',
      label: 'Lead status',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.leadStatusCode,
      getSortValue: (row) => row.leadStatusLabel.toLowerCase(),
      filter: {
        type: 'select',
        options: leadStatusOptions,
        matches: (row, value) => row.leadStatusCode === value,
      },
      cellClassName: 'whitespace-nowrap',
      render: (row) => <StatusBadge code={row.leadStatusCode} label={row.leadStatusLabel} />,
    },
    {
      key: 'applicationStatus',
      label: 'Application status',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.applicationStatusCode ?? '',
      getSortValue: (row) => (row.applicationStatusLabel ?? '').toLowerCase(),
      filter: {
        type: 'select',
        options: applicationStatusOptions,
        matches: (row, value) => {
          if (value === '__none__') return row.applicationStatusCode == null;
          return row.applicationStatusCode === value;
        },
      },
      cellClassName: 'whitespace-nowrap',
      render: (row) => (
        <StatusBadge code={row.applicationStatusCode} label={row.applicationStatusLabel} />
      ),
    },
    {
      key: 'loanStatus',
      label: 'Loan status',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.loanStatusCode ?? '',
      getSortValue: (row) => (row.loanStatusLabel ?? '').toLowerCase(),
      filter: {
        type: 'select',
        options: loanStatusOptions,
        matches: (row, value) => {
          if (value === '__none__') return row.loanStatusCode == null;
          return row.loanStatusCode === value;
        },
      },
      cellClassName: 'whitespace-nowrap',
      render: (row) => <StatusBadge code={row.loanStatusCode} label={row.loanStatusLabel} />,
    },
    {
      key: 'repaymentStatus',
      label: 'Repayment status',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.repaymentStatusCode,
      getSortValue: (row) => row.repaymentStatusLabel.toLowerCase(),
      filter: {
        type: 'select',
        options: repaymentStatusOptions,
        matches: (row, value) => {
          if (value === '__none__') return row.repaymentStatusCode === 'NOT_APPLICABLE';
          return row.repaymentStatusCode === value;
        },
      },
      cellClassName: 'whitespace-nowrap',
      render: (row) => (
        <StatusBadge code={row.repaymentStatusCode} label={row.repaymentStatusLabel} />
      ),
    },
    {
      key: 'created',
      label: 'Created',
      headerClassName: 'min-w-[168px] whitespace-nowrap',
      getFilterValue: (row) => row.createdAt,
      getSortValue: (row) => isoDateTimestamp(row.createdAt),
      filter: { type: 'datetime-range', placeholder: 'Date & time' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (row) => formatDateTime(row.createdAt),
    },
  ], [applicationStatusOptions, leadStatusOptions, loanStatusOptions, repaymentStatusOptions]);

  const withApplication = reports.filter((row) => row.applicationUuid).length;
  const disbursed = reports.filter((row) => row.loanUuid).length;
  const overdue = reports.filter((row) => row.repaymentStatusCode === 'OVERDUE').length;
  const paid = reports.filter((row) => row.repaymentStatusCode === 'PAID').length;

  return (
    <div className="grid gap-3">
      {!loading && !fetchError ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryCard label="Total leads" value={reports.length} />
          <SummaryCard label="With application" value={withApplication} />
          <SummaryCard label="Disbursed" value={disbursed} />
          <SummaryCard label="Overdue" value={overdue} />
          <SummaryCard label="Paid" value={paid} />
        </div>
      ) : null}

      <DataTable
        items={reports}
        columns={columns}
        getRowKey={(row) => row.uuid}
        entityLabel="leads"
        loading={loading}
        error={fetchError}
        onRetry={() => void load()}
        emptyMessage="No leads have been recorded yet."
        noResultsMessage="No leads match your filters."
        minWidth="1680px"
        pageSize={LOS_LISTING_PAGE_SIZE}
        pageSizeOptions={LOS_LISTING_PAGE_SIZE_OPTIONS}
        initialSort={{ key: 'created', dir: 'desc' }}
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
                void downloadLeadReportsExport(token).catch((err) => {
                  setFetchError(err instanceof Error ? err.message : 'Failed to download lead report');
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
