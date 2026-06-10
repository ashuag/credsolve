'use client';

import { getApplications, getMasters, type LosApplication } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

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
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.trim().slice(0, 2).toUpperCase();
}

const AVATAR_COLORS: [string, string][] = [
  ['#1496f3', '#0e7cd1'],
  ['#6366f1', '#4f46e5'],
  ['#0d9488', '#0f766e'],
  ['#f59e0b', '#d97706'],
  ['#8b5cf6', '#7c3aed'],
  ['#ec4899', '#db2777'],
];
function avatarColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

function StatusPill({ label, code }: { label: string; code?: string }) {
  const s = (code ?? label).toUpperCase();
  const isRejected = s.includes('REJECT') || s.includes('FAIL') || s.includes('CANCEL');
  const isApproved = s.includes('APPROV') || s.includes('DISB') || s.includes('ACTIVE') || s.includes('COMPLETE');
  const isPending  = s.includes('PEND') || s.includes('REVIEW') || s.includes('PROCESS') || s.includes('PROGRESS');
  const style = isRejected
    ? { background: 'rgba(239,68,68,0.1)',   color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)'   }
    : isApproved
    ? { background: 'rgba(16,185,129,0.1)',  color: '#10b981', border: '1px solid rgba(16,185,129,0.2)'  }
    : isPending
    ? { background: 'rgba(245,158,11,0.1)',  color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)'  }
    : { background: 'rgba(99,102,241,0.1)',  color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)'  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap" style={style}>
      {label}
    </span>
  );
}

function CibilBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-brand-muted">—</span>;
  const style = score >= 750
    ? { background: 'rgba(16,185,129,0.1)',  color: '#10b981' }
    : score >= 650
    ? { background: 'rgba(245,158,11,0.1)',  color: '#f59e0b' }
    : { background: 'rgba(239,68,68,0.1)',   color: '#ef4444' };
  return (
    <span className="inline-flex items-center justify-center min-w-[46px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold" style={style}>
      {score}
    </span>
  );
}

const COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'applicant',       label: 'Applicant'        },
  { key: 'mobile',          label: 'Mobile'           },
  { key: 'cibil',           label: 'CIBIL'            },
  { key: 'eligible-loan',   label: 'Eligible'         },
  { key: 'selected-loan',   label: 'Selected'         },
  { key: 'repay-date',      label: 'Repay date'       },
  { key: 'repayment',       label: 'Repayment'        },
  { key: 'emi',             label: 'EMI'              },
  { key: 'processing-fees', label: 'Fees'             },
  { key: 'status',          label: 'Status'           },
];

const PAGE_SIZE = 20;
type ColFilters = Partial<Record<(typeof COLUMNS)[number]['key'], string>>;

function getAppText(app: LosApplication, key: string): string {
  switch (key) {
    case 'applicant':       return app.fullName?.trim() || 'Details pending';
    case 'mobile':          return app.mobileNumber;
    case 'cibil':           return app.cibilScore != null ? String(app.cibilScore) : '';
    case 'eligible-loan':   return app.eligibleLoanAmount ?? '';
    case 'selected-loan':   return app.selectedLoanAmount ?? '';
    case 'repay-date':      return formatDate(app.repayDate);
    case 'repayment':       return app.repaymentAmount ?? '';
    case 'emi':             return app.emi ?? '';
    case 'processing-fees': return [app.processingFeeAmount, app.processingFeePercent].filter(Boolean).join(' ');
    case 'status':          return `${app.statusCode} ${app.statusLabel}`;
    default:                return '';
  }
}

