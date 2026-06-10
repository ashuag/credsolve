'use client';

import { getNewLeads, type LosLead } from '@/lib/api';
import { getMasters } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function sourceLabel(lead: LosLead) {
  if (lead.sourceName) return lead.sourceType ? `${lead.sourceName} · ${lead.sourceType}` : lead.sourceName;
  if (lead.utmSource) return lead.utmMedium ? `${lead.utmSource} · ${lead.utmMedium}` : lead.utmSource;
  return 'Unattributed';
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.trim().slice(0, 2).toUpperCase();
}

const AVATAR_COLORS: [string, string][] = [
  ['#1496f3','#0e7cd1'],['#6366f1','#4f46e5'],['#0d9488','#0f766e'],
  ['#f59e0b','#d97706'],['#8b5cf6','#7c3aed'],['#ec4899','#db2777'],
];
function avatarColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

function StatusPill({ label, code }: { label: string; code?: string }) {
  const s = (code ?? label).toUpperCase();
  const isRejected = s.includes('REJECT') || s.includes('FAIL') || s.includes('DENI');
  const isApproved = s.includes('APPROV') || s.includes('DISB') || s.includes('ACTIVE');
  const isPending  = s.includes('PEND') || s.includes('REVIEW') || s.includes('PROGRESS');
  const style = isRejected
    ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }
    : isApproved
    ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
    : isPending
    ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }
    : { background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap" style={style}>
      {label}
    </span>
  );
}

function PanPill({ lead }: { lead: LosLead }) {
  const verified = lead.panVerified === 1;
  const failed   = lead.panVerified === 2;
  const style = verified
    ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
    : failed
    ? { background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.18)' }
    : { background: 'rgba(100,116,139,0.08)', color: '#64748b', border: '1px solid rgba(100,116,139,0.16)' };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap" style={style}>
      {lead.panVerifiedLabel}
    </span>
  );
}

const LEAD_TABLE_COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'customer',         label: 'Customer'        },
  { key: 'pan-number',       label: 'PAN'             },
  { key: 'mobile',           label: 'Mobile'          },
  { key: 'occupation',       label: 'Occupation'      },
  { key: 'city',             label: 'City'            },
  { key: 'cibil',            label: 'CIBIL'           },
  { key: 'pan-verified',     label: 'PAN'             },
  { key: 'status',           label: 'Status'          },
  { key: 'rejection-reason', label: 'Rejection'       },
  { key: 'source',           label: 'Source'          },
  { key: 'created',          label: 'Date'            },
];

const LEADS_PAGE_SIZE = 20;
type ColumnFilters = Partial<Record<(typeof LEAD_TABLE_COLUMNS)[number]['key'], string>>;

function getLeadText(lead: LosLead, key: string): string {
  switch (key) {
    case 'customer':         return lead.fullName?.trim() || '';
    case 'pan-number':       return lead.panNumber ?? '';
    case 'mobile':           return lead.mobileNumber;
    case 'occupation':       return lead.occupation ?? '';
    case 'city':             return lead.city ?? '';
    case 'cibil':            return lead.cibilScore != null ? String(lead.cibilScore) : '';
    case 'pan-verified':     return lead.panVerifiedLabel;
    case 'status':           return `${lead.statusCode} ${lead.statusLabel}`;
    case 'rejection-reason': return lead.rejectionReason ? `${lead.rejectionReason.code} ${lead.rejectionReason.label}` : '';
    case 'lead-status-note': return lead.leadStatusNote ?? '';
    case 'source':           return sourceLabel(lead);
    case 'campaign':         return lead.utmCampaign ?? '';
    case 'created':          return formatDateTime(lead.createdAt);
    default:                 return '';
  }
}

