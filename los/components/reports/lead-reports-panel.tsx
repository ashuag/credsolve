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
import { formatCibilScoreLabel, formatReviewDateOnly, formatReviewInr, isDisplayedNtcCibilScore } from '@/lib/application-review-format';
import { getLosToken } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const EMPTY_FILTER_VALUE = '__none__';

const CIBIL_RANGE_PRESETS = [
  { label: '750+', min: 750 },
  { label: '700–749', min: 700, max: 749 },
  { label: '650–699', min: 650, max: 699 },
  { label: 'Below 650', min: 300, max: 649 },
  { label: 'NTC', min: -1, max: 1 },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function uniqueValueOptions(
  rows: LosLeadReportListItem[],
  getValue: (row: LosLeadReportListItem) => string | null | undefined,
  getLabel?: (row: LosLeadReportListItem) => string | null | undefined,
) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const code = getValue(row)?.trim() ?? '';
    if (!code || code === 'NOT_APPLICABLE') {
      seen.set(EMPTY_FILTER_VALUE, 'None');
      continue;
    }
    if (!seen.has(code)) seen.set(code, getLabel?.(row)?.trim() || code);
  }
  return [...seen.entries()]
    .sort((a, b) => {
      if (a[0] === EMPTY_FILTER_VALUE) return 1;
      if (b[0] === EMPTY_FILTER_VALUE) return -1;
      return a[1].localeCompare(b[1], undefined, { sensitivity: 'base' });
    })
    .map(([value, label]) => ({ value, label }));
}

function emptyAwareValue(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  return !trimmed || trimmed === 'NOT_APPLICABLE' ? EMPTY_FILTER_VALUE : trimmed;
}

function CibilScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-brand-muted">—</span>;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[46px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold"
      style={
        isDisplayedNtcCibilScore(score)
          ? { background: 'rgba(99,102,241,0.12)', color: '#4f46e5' }
          : score >= 750
            ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' }
            : score >= 650
              ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
              : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
      }
    >
      {formatCibilScoreLabel(score)}
    </span>
  );
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

  const cityOptions = useMemo(
    () => uniqueValueOptions(reports, (row) => row.city),
    [reports],
  );
  const stateOptions = useMemo(
    () => uniqueValueOptions(reports, (row) => row.state),
    [reports],
  );
  const purposeOptions = useMemo(
    () => uniqueValueOptions(reports, (row) => row.purposeOfLoan),
    [reports],
  );
  const leadStatusOptions = useMemo(
    () => uniqueValueOptions(reports, (row) => row.leadStatusCode, (row) => row.leadStatusLabel),
    [reports],
  );
  const applicationStatusOptions = useMemo(
    () => uniqueValueOptions(reports, (row) => row.applicationStatusCode, (row) => row.applicationStatusLabel),
    [reports],
  );
  const loanStatusOptions = useMemo(
    () => uniqueValueOptions(reports, (row) => row.loanStatusCode, (row) => row.loanStatusLabel),
    [reports],
  );
  const repaymentStatusOptions = useMemo(
    () => uniqueValueOptions(reports, (row) => row.repaymentStatusCode, (row) => row.repaymentStatusLabel),
    [reports],
  );

  const columns = useMemo((): DataTableColumn<LosLeadReportListItem>[] => [
    {
      key: 'lead',
      label: 'Application ID',
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
      key: 'pan',
      label: 'PAN',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.panNumber ?? '',
      getSortValue: (row) => (row.panNumber ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search PAN…' },
      cellClassName: 'font-mono text-[0.82rem] whitespace-nowrap',
      render: (row) => row.panNumber ?? '—',
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
      headerClassName: 'min-w-[108px] whitespace-nowrap',
      getFilterValue: (row) => emptyAwareValue(row.city),
      getSortValue: (row) => (row.city ?? '').toLowerCase(),
      filter: { type: 'multi-select', placeholder: 'Cities', options: cityOptions },
      cellClassName: 'whitespace-nowrap',
      render: (row) => row.city ?? '—',
    },
    {
      key: 'state',
      label: 'State',
      headerClassName: 'min-w-[108px] whitespace-nowrap',
      getFilterValue: (row) => emptyAwareValue(row.state),
      getSortValue: (row) => (row.state ?? '').toLowerCase(),
      filter: { type: 'multi-select', placeholder: 'States', options: stateOptions },
      cellClassName: 'whitespace-nowrap',
      render: (row) => row.state ?? '—',
    },
    {
      key: 'purpose',
      label: 'Purpose of loan',
      headerClassName: 'min-w-[140px] whitespace-nowrap',
      getFilterValue: (row) => emptyAwareValue(row.purposeOfLoan),
      getSortValue: (row) => (row.purposeOfLoan ?? '').toLowerCase(),
      filter: { type: 'multi-select', placeholder: 'Purposes', options: purposeOptions },
      cellClassName: 'whitespace-nowrap',
      render: (row) => row.purposeOfLoan ?? '—',
    },
    {
      key: 'offerAmount',
      label: 'Loan offer amount',
      headerClassName: 'min-w-[128px] whitespace-nowrap',
      getFilterValue: (row) => (row.loanOfferAmount == null ? null : Number(row.loanOfferAmount)),
      getSortValue: (row) => (row.loanOfferAmount == null ? null : Number(row.loanOfferAmount)),
      filter: { type: 'number-range', placeholder: 'Amount range', min: 0 },
      cellClassName: 'whitespace-nowrap font-semibold text-brand-navy',
      render: (row) => formatReviewInr(row.loanOfferAmount),
    },
    {
      key: 'selectedAmount',
      label: 'Loan selected amount',
      headerClassName: 'min-w-[128px] whitespace-nowrap',
      getFilterValue: (row) => (row.loanSelectedAmount == null ? null : Number(row.loanSelectedAmount)),
      getSortValue: (row) => (row.loanSelectedAmount == null ? null : Number(row.loanSelectedAmount)),
      filter: { type: 'number-range', placeholder: 'Amount range', min: 0 },
      cellClassName: 'whitespace-nowrap font-semibold text-brand-navy',
      render: (row) => formatReviewInr(row.loanSelectedAmount),
    },
    {
      key: 'cibil',
      label: 'CIBIL',
      headerClassName: 'min-w-[128px] whitespace-nowrap',
      getFilterValue: (row) => row.cibilScore,
      getSortValue: (row) => row.cibilScore,
      filter: {
        type: 'number-range',
        placeholder: 'Score range',
        min: -1,
        max: 900,
        presets: CIBIL_RANGE_PRESETS,
      },
      cellClassName: 'whitespace-nowrap',
      render: (row) => <CibilScorePill score={row.cibilScore} />,
    },
    {
      key: 'leadStatus',
      label: 'Lead status',
      headerClassName: 'min-w-[128px] whitespace-nowrap',
      getFilterValue: (row) => emptyAwareValue(row.leadStatusCode),
      getSortValue: (row) => row.leadStatusLabel.toLowerCase(),
      filter: { type: 'multi-select', placeholder: 'Statuses', options: leadStatusOptions },
      cellClassName: 'whitespace-nowrap',
      render: (row) => <StatusBadge code={row.leadStatusCode} label={row.leadStatusLabel} />,
    },
    {
      key: 'applicationStatus',
      label: 'Application status',
      headerClassName: 'min-w-[148px] whitespace-nowrap',
      getFilterValue: (row) => emptyAwareValue(row.applicationStatusCode),
      getSortValue: (row) => (row.applicationStatusLabel ?? '').toLowerCase(),
      filter: { type: 'multi-select', placeholder: 'Statuses', options: applicationStatusOptions },
      cellClassName: 'whitespace-nowrap',
      render: (row) => (
        <StatusBadge code={row.applicationStatusCode} label={row.applicationStatusLabel} />
      ),
    },
    {
      key: 'loanStatus',
      label: 'Loan status',
      headerClassName: 'min-w-[128px] whitespace-nowrap',
      getFilterValue: (row) => emptyAwareValue(row.loanStatusCode),
      getSortValue: (row) => (row.loanStatusLabel ?? '').toLowerCase(),
      filter: { type: 'multi-select', placeholder: 'Statuses', options: loanStatusOptions },
      cellClassName: 'whitespace-nowrap',
      render: (row) => <StatusBadge code={row.loanStatusCode} label={row.loanStatusLabel} />,
    },
    {
      key: 'repaymentStatus',
      label: 'Repayment status',
      headerClassName: 'min-w-[148px] whitespace-nowrap',
      getFilterValue: (row) => emptyAwareValue(row.repaymentStatusCode),
      getSortValue: (row) => row.repaymentStatusLabel.toLowerCase(),
      filter: { type: 'multi-select', placeholder: 'Statuses', options: repaymentStatusOptions },
      cellClassName: 'whitespace-nowrap',
      render: (row) => (
        <StatusBadge code={row.repaymentStatusCode} label={row.repaymentStatusLabel} />
      ),
    },
    {
      key: 'created',
      label: 'Created',
      headerClassName: 'min-w-[188px] whitespace-nowrap',
      getFilterValue: (row) => row.createdAt,
      getSortValue: (row) => isoDateTimestamp(row.createdAt),
      filter: { type: 'datetime-range', placeholder: 'Date & time range' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (row) => formatDateTime(row.createdAt),
    },
  ], [applicationStatusOptions, cityOptions, leadStatusOptions, loanStatusOptions, purposeOptions, repaymentStatusOptions, stateOptions]);

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
        minWidth="1960px"
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
