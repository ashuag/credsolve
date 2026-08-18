'use client';

import {
  DataTable,
  isoDateTimestamp,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { getApplications, getApplicationsExportUrl, getMasters, type LosApplication } from '@/lib/api';
import { formatCibilScoreLabel, isDisplayedNtcCibilScore } from '@/lib/application-review-format';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { APPLICATION_JOURNEY_STAGE_FILTER_OPTIONS } from '@/lib/constants/application-journey-stages';
import { resolveApplicationStageLabel } from '@/lib/customer-journey';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOS_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch { return null; }
}

function formatINR(value: string | null | undefined) {
  if (!value) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function shortINR(value: string | null | undefined) {
  if (!value) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
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

function isApplicationRowRejected(app: LosApplication): boolean {
  return (
    app.leadStatusCode.toUpperCase().includes('REJECT') ||
    app.statusCode.toUpperCase().includes('REJECT') ||
    app.statusCode.toUpperCase().includes('FAIL')
  );
}

function applicationRowStatus(app: LosApplication): { label: string; code: string } {
  if (app.leadStatusCode.toUpperCase().includes('REJECT')) {
    return { label: app.leadStatusLabel, code: app.leadStatusCode };
  }
  return { label: app.statusLabel, code: app.statusCode };
}

function StatusPill({ label, code }: { label: string; code?: string }) {
  const s = (code ?? label).toUpperCase();
  const isRejected = s.includes('REJECT') || s.includes('FAIL') || s.includes('CANCEL');
  const isApproved = s.includes('APPROV') || s.includes('DISB') || s.includes('ACTIVE') || s.includes('COMPLETE');
  const isPending = s.includes('PEND') || s.includes('REVIEW') || s.includes('PROCESS') || s.includes('PROGRESS') || s === 'DRAFT';
  const style = isRejected
    ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
    : isApproved
      ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
      : isPending
        ? { background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }
        : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap" style={style}>
      {label}
    </span>
  );
}

function CibilBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-brand-muted">—</span>;
  if (isDisplayedNtcCibilScore(score)) {
    return (
      <span
        className="inline-flex items-center justify-center min-w-[46px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold"
        style={{ background: 'rgba(99,102,241,0.12)', color: '#4f46e5' }}
      >
        {formatCibilScoreLabel(score)}
      </span>
    );
  }
  const style =
    score >= 750
      ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' }
      : score >= 650
        ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
        : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' };
  return (
    <span className="inline-flex items-center justify-center min-w-[46px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold" style={style}>
      {score}
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

function GradeBadge({ category }: { category: string | null | undefined }) {
  if (!category) return <span className="text-brand-muted">—</span>;
  const style = GRADE_TONE[category] ?? { background: 'rgba(99,102,241,0.12)', color: '#4f46e5' };
  return (
    <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold" style={style}>
      {category}
    </span>
  );
}

function applicationStageLabel(app: LosApplication): string {
  return resolveApplicationStageLabel({
    statusCode: app.statusCode,
    statusLabel: app.statusLabel,
    kycStatus: app.kycStatus,
    kycStatusLabel: app.kycStatusLabel,
    kycCompletedAt: app.kycCompletedAt,
    emailVerifiedAt: app.emailVerifiedAt,
    loanDocumentsReviewedAt: app.loanDocumentsReviewedAt,
    loanDocumentsAcceptedAt: app.loanDocumentsAcceptedAt,
    livenessPassed: app.livenessPassed,
    selectedLoanAmount: app.selectedLoanAmount,
    referencesCount: app.referencesCount,
    bankAccountNumber: app.bankAccountNumber,
    disbursedAt: app.disbursedAt,
    fullName: app.fullName,
    leadStatusCode: app.leadStatusCode,
    leadStatusLabel: app.leadStatusLabel,
    panVerified: app.panVerified,
    bureauFetched: app.bureauFetched,
  });
}

function StageCell({ app }: { app: LosApplication }) {
  const label = applicationStageLabel(app);
  const rejected =
    app.leadStatusCode.toUpperCase().includes('REJECT') ||
    app.statusCode.toUpperCase().includes('REJECT') ||
    app.statusCode.toUpperCase() === 'KYC_FAILED';
  const style = rejected
    ? { background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }
    : { background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' };

  return (
    <span
      className="inline-flex items-center max-w-[140px] rounded-full px-2 py-0.5 text-[0.72rem] font-bold leading-tight"
      style={style}
      title={label}
    >
      {label}
    </span>
  );
}

function RejectionReasonCell({ app }: { app: LosApplication }) {
  const label = app.leadRejectionReason?.label?.trim();
  if (!label) {
    return <span className="text-brand-muted">—</span>;
  }

  return (
    <p
      className="m-0 min-w-[140px] max-w-[220px] text-[0.72rem] font-extrabold uppercase tracking-[0.04em] text-[#991b1b] line-clamp-2"
      title={label}
    >
      {label}
    </p>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-[14px] border" style={{ background: `${color}09`, borderColor: `${color}22` }}>
      <span className="text-[0.68rem] font-extrabold tracking-[0.14em] uppercase" style={{ color: `${color}cc` }}>{label}</span>
      <span className="text-[1.6rem] font-extrabold leading-none tracking-tight" style={{ color }}>{value}</span>
      {sub && <span className="text-[0.72rem] text-brand-muted">{sub}</span>}
    </div>
  );
}

export function ApplicationsPanel() {
  const [applications, setApplications] = useState<LosApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Array<{ code: string; displayName: string }>>([]);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) { setFetchError('Session expired — please log in again.'); setLoading(false); return; }
    try {
      const [appsRes, masters] = await Promise.all([getApplications(token), getMasters(token)]);
      setApplications(appsRes);
      setStatuses(masters.applicationStatuses.filter((s) => s.isActive).map((s) => ({ code: s.code, displayName: s.displayName })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  const columns = useMemo((): DataTableColumn<LosApplication>[] => [
    {
      key: 'app-id',
      label: 'Application ID',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.applicationNumber?.trim() ?? '',
      getSortValue: (row) => (row.applicationNumber ?? '').toUpperCase(),
      filter: { type: 'text', placeholder: 'Search…' },
      render: (app) => (
        <Link
          href={`/applications/${app.uuid}`}
          className="font-mono text-[0.82rem] font-semibold text-brand-blue no-underline hover:underline whitespace-nowrap"
          title={app.applicationNumber}
        >
          {app.applicationNumber}
        </Link>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      headerClassName: 'min-w-[140px]',
      getFilterValue: (row) => row.fullName?.trim() || 'Details pending',
      getSortValue: (row) => (row.fullName?.trim() || 'Details pending').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (app) => {
        const name = formatPersonName(app.fullName, 'Details pending');
        return (
          <Link href={`/applications/${app.uuid}`} className="font-semibold text-brand-navy no-underline hover:underline whitespace-nowrap">
            {name}
          </Link>
        );
      },
    },
    {
      key: 'mobile',
      label: 'Mobile',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.mobileNumber,
      filter: { type: 'text', placeholder: 'Search mobile…' },
      cellClassName: 'font-mono text-[0.82rem] text-brand-text whitespace-nowrap',
      render: (app) => app.mobileNumber,
    },
    {
      key: 'email',
      label: 'Email',
      headerClassName: 'min-w-[160px]',
      getFilterValue: (row) => row.email ?? '',
      getSortValue: (row) => (row.email ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search email…' },
      cellClassName: 'text-brand-muted text-[0.82rem]',
      render: (app) => (
        <span className="block max-w-[180px] truncate" title={app.email ?? undefined}>{app.email ?? '—'}</span>
      ),
    },
    {
      key: 'cibil',
      label: 'CIBIL score',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.cibilScore,
      getSortValue: (row) => row.cibilScore,
      filter: { type: 'number', placeholder: 'Score…' },
      render: (app) => <CibilBadge score={app.cibilScore} />,
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
      render: (app) => <GradeBadge category={app.cibilCreditAssessmentCategory} />,
    },
    {
      key: 'loan',
      label: 'Loan amount',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.selectedLoanAmount ?? '',
      getSortValue: (row) => {
        const n = Number(row.selectedLoanAmount);
        return Number.isFinite(n) ? n : null;
      },
      filter: { type: 'number', placeholder: 'Amount…' },
      cellClassName: 'font-extrabold text-brand-navy whitespace-nowrap',
      render: (app) => formatINR(app.selectedLoanAmount),
    },
    {
      key: 'stage',
      label: 'Stage',
      headerClassName: 'min-w-[120px]',
      getFilterValue: (row) => applicationStageLabel(row),
      getSortValue: (row) => applicationStageLabel(row).toLowerCase(),
      filter: {
        type: 'select',
        options: [...APPLICATION_JOURNEY_STAGE_FILTER_OPTIONS],
        matches: (row, value) => applicationStageLabel(row) === value,
      },
      render: (app) => <StageCell app={app} />,
    },
    {
      key: 'status',
      label: 'Status',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => applicationRowStatus(row).code,
      getSortValue: (row) => applicationRowStatus(row).label.toLowerCase(),
      filter: {
        type: 'select',
        options: statuses.map((s) => ({ value: s.code, label: s.displayName })),
        matches: (row, value) => {
          const status = applicationRowStatus(row);
          if (value === 'REJECTED') {
            return status.code.toUpperCase().includes('REJECT');
          }
          return status.code === value;
        },
      },
      render: (app) => {
        const status = applicationRowStatus(app);
        return <StatusPill label={status.label} code={status.code} />;
      },
    },
    {
      key: 'reason',
      label: 'Rejection reason',
      headerClassName: 'min-w-[160px]',
      getFilterValue: (row) => row.leadRejectionReason?.label ?? '',
      getSortValue: (row) => (row.leadRejectionReason?.label ?? '').toLowerCase(),
      filter: {
        type: 'text',
        placeholder: 'Search reason…',
        matches: (row, value) => {
          const reasonText = [row.leadRejectionReason?.code, row.leadRejectionReason?.label]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return reasonText.includes(value.toLowerCase());
        },
      },
      render: (app) => <RejectionReasonCell app={app} />,
    },
    {
      key: 'created',
      label: 'Created',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.createdAt,
      getSortValue: (row) => isoDateTimestamp(row.createdAt),
      filter: { type: 'date' },
      cellClassName: 'text-brand-muted whitespace-nowrap text-[0.78rem]',
      render: (app) => formatDateTime(app.createdAt),
    },
    {
      key: 'modified',
      label: 'Last modified',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.updatedAt,
      getSortValue: (row) => isoDateTimestamp(row.updatedAt),
      filter: { type: 'date' },
      cellClassName: 'text-brand-muted whitespace-nowrap text-[0.78rem]',
      render: (app) => formatDateTime(app.updatedAt),
    },
  ], [statuses]);

  const withLoan = applications.filter((a) => a.selectedLoanAmount != null).length;
  const totalDisbursed = applications.reduce((sum, a) => sum + (Number(a.selectedLoanAmount) || 0), 0);
  const highCibil = applications.filter((a) => (a.cibilScore ?? 0) >= 700).length;

  return (
    <div className="flex flex-col gap-4">
      {!loading && !fetchError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Applications" value={applications.length} color="#6366f1" />
          <StatCard label="With Loan Amount" value={withLoan} color="#1496f3" sub={`of ${applications.length}`} />
          <StatCard label="Portfolio Value" value={shortINR(String(totalDisbursed))} color="#10b981" sub="selected amount" />
          <StatCard label="CIBIL ≥ 700" value={highCibil} color="#f59e0b" sub="high quality" />
        </div>
      )}

      <DataTable
        items={applications}
        columns={columns}
        getRowKey={(app) => app.uuid}
        entityLabel="applications"
        loading={loading}
        error={fetchError}
        onRetry={() => void loadApplications()}
        emptyMessage="No applications available right now."
        noResultsMessage="No applications match your filters or sort."
        minWidth="1280px"
        renderRowClassName={(app) =>
          isApplicationRowRejected(app)
            ? 'border-l-[3px] border-l-[#ef4444] bg-[rgba(254,242,242,0.55)] hover:bg-[rgba(254,226,226,0.65)]'
            : undefined
        }
        toolbarActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const token = getToken();
                if (!token) {
                  setFetchError('Session expired — please log in again.');
                  return;
                }
                const link = document.createElement('a');
                link.href = getApplicationsExportUrl(token);
                link.rel = 'noopener';
                document.body.appendChild(link);
                link.click();
                link.remove();
              }}
              className="h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)]"
            >
              ⬇ Download dump
            </button>
            <button
              type="button"
              onClick={() => void loadApplications()}
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