function leadMatchesFilters(lead: LosLead, filters: ColumnFilters, search: string): boolean {
  if (search) {
    const q = search.toLowerCase();
    const fullText = [lead.fullName, lead.mobileNumber, lead.panNumber, lead.city, lead.occupation]
      .filter(Boolean).join(' ').toLowerCase();
    if (!fullText.includes(q)) return false;
  }
  for (const col of LEAD_TABLE_COLUMNS) {
    const raw = filters[col.key]?.trim() ?? '';
    if (!raw) continue;
    if (col.key === 'status')           { if (lead.statusCode !== raw) return false; continue; }
    if (col.key === 'pan-verified')     { if (String(lead.panVerified) !== raw) return false; continue; }
    if (col.key === 'rejection-reason') { if ((lead.rejectionReason?.code ?? '') !== raw) return false; continue; }
    if (!getLeadText(lead, col.key).toLowerCase().includes(raw.toLowerCase())) return false;
  }
  return true;
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 rounded-[14px] border"
      style={{ background: `${color}09`, borderColor: `${color}22` }}
    >
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
        {count === 0 ? 'No leads found' : `${start}–${end} of ${count} leads`}
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

export function LeadsPanel() {
  const [leads,            setLeads]            = useState<LosLead[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [fetchError,       setFetchError]       = useState<string | null>(null);
  const [search,           setSearch]           = useState('');
  const [statusFilter,     setStatusFilter]     = useState('');
  const [panFilter,        setPanFilter]        = useState('');
  const [currentPage,      setCurrentPage]      = useState(1);
  const [statuses,         setStatuses]         = useState<Array<{ code: string; displayName: string }>>([]);
  const [rejectionReasons, setRejectionReasons] = useState<Array<{ code: string; label: string }>>([]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) { setFetchError('Session expired — please log in again.'); setLoading(false); return; }
    try {
      const [leadsRes, masters] = await Promise.all([getNewLeads(token), getMasters(token)]);
      setLeads(leadsRes);
      setStatuses(masters.leadStatuses.filter((s) => s.isActive).map((s) => ({ code: s.code, displayName: s.displayName })));
      setRejectionReasons((masters.rejectionReasons ?? []).filter((r) => r.isActive).map((r) => ({ code: r.name, label: r.name.replace(/_/g, ' ') })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, panFilter]);

  const colFilters: ColumnFilters = {};
  if (statusFilter) colFilters['status']       = statusFilter;
  if (panFilter)    colFilters['pan-verified']  = panFilter;

  const filtered    = leads.filter((l) => leadMatchesFilters(l, colFilters, search));
  const totalPages  = Math.max(1, Math.ceil(filtered.length / LEADS_PAGE_SIZE));
  const safePage    = Math.min(currentPage, totalPages);
  const pageStart   = (safePage - 1) * LEADS_PAGE_SIZE;
  const paginated   = filtered.slice(pageStart, pageStart + LEADS_PAGE_SIZE);
  const rangeStart  = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeEnd    = Math.min(pageStart + LEADS_PAGE_SIZE, filtered.length);

  // Stat counts
  const verified    = leads.filter((l) => l.panVerified === 1).length;
  const highCibil   = leads.filter((l) => (l.cibilScore ?? 0) >= 700).length;
  const todayLeads  = leads.filter((l) => {
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      {!loading && !fetchError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Leads"    value={leads.length}  color="#1496f3" />
          <StatCard label="Today"          value={todayLeads}    color="#6366f1" sub="new today" />
          <StatCard label="PAN Verified"   value={verified}      color="#10b981" sub={`of ${leads.length}`} />
          <StatCard label="CIBIL ≥ 700"    value={highCibil}     color="#f59e0b" sub="high quality" />
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
              placeholder="Search name, mobile, PAN, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="los-input h-[36px] text-[0.84rem]"
            />
          </div>
          <select
            className="los-input h-[36px] w-auto min-w-[140px] text-[0.84rem]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.code} value={s.code}>{s.displayName}</option>)}
          </select>
          <select
            className="los-input h-[36px] w-auto min-w-[140px] text-[0.84rem]"
            value={panFilter}
            onChange={(e) => setPanFilter(e.target.value)}
          >
            <option value="">All PAN status</option>
            <option value="0">Not checked</option>
            <option value="1">Verified</option>
            <option value="2">Not verified</option>
            <option value="3">API failure</option>
          </select>
          <button
            type="button"
            onClick={loadLeads}
            className="h-[36px] px-4 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent text-[0.84rem] font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors whitespace-nowrap"
          >
            ↺ Refresh
          </button>
        </div>

        {fetchError ? (
          <div className="p-8 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-10 text-center text-brand-muted text-[0.88rem]">
            <span className="inline-block animate-pulse">Loading leads…</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.84rem]">
                <thead>
                  <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)]">
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Customer</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">PAN</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Mobile</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Occupation</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">City</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">CIBIL</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">PAN</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Source</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-brand-muted text-[0.86rem]">
                        {search || statusFilter || panFilter ? 'No leads match your filters.' : 'No leads available right now.'}
                      </td>
                    </tr>
                  ) : paginated.map((lead, idx) => {
                    const name  = lead.fullName?.trim() || '—';
                    const inits = getInitials(lead.fullName);
                    const [c1, c2] = avatarColor(name);
                    return (
                      <tr
                        key={lead.uuid}
                        className={`border-b transition-colors hover:bg-[rgba(20,150,243,0.025)] ${idx === paginated.length - 1 ? 'border-b-0' : 'border-[rgba(23,44,113,0.05)]'}`}
                      >
                        {/* Customer */}
                        <td className="px-4 py-2.5">
                          <Link href={`/leads/${lead.uuid}`} className="flex items-center gap-2.5 no-underline group">
                            <span
                              className="flex-shrink-0 grid place-items-center w-8 h-8 rounded-[9px] text-white text-[0.7rem] font-extrabold"
                              style={{ background: `linear-gradient(135deg,${c1},${c2})` }}
                            >
                              {inits}
                            </span>
                            <span className="text-brand-blue font-semibold text-[0.84rem] group-hover:underline whitespace-nowrap">{name}</span>
                          </Link>
                        </td>
                        {/* PAN number */}
                        <td className="px-4 py-2.5 font-mono text-[0.82rem] text-brand-text whitespace-nowrap tracking-wide">
                          {lead.panNumber ?? '—'}
                        </td>
                        {/* Mobile */}
                        <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{lead.mobileNumber}</td>
                        {/* Occupation */}
                        <td className="px-4 py-2.5 text-brand-muted whitespace-nowrap text-[0.82rem]">{lead.occupation ?? '—'}</td>
                        {/* City */}
                        <td className="px-4 py-2.5 text-brand-muted text-[0.82rem]">
                          <span className="block min-w-[100px]">{lead.city ?? '—'}</span>
                        </td>
                        {/* CIBIL */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {lead.cibilScore != null ? (
                            <span
                              className="inline-flex items-center justify-center min-w-[46px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold"
                              style={
                                lead.cibilScore >= 750
                                  ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' }
                                  : lead.cibilScore >= 650
                                  ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
                                  : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
                              }
                            >
                              {lead.cibilScore}
                            </span>
                          ) : <span className="text-brand-muted">—</span>}
                        </td>
                        {/* PAN verified */}
                        <td className="px-4 py-2.5"><PanPill lead={lead} /></td>
                        {/* Status */}
                        <td className="px-4 py-2.5">
                          <StatusPill label={lead.statusLabel} code={lead.statusCode} />
                        </td>
                        {/* Source */}
                        <td className="px-4 py-2.5 text-brand-muted text-[0.8rem]">
                          <span className="block min-w-[120px]">{sourceLabel(lead)}</span>
                        </td>
                        {/* Date */}
                        <td className="px-4 py-2.5 text-brand-muted text-[0.78rem] whitespace-nowrap">
                          {formatDateTime(lead.createdAt)}
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
