'use client';

import {
  DataTable,
  isoDateTimestamp,
  LOS_LISTING_PAGE_SIZE,
  LOS_LISTING_PAGE_SIZE_OPTIONS,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { getNewLeads, getLeadsExportUrl, getMasters, type LosLead } from '@/lib/api';
import { formatCibilScoreLabel, isDisplayedNtcCibilScore } from '@/lib/application-review-format';
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

function RejectionReasonCell({ lead }: { lead: LosLead }) {
  const reason = lead.rejectionReason?.label?.trim() || null;
  const note = lead.leadStatusNote?.trim() || null;
  if (!reason && !note) {
    return <span className="text-brand-muted">—</span>;
  }

  const title = [reason, note].filter(Boolean).join(' — ');

  return (
    <div className="min-w-[140px] max-w-[240px]" title={title}>
      {reason ? (
        <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.04em] text-[#991b1b] line-clamp-2">
          {reason}
        </p>
      ) : null}
      {note ? (
        <p className={`m-0 text-[0.72rem] font-semibold leading-snug text-brand-muted line-clamp-2 ${reason ? 'mt-0.5' : ''}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

const PAN_VERIFIED_FILTER_OPTIONS = [
  { value: '0', label: 'Not checked' },
  { value: '1', label: 'Verified' },
  { value: '2', label: 'Not verified' },
  { value: '3', label: 'API failure' },
];

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

export function LeadsPanel() {
  const [leads,            setLeads]            = useState<LosLead[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [fetchError,       setFetchError]       = useState<string | null>(null);
  const [statuses,         setStatuses]         = useState<Array<{ code: string; displayName: string }>>([]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) { setFetchError('Session expired — please log in again.'); setLoading(false); return; }
    try {
      const [leadsRes, masters] = await Promise.all([getNewLeads(token), getMasters(token)]);
      setLeads(leadsRes);
      setStatuses(masters.leadStatuses.filter((s) => s.isActive).map((s) => ({ code: s.code, displayName: s.displayName })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const columns = useMemo((): DataTableColumn<LosLead>[] => [
    {
      key: 'customer',
      label: 'Customer',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.fullName?.trim() ?? '',
      getSortValue: (row) => (row.fullName?.trim() ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (lead) => {
        const name = formatPersonName(lead.fullName);
        const inits = getInitials(lead.fullName);
        const [c1, c2] = avatarColor(name);
        return (
          <Link href={`/leads/${lead.uuid}`} className="flex items-center gap-2.5 no-underline group">
            <span
              className="flex-shrink-0 grid place-items-center w-8 h-8 rounded-[9px] text-white text-[0.7rem] font-extrabold"
              style={{ background: `linear-gradient(135deg,${c1},${c2})` }}
            >
              {inits}
            </span>
            <span className="text-brand-blue font-semibold text-[0.84rem] group-hover:underline whitespace-nowrap">{name}</span>
          </Link>
        );
      },
    },
    {
      key: 'pan-number',
      label: 'PAN',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.panNumber ?? '',
      getSortValue: (row) => (row.panNumber ?? '').toUpperCase(),
      filter: { type: 'text', placeholder: 'Search PAN…' },
      cellClassName: 'font-mono text-[0.82rem] text-brand-text whitespace-nowrap tracking-wide',
      render: (lead) => lead.panNumber ?? '—',
    },
    {
      key: 'mobile',
      label: 'Mobile',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.mobileNumber,
      filter: { type: 'text', placeholder: 'Search mobile…' },
      cellClassName: 'text-brand-text whitespace-nowrap',
      render: (lead) => lead.mobileNumber,
    },
    {
      key: 'occupation',
      label: 'Occupation',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.occupation ?? '',
      getSortValue: (row) => (row.occupation ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search…' },
      cellClassName: 'text-brand-muted whitespace-nowrap text-[0.82rem]',
      render: (lead) => lead.occupation ?? '—',
    },
    {
      key: 'city',
      label: 'City',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.city ?? '',
      getSortValue: (row) => (row.city ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search city…' },
      cellClassName: 'text-brand-muted text-[0.82rem]',
      render: (lead) => <span className="block min-w-[100px]">{lead.city ?? '—'}</span>,
    },
    {
      key: 'cibil',
      label: 'CIBIL',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.cibilScore,
      getSortValue: (row) => row.cibilScore,
      filter: { type: 'number', placeholder: 'Score…' },
      cellClassName: 'whitespace-nowrap',
      render: (lead) =>
        lead.cibilScore != null ? (
          <span
            className="inline-flex items-center justify-center min-w-[46px] h-7 px-2 rounded-[7px] text-[0.8rem] font-extrabold"
            style={
              isDisplayedNtcCibilScore(lead.cibilScore)
                ? { background: 'rgba(99,102,241,0.12)', color: '#4f46e5' }
                : lead.cibilScore >= 750
                ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' }
                : lead.cibilScore >= 650
                ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
                : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
            }
          >
            {formatCibilScoreLabel(lead.cibilScore)}
          </span>
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      key: 'pan-verified',
      label: 'PAN',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => String(row.panVerified),
      getSortValue: (row) => row.panVerified,
      filter: {
        type: 'select',
        options: PAN_VERIFIED_FILTER_OPTIONS,
        matches: (row, value) => String(row.panVerified) === value,
      },
      render: (lead) => <PanPill lead={lead} />,
    },
    {
      key: 'status',
      label: 'Status',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.statusCode,
      getSortValue: (row) => row.statusLabel.toLowerCase(),
      filter: {
        type: 'select',
        options: statuses.map((s) => ({ value: s.code, label: s.displayName })),
        matches: (row, value) => row.statusCode === value,
      },
      render: (lead) => <StatusPill label={lead.statusLabel} code={lead.statusCode} />,
    },
    {
      key: 'reason',
      label: 'Rejection reason',
      headerClassName: 'min-w-[160px]',
      getFilterValue: (row) =>
        [row.rejectionReason?.label, row.leadStatusNote].filter(Boolean).join(' '),
      getSortValue: (row) =>
        (row.rejectionReason?.label ?? row.leadStatusNote ?? '').toLowerCase(),
      filter: {
        type: 'text',
        placeholder: 'Search reason…',
        matches: (row, value) => {
          const reasonText = [
            row.rejectionReason?.code,
            row.rejectionReason?.label,
            row.leadStatusNote,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return reasonText.includes(value.toLowerCase());
        },
      },
      render: (lead) => <RejectionReasonCell lead={lead} />,
    },
    {
      key: 'source',
      label: 'Source',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => sourceLabel(row),
      getSortValue: (row) => sourceLabel(row).toLowerCase(),
      filter: { type: 'text', placeholder: 'Search source…' },
      cellClassName: 'text-brand-muted text-[0.8rem]',
      render: (lead) => <span className="block min-w-[120px]">{sourceLabel(lead)}</span>,
    },
    {
      key: 'created',
      label: 'Date',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.createdAt,
      getSortValue: (row) => isoDateTimestamp(row.createdAt),
      filter: { type: 'date' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (lead) => formatDateTime(lead.createdAt),
    },
  ], [statuses]);

  const verified    = leads.filter((l) => l.panVerified === 1).length;
  const highCibil   = leads.filter((l) => (l.cibilScore ?? 0) >= 700).length;
  const todayLeads  = leads.filter((l) => {
    const d = new Date(l.createdAt);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="flex flex-col gap-4">
      {!loading && !fetchError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Leads"    value={leads.length}  color="#1496f3" />
          <StatCard label="Today"          value={todayLeads}    color="#6366f1" sub="new today" />
          <StatCard label="PAN Verified"   value={verified}      color="#10b981" sub={`of ${leads.length}`} />
          <StatCard label="CIBIL ≥ 700"    value={highCibil}     color="#f59e0b" sub="high quality" />
        </div>
      )}

      <DataTable
        items={leads}
        columns={columns}
        getRowKey={(lead) => lead.uuid}
        entityLabel="leads"
        loading={loading}
        error={fetchError}
        onRetry={() => void loadLeads()}
        emptyMessage="No leads available right now."
        noResultsMessage="No leads match your filters."
        minWidth="1280px"
        pageSize={LOS_LISTING_PAGE_SIZE}
        pageSizeOptions={LOS_LISTING_PAGE_SIZE_OPTIONS}
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
                link.href = getLeadsExportUrl(token);
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
              onClick={() => void loadLeads()}
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