function appMatchesFilters(app: LosApplication, filters: ColFilters, search: string): boolean {
  if (search) {
    const q = search.toLowerCase();
    const txt = [app.fullName, app.mobileNumber, app.email, app.bankDetails].filter(Boolean).join(' ').toLowerCase();
    if (!txt.includes(q)) return false;
  }
  for (const col of COLUMNS) {
    const raw = filters[col.key]?.trim() ?? '';
    if (!raw) continue;
    if (col.key === 'status') { if (app.statusCode !== raw) return false; continue; }
    if (!getAppText(app, col.key).toLowerCase().includes(raw.toLowerCase())) return false;
  }
  return true;
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
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage,  setCurrentPage]  = useState(1);
  const [statuses,     setStatuses]     = useState<Array<{ code: string; displayName: string }>>([]);

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
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  const colFilters: ColFilters = {};
  if (statusFilter) colFilters['status'] = statusFilter;

  const filtered   = applications.filter((a) => appMatchesFilters(a, colFilters, search));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const pageStart  = (safePage - 1) * PAGE_SIZE;
  const paginated  = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeEnd   = Math.min(pageStart + PAGE_SIZE, filtered.length);

  // Stats
  const withLoan     = applications.filter((a) => a.selectedLoanAmount != null).length;
  const totalDisbursed = applications.reduce((sum, a) => sum + (Number(a.selectedLoanAmount) || 0), 0);
  const highCibil    = applications.filter((a) => (a.cibilScore ?? 0) >= 700).length;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      {!loading && !fetchError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Applications" value={applications.length}        color="#6366f1" />
          <StatCard label="With Loan Amount"   value={withLoan}                   color="#1496f3" sub={`of ${applications.length}`} />
          <StatCard label="Portfolio Value"    value={shortINR(String(totalDisbursed))} color="#10b981" sub="selected amount" />
          <StatCard label="CIBIL ≥ 700"        value={highCibil}                  color="#f59e0b" sub="high quality" />
        </div>
      )}

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-[14px] border border-[rgba(23,44,113,0.1)] overflow-hidden"
        style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.94))' }}
      >
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[rgba(23,44,113,0.07)]">
          <div className="flex-1 min-w-[180px]">
            <input
              type="search"
              placeholder="Search name, mobile, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="los-input h-[36px] text-[0.84rem]"
            />
          </div>
          <select
            className="los-input h-[36px] w-auto min-w-[160px] text-[0.84rem]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.code} value={s.code}>{s.displayName}</option>)}
          </select>
          <button
            type="button" onClick={loadApplications}
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
              <table className="w-full border-collapse text-[0.84rem]">
                <thead>
                  <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)]">
                    {['Applicant','Mobile','CIBIL','Eligible','Selected','Repay Date','Repayment','EMI','Fees','Status'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-brand-muted text-[0.86rem]">
                        {search || statusFilter ? 'No applications match your filters.' : 'No applications available right now.'}
                      </td>
                    </tr>
                  ) : paginated.map((app, idx) => {
                    const name  = app.fullName?.trim() || 'Details pending';
                    const inits = getInitials(app.fullName);
                    const [c1, c2] = avatarColor(name);
                    return (
                      <tr
                        key={app.uuid}
                        className={`border-b transition-colors hover:bg-[rgba(20,150,243,0.025)] ${idx === paginated.length - 1 ? 'border-b-0' : 'border-[rgba(23,44,113,0.05)]'}`}
                      >
                        {/* Applicant */}
                        <td className="px-4 py-2.5">
                          <Link href={`/applications/${app.uuid}`} className="flex items-center gap-2.5 no-underline group">
                            <span
                              className="flex-shrink-0 grid place-items-center w-8 h-8 rounded-[9px] text-white text-[0.7rem] font-extrabold"
                              style={{ background: `linear-gradient(135deg,${c1},${c2})` }}
                            >
                              {inits}
                            </span>
                            <span className="flex flex-col min-w-0">
                              <span className="text-brand-blue font-semibold text-[0.84rem] group-hover:underline whitespace-nowrap">{name}</span>
                              {app.email && <span className="text-brand-muted text-[0.72rem] truncate max-w-[160px]">{app.email}</span>}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{app.mobileNumber}</td>
                        <td className="px-4 py-2.5"><CibilBadge score={app.cibilScore} /></td>
                        <td className="px-4 py-2.5 text-brand-text whitespace-nowrap font-semibold">{formatINR(app.eligibleLoanAmount)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {app.selectedLoanAmount ? (
                            <span className="font-extrabold text-brand-navy">{formatINR(app.selectedLoanAmount)}</span>
                          ) : <span className="text-brand-muted">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-brand-muted whitespace-nowrap text-[0.82rem]">{formatDate(app.repayDate)}</td>
                        <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{formatINR(app.repaymentAmount)}</td>
                        <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{formatINR(app.emi)}</td>
                        <td className="px-4 py-2.5 text-brand-muted whitespace-nowrap text-[0.82rem]">
                          {app.processingFeeAmount
                            ? <span>{formatINR(app.processingFeeAmount)}{app.processingFeePercent ? ` (${app.processingFeePercent}%)` : ''}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill label={app.statusLabel} code={app.statusCode} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage} total={totalPages}
              start={rangeStart} end={rangeEnd} count={filtered.length}
              onPrev={() => setCurrentPage(Math.max(1, safePage - 1))}
              onNext={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}
