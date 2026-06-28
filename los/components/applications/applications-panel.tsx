'use client';

import { getApplications, getMasters, type LosApplication } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

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

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
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

function KycStatusCell({ app }: { app: LosApplication }) {
  if (app.kycCompleted) {
    return (
      <span className="inline-flex items-center rounded-full border border-[rgba(16,185,129,0.25)] bg-[rgba(16,185,129,0.1)] px-2 py-0.5 text-[0.72rem] font-bold text-[#059669]">
        Completed
      </span>
    );
  }
  if (app.kycStatus === 2) {
    return (
      <span className="inline-flex items-center rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.1)] px-2 py-0.5 text-[0.72rem] font-bold text-[#dc2626]">
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[rgba(100,116,139,0.2)] bg-[rgba(100,116,139,0.08)] px-2 py-0.5 text-[0.72rem] font-bold text-brand-muted">
      Not completed
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

const TABLE_HEADERS = [
  { key: 'name', label: 'Name', className: 'min-w-[140px]' },
  { key: 'mobile', label: 'Mobile', className: 'whitespace-nowrap' },
  { key: 'email', label: 'Email', className: 'min-w-[160px]' },
  { key: 'cibil', label: 'CIBIL score', className: 'whitespace-nowrap' },
  { key: 'loan', label: 'Loan amount', className: 'whitespace-nowrap' },
  { key: 'repay-date', label: 'Repayment date', className: 'whitespace-nowrap' },
  { key: 'repayment', label: 'Repayment amount', className: 'whitespace-nowrap' },
  { key: 'kyc', label: 'KYC', className: 'whitespace-nowrap' },
  { key: 'created', label: 'Created', className: 'whitespace-nowrap' },
  { key: 'modified', label: 'Last modified', className: 'whitespace-nowrap' },
  { key: 'status', label: 'Status', className: 'whitespace-nowrap' },
  { key: 'reason', label: 'Rejection reason', className: 'min-w-[160px]' },
] as const;

const COLUMNS: ReadonlyArray<{ key: string; label: string }> = TABLE_HEADERS.map((h) => ({
  key: h.key,
  label: h.label,
}));

const PAGE_SIZE = 20;
type ColFilters = Partial<Record<(typeof COLUMNS)[number]['key'], string>>;
type SortDir = 'asc' | 'desc';
type SortState = { key: (typeof TABLE_HEADERS)[number]['key']; dir: SortDir } | null;

const DATE_FILTER_KEYS = new Set(['repay-date', 'created', 'modified']);
const NUMERIC_FILTER_KEYS = new Set(['cibil', 'loan', 'repayment']);

function appDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function appDateTimestamp(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function getAppText(app: LosApplication, key: string): string {
  switch (key) {
    case 'name':
      return app.fullName?.trim() || 'Details pending';
    case 'mobile':
      return app.mobileNumber;
    case 'email':
      return app.email ?? '';
    case 'cibil':
      return app.cibilScore != null ? String(app.cibilScore) : '';
    case 'loan':
      return app.selectedLoanAmount ?? '';
    case 'repay-date':
      return formatDate(app.repayDate);
    case 'repayment':
      return app.repaymentAmount ?? '';
    case 'kyc':
      return app.kycCompleted ? 'Completed' : app.kycStatusLabel;
    case 'created':
      return formatDateTime(app.createdAt);
    case 'modified':
      return formatDateTime(app.updatedAt);
    case 'status':
      return `${app.statusCode} ${app.statusLabel} ${app.leadStatusCode} ${app.leadStatusLabel}`;
    case 'reason':
      return app.leadRejectionReason?.label ?? '';
    default:
      return '';
  }
}

function appMatchesFilters(app: LosApplication, filters: ColFilters): boolean {
  for (const col of COLUMNS) {
    const raw = filters[col.key]?.trim() ?? '';
    if (!raw) continue;
    if (col.key === 'status') {
      const status = applicationRowStatus(app);
      if (raw === 'REJECTED') {
        if (!status.code.toUpperCase().includes('REJECT')) return false;
      } else if (status.code !== raw) {
        return false;
      }
      continue;
    }
    if (col.key === 'kyc') {
      if (raw === 'completed' && !app.kycCompleted) return false;
      if (raw === 'failed' && app.kycStatus !== 2) return false;
      if (raw === 'not_completed' && (app.kycCompleted || app.kycStatus === 2)) return false;
      continue;
    }
    if (col.key === 'reason') {
      const reasonText = [app.leadRejectionReason?.code, app.leadRejectionReason?.label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!reasonText.includes(raw.toLowerCase())) return false;
      continue;
    }
    if (DATE_FILTER_KEYS.has(col.key)) {
      const iso =
        col.key === 'repay-date'
          ? app.repayDate
          : col.key === 'created'
            ? app.createdAt
            : app.updatedAt;
      if (appDateKey(iso) !== raw) return false;
      continue;
    }
    if (NUMERIC_FILTER_KEYS.has(col.key)) {
      const target = Number(raw);
      if (!Number.isFinite(target)) continue;
      const actual =
        col.key === 'cibil'
          ? app.cibilScore
          : col.key === 'loan'
            ? Number(app.selectedLoanAmount)
            : Number(app.repaymentAmount);
      if (actual == null || !Number.isFinite(actual) || actual !== target) return false;
      continue;
    }
    if (!getAppText(app, col.key).toLowerCase().includes(raw.toLowerCase())) return false;
  }
  return true;
}

function getAppSortValue(app: LosApplication, key: string): string | number | null {
  switch (key) {
    case 'name':
      return (app.fullName?.trim() || 'Details pending').toLowerCase();
    case 'mobile':
      return app.mobileNumber;
    case 'email':
      return (app.email ?? '').toLowerCase();
    case 'cibil':
      return app.cibilScore;
    case 'loan': {
      const n = Number(app.selectedLoanAmount);
      return Number.isFinite(n) ? n : null;
    }
    case 'repay-date':
      return appDateTimestamp(app.repayDate);
    case 'repayment': {
      const n = Number(app.repaymentAmount);
      return Number.isFinite(n) ? n : null;
    }
    case 'kyc':
      return app.kycCompleted ? 'Completed' : app.kycStatus === 2 ? 'Failed' : 'Not completed';
    case 'created':
      return appDateTimestamp(app.createdAt);
    case 'modified':
      return appDateTimestamp(app.updatedAt);
    case 'status':
      return applicationRowStatus(app).label.toLowerCase();
    case 'reason':
      return (app.leadRejectionReason?.label ?? '').toLowerCase();
    default:
      return null;
  }
}

function compareSortValues(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function sortApplications(apps: LosApplication[], sort: SortState): LosApplication[] {
  if (!sort) return apps;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...apps].sort((a, b) => compareSortValues(getAppSortValue(a, sort.key), getAppSortValue(b, sort.key)) * dir);
}

const FILTER_CONTROL_CLASS =
  'mt-1.5 w-full min-w-[72px] h-[28px] rounded-[6px] border border-[rgba(23,44,113,0.12)] bg-white px-1.5 text-[0.72rem] font-medium text-brand-text';

function ColumnFilterInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'select' | 'date' | 'number';
  options?: Array<{ value: string; label: string }>;
}) {
  if (type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FILTER_CONTROL_CLASS}>
        <option value="">All</option>
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'date') {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FILTER_CONTROL_CLASS}
        aria-label={placeholder ?? 'Filter by date'}
      />
    );
  }

  if (type === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Value…'}
        className={`${FILTER_CONTROL_CLASS} placeholder:text-brand-muted/70`}
      />
    );
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Search…'}
      className={`${FILTER_CONTROL_CLASS} placeholder:text-brand-muted/70`}
    />
  );
}

