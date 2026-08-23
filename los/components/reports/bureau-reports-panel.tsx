'use client';

import {
  DataTable,
  isoDateTimestamp,
  LOS_LISTING_PAGE_SIZE,
  LOS_LISTING_PAGE_SIZE_OPTIONS,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { formatCibilScoreLabel, isDisplayedNtcCibilScore } from '@/lib/application-review-format';
import { downloadBureauReportsExport, getBureauReports, type LosBureauReportListItem } from '@/lib/api';
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

function GradeBadge({ category }: { category: string | null }) {
  if (!category) return <span className="text-brand-muted">—</span>;
  const style = GRADE_TONE[category] ?? { background: 'rgba(99,102,241,0.12)', color: '#4f46e5' };
  return (
    <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold" style={style}>
      {category}
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

export function BureauReportsPanel() {
  const [reports, setReports] = useState<LosBureauReportListItem[]>([]);
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
      setReports(await getBureauReports(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load bureau reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo((): DataTableColumn<LosBureauReportListItem>[] => [
    {
      key: 'lead',
      label: 'Application ID',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.leadNumber,
      getSortValue: (row) => row.leadNumber.toLowerCase(),
      filter: { type: 'text', placeholder: 'Search lead…' },
      render: (row) => (
        <Link
          href={`/reports/bureau-report/${row.leadUuid}`}
          className="font-mono text-[0.82rem] font-semibold text-brand-blue no-underline hover:underline whitespace-nowrap"
        >
          {row.leadNumber}
        </Link>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.fullName?.trim() ?? '',
      getSortValue: (row) => (row.fullName?.trim() ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (row) => (
        <Link
          href={`/reports/bureau-report/${row.leadUuid}`}
          className="font-semibold text-brand-blue no-underline hover:underline whitespace-nowrap"
        >
          {formatPersonName(row.fullName)}
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
      key: 'cibil',
      label: 'CIBIL',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.cibilScore,
      getSortValue: (row) => row.cibilScore,
      filter: { type: 'number', placeholder: 'Score…' },
      cellClassName: 'whitespace-nowrap',
      render: (row) => <CibilScorePill score={row.cibilScore} />,
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
      cellClassName: 'whitespace-nowrap',
      render: (row) => <GradeBadge category={row.cibilCreditAssessmentCategory} />,
    },
    {
      key: 'application',
      label: 'Application',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.applicationNumber ?? '',
      getSortValue: (row) => (row.applicationNumber ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search…' },
      render: (row) =>
        row.applicationUuid && row.applicationNumber ? (
          <Link
            href={`/applications/${row.applicationUuid}`}
            className="font-mono text-[0.82rem] font-semibold text-brand-navy no-underline hover:underline whitespace-nowrap"
          >
            {row.applicationNumber}
          </Link>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      key: 'source',
      label: 'Source',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => (row.dummyFetched ? 'dummy' : 'live'),
      getSortValue: (row) => (row.dummyFetched ? 1 : 0),
      filter: {
        type: 'select',
        options: [
          { value: 'live', label: 'Live' },
          { value: 'dummy', label: 'Dummy' },
        ],
        matches: (row, value) => (value === 'dummy' ? row.dummyFetched : !row.dummyFetched),
      },
      render: (row) => (
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-bold"
          style={
            row.dummyFetched
              ? { background: 'rgba(245,158,11,0.12)', color: '#d97706' }
              : { background: 'rgba(16,185,129,0.1)', color: '#059669' }
          }
        >
          {row.dummyFetched ? 'Dummy' : 'Live'}
        </span>
      ),
    },
    {
      key: 'fetched',
      label: 'Fetched',
      headerClassName: 'min-w-[168px] whitespace-nowrap',
      getFilterValue: (row) => row.fetchedAt,
      getSortValue: (row) => isoDateTimestamp(row.fetchedAt),
      filter: { type: 'datetime-range', placeholder: 'Date & time' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (row) => formatDateTime(row.fetchedAt),
    },
  ], []);

  const todayCount = reports.filter((row) => {
    const d = new Date(row.fetchedAt);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const dummyCount = reports.filter((row) => row.dummyFetched).length;

  return (
    <div className="grid gap-3">
      {!loading && !fetchError ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryCard label="Total reports" value={reports.length} />
          <SummaryCard label="Fetched today" value={todayCount} />
          <SummaryCard label="Dummy pulls" value={dummyCount} />
        </div>
      ) : null}

      <DataTable
        items={reports}
        columns={columns}
        getRowKey={(row) => row.uuid}
        entityLabel="bureau reports"
        loading={loading}
        error={fetchError}
        onRetry={() => void load()}
        emptyMessage="No bureau reports have been stored yet."
        noResultsMessage="No bureau reports match your filters."
        minWidth="1220px"
        pageSize={LOS_LISTING_PAGE_SIZE}
        pageSizeOptions={LOS_LISTING_PAGE_SIZE_OPTIONS}
        initialSort={{ key: 'fetched', dir: 'desc' }}
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
                void downloadBureauReportsExport(token).catch((err) => {
                  setFetchError(err instanceof Error ? err.message : 'Failed to download bureau reports');
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