function ColumnHeader({
  label,
  sortKey,
  sort,
  onSort,
  children,
}: {
  label: string;
  sortKey: (typeof TABLE_HEADERS)[number]['key'];
  sort: SortState;
  onSort: (key: (typeof TABLE_HEADERS)[number]['key']) => void;
  children: ReactNode;
}) {
  const active = sort?.key === sortKey;
  const icon = !active ? '↕' : sort.dir === 'asc' ? '↑' : '↓';

  return (
    <>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex w-full items-center gap-1 border-0 bg-transparent p-0 text-left text-[0.68rem] font-extrabold tracking-[0.08em] uppercase cursor-pointer ${
          active ? 'text-brand-blue' : 'text-brand-muted hover:text-brand-text'
        }`}
        title={`Sort by ${label}`}
      >
        <span className="min-w-0 flex-1">{label}</span>
        <span className="shrink-0 text-[0.62rem] leading-none opacity-80">{icon}</span>
      </button>
      {children}
    </>
  );
}

function hasActiveColumnFilters(filters: ColFilters): boolean {
  return Object.values(filters).some((value) => value?.trim());
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

function Pagination({ page, total, start, end, count, onPrev, onNext }: {
  page: number; total: number; start: number; end: number; count: number;
  onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.6)]">
      <span className="text-[0.78rem] text-brand-muted">
        {count === 0 ? 'No applications found' : `${start}–${end} of ${count} applications`}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onPrev} disabled={page <= 1}
          className="min-h-[32px] px-3 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent text-[0.8rem] font-bold text-brand-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(20,150,243,0.05)] transition-colors">
          ← Prev
        </button>
        <span className="text-[0.78rem] font-bold text-brand-muted">{page} / {total}</span>
        <button type="button" onClick={onNext} disabled={page >= total}
          className="min-h-[32px] px-3 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent text-[0.8rem] font-bold text-brand-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(20,150,243,0.05)] transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}

export function ApplicationsPanel() {
  const [applications, setApplications] = useState<LosApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColFilters>({});
  const [sort, setSort] = useState<SortState>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statuses, setStatuses] = useState<Array<{ code: string; displayName: string }>>([]);

  const setColumnFilter = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => {
      if (!value.trim()) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearColumnFilters = useCallback(() => {
    setColumnFilters({});
  }, []);

  const toggleSort = useCallback((key: (typeof TABLE_HEADERS)[number]['key']) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }, []);

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

  useEffect(() => { loadApplications(); }, [loadApplications]);
  useEffect(() => { setCurrentPage(1); }, [columnFilters, sort]);

  const filtered = sortApplications(
    applications.filter((a) => appMatchesFilters(a, columnFilters)),
    sort,
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);

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

      <div
        className="rounded-[14px] border border-[rgba(23,44,113,0.1)] overflow-hidden"
        style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.94))' }}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[rgba(23,44,113,0.07)]">
          <p className="m-0 flex-1 min-w-[180px] text-[0.78rem] text-brand-muted">
            Click a column title to sort. Use the search boxes below each column to filter.
          </p>
          {hasActiveColumnFilters(columnFilters) || sort ? (
            <button
              type="button"
              onClick={clearColumnFilters}
              className="h-[36px] px-4 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent text-[0.84rem] font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors whitespace-nowrap"
            >
              Clear filters
            </button>
          ) : null}
          <button
            type="button"
            onClick={loadApplications}
            className="h-[36px] px-4 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent text-[0.84rem] font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors whitespace-nowrap"
          >
            ↺ Refresh
          </button>
        </div>

        {fetchError ? (
          <div className="p-8 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-10 text-center text-brand-muted text-[0.88rem]">
            <span className="inline-block animate-pulse">Loading applications…</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] border-collapse text-[0.84rem]">
                <thead>
                  <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)] text-left align-top">
                    {TABLE_HEADERS.map((header) => (
                      <th
                        key={header.key}
                        className={`px-3 py-2 align-top ${header.className}`}
                      >
                        <ColumnHeader
                          label={header.label}
                          sortKey={header.key}
                          sort={sort}
                          onSort={toggleSort}
                        >
                          {header.key === 'status' ? (
                            <ColumnFilterInput
                              type="select"
                              value={columnFilters.status ?? ''}
                              onChange={(value) => setColumnFilter('status', value)}
                              options={statuses.map((s) => ({ value: s.code, label: s.displayName }))}
                            />
                          ) : header.key === 'kyc' ? (
                            <ColumnFilterInput
                              type="select"
                              value={columnFilters.kyc ?? ''}
                              onChange={(value) => setColumnFilter('kyc', value)}
                              options={[
                                { value: 'completed', label: 'Completed' },
                                { value: 'not_completed', label: 'Not completed' },
                                { value: 'failed', label: 'Failed' },
                              ]}
                            />
                          ) : DATE_FILTER_KEYS.has(header.key) ? (
                            <ColumnFilterInput
                              type="date"
                              value={columnFilters[header.key] ?? ''}
                              onChange={(value) => setColumnFilter(header.key, value)}
                            />
                          ) : NUMERIC_FILTER_KEYS.has(header.key) ? (
                            <ColumnFilterInput
                              type="number"
                              value={columnFilters[header.key] ?? ''}
                              onChange={(value) => setColumnFilter(header.key, value)}
                              placeholder={
                                header.key === 'cibil'
                                  ? 'Score…'
                                  : 'Amount…'
                              }
                            />
                          ) : (
                            <ColumnFilterInput
                              value={columnFilters[header.key] ?? ''}
                              onChange={(value) => setColumnFilter(header.key, value)}
                              placeholder={
                                header.key === 'name'
                                  ? 'Search name…'
                                  : header.key === 'mobile'
                                    ? 'Search mobile…'
                                    : header.key === 'email'
                                      ? 'Search email…'
                                      : header.key === 'reason'
                                        ? 'Search reason…'
                                        : 'Search…'
                              }
                            />
                          )}
                        </ColumnHeader>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_HEADERS.length} className="px-4 py-12 text-center text-brand-muted text-[0.86rem]">
                        {hasActiveColumnFilters(columnFilters) || sort ? 'No applications match your filters or sort.' : 'No applications available right now.'}
                      </td>
                    </tr>
                  ) : paginated.map((app, idx) => {
                    const name = formatPersonName(app.fullName, 'Details pending');
                    const rejected = isApplicationRowRejected(app);
                    const status = applicationRowStatus(app);
                    return (
                      <tr
                        key={app.uuid}
                        className={`border-b align-middle transition-colors ${
                          rejected
                            ? 'border-l-[3px] border-l-[#ef4444] bg-[rgba(254,242,242,0.55)] hover:bg-[rgba(254,226,226,0.65)]'
                            : 'hover:bg-[rgba(20,150,243,0.025)]'
                        } ${idx === paginated.length - 1 ? 'border-b-0' : 'border-[rgba(23,44,113,0.05)]'}`}
                      >
                        <td className="px-3 py-2.5">
                          <Link href={`/applications/${app.uuid}`} className="font-semibold text-brand-blue no-underline hover:underline whitespace-nowrap">
                            {name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[0.82rem] text-brand-text whitespace-nowrap">{app.mobileNumber}</td>
                        <td className="px-3 py-2.5 text-brand-muted text-[0.82rem]">
                          <span className="block max-w-[180px] truncate" title={app.email ?? undefined}>{app.email ?? '—'}</span>
                        </td>
                        <td className="px-3 py-2.5"><CibilBadge score={app.cibilScore} /></td>
                        <td className="px-3 py-2.5 font-extrabold text-brand-navy whitespace-nowrap">{formatINR(app.selectedLoanAmount)}</td>
                        <td className="px-3 py-2.5 text-brand-muted whitespace-nowrap text-[0.82rem]">{formatDate(app.repayDate)}</td>
                        <td className="px-3 py-2.5 text-brand-text whitespace-nowrap">{formatINR(app.repaymentAmount)}</td>
                        <td className="px-3 py-2.5"><KycStatusCell app={app} /></td>
                        <td className="px-3 py-2.5 text-brand-muted whitespace-nowrap text-[0.78rem]">{formatDateTime(app.createdAt)}</td>
                        <td className="px-3 py-2.5 text-brand-muted whitespace-nowrap text-[0.78rem]">{formatDateTime(app.updatedAt)}</td>
                        <td className="px-3 py-2.5"><StatusPill label={status.label} code={status.code} /></td>
                        <td className="px-3 py-2.5"><RejectionReasonCell app={app} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage}
              total={totalPages}
              start={rangeStart}
              end={rangeEnd}
              count={filtered.length}
              onPrev={() => setCurrentPage(Math.max(1, safePage - 1))}
              onNext={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}
