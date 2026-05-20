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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceLabel(lead: LosLead) {
  if (lead.sourceName) return lead.sourceType ? `${lead.sourceName} · ${lead.sourceType}` : lead.sourceName;
  if (lead.utmSource) return lead.utmMedium ? `${lead.utmSource} · ${lead.utmMedium}` : lead.utmSource;
  return 'Unattributed';
}

function LeadStatusBadge({ lead }: { lead: LosLead }) {
  return (
    <span className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-[rgba(23,44,113,0.12)] bg-[rgba(20,150,243,0.08)] px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-blue">
      {lead.statusLabel}
    </span>
  );
}

function PanVerifiedBadge({ lead }: { lead: LosLead }) {
  const verified = lead.panVerified === 1;
  const failed = lead.panVerified === 2;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.06em] ${
        verified
          ? 'bg-[rgba(29,157,112,0.14)] text-[#14523a]'
          : failed
            ? 'bg-[rgba(231,95,95,0.14)] text-[#8d3434]'
            : 'bg-[rgba(100,116,139,0.12)] text-[#475569]'
      }`}
    >
      {lead.panVerifiedLabel}
    </span>
  );
}

/** Stable React keys — do not reuse labels (e.g. two "PAN" columns). */
const LEAD_TABLE_COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'customer', label: 'Customer' },
  { key: 'pan-number', label: 'PAN' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'city', label: 'City' },
  { key: 'cibil', label: 'CIBIL' },
  { key: 'pan-verified', label: 'PAN verified' },
  { key: 'status', label: 'Status' },
  { key: 'rejection-reason', label: 'Rejection reason' },
  { key: 'lead-status-note', label: 'Lead status note' },
  { key: 'source', label: 'Source' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'created', label: 'Created' },
];

const LEADS_PAGE_SIZE = 20;

type ColumnFilters = Partial<Record<(typeof LEAD_TABLE_COLUMNS)[number]['key'], string>>;

function getLeadColumnSearchText(lead: LosLead, columnKey: string): string {
  switch (columnKey) {
    case 'customer':
      return lead.fullName?.trim() || '';
    case 'pan-number':
      return lead.panNumber ?? '';
    case 'mobile':
      return lead.mobileNumber;
    case 'occupation':
      return lead.occupation ?? '';
    case 'city':
      return lead.city ?? '';
    case 'cibil':
      return lead.cibilScore != null ? String(lead.cibilScore) : '';
    case 'pan-verified':
      return lead.panVerifiedLabel;
    case 'status':
      return `${lead.statusCode} ${lead.statusLabel}`;
    case 'rejection-reason':
      return lead.rejectionReason ? `${lead.rejectionReason.code} ${lead.rejectionReason.label}` : '';
    case 'lead-status-note':
      return lead.leadStatusNote ?? '';
    case 'source':
      return sourceLabel(lead);
    case 'campaign':
      return lead.utmCampaign ?? 'No campaign';
    case 'created':
      return formatDateTime(lead.createdAt);
    default:
      return '';
  }
}

function leadMatchesColumnFilters(lead: LosLead, filters: ColumnFilters): boolean {
  for (const col of LEAD_TABLE_COLUMNS) {
    const raw = filters[col.key]?.trim() ?? '';
    if (!raw) continue;

    if (col.key === 'status') {
      if (lead.statusCode !== raw) return false;
      continue;
    }

    if (col.key === 'pan-verified') {
      if (String(lead.panVerified) !== raw) return false;
      continue;
    }

    if (col.key === 'rejection-reason') {
      if ((lead.rejectionReason?.code ?? '') !== raw) return false;
      continue;
    }

    if (!getLeadColumnSearchText(lead, col.key).toLowerCase().includes(raw.toLowerCase())) {
      return false;
    }
  }
  return true;
}

function PaginationControls({
  currentPage,
  totalPages,
  rangeStart,
  rangeEnd,
  totalItems,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] px-4 py-3">
      <span className="text-[0.8rem] text-brand-muted">
        {totalItems === 0
          ? 'No leads to display'
          : `Showing ${rangeStart}–${rangeEnd} of ${totalItems} leads`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage <= 1}
          className="min-h-[34px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.82rem] font-bold text-brand-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-[0.8rem] font-bold text-brand-muted">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="min-h-[34px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.82rem] font-bold text-brand-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function LeadsPanel() {
  const [leads, setLeads] = useState<LosLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statuses, setStatuses] = useState<Array<{ code: string; displayName: string }>>([]);
  const [rejectionReasons, setRejectionReasons] = useState<Array<{ code: string; label: string }>>([]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      setLoading(false);
      return;
    }

    try {
      const [leadsResponse, masters] = await Promise.all([getNewLeads(token), getMasters(token)]);
      setLeads(leadsResponse);
      setStatuses(masters.leadStatuses.filter((item) => item.isActive).map((item) => ({
        code: item.code,
        displayName: item.displayName,
      })));
      setRejectionReasons(
        (masters.rejectionReasons ?? [])
          .filter((item) => item.isActive)
          .map((item) => ({
            code: item.name,
            label: item.name.replace(/_/g, ' '),
          })),
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters]);

  const filteredLeads = leads.filter((lead) => leadMatchesColumnFilters(lead, columnFilters));
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * LEADS_PAGE_SIZE;
  const paginatedLeads = filteredLeads.slice(pageStartIndex, pageStartIndex + LEADS_PAGE_SIZE);
  const rangeStart = filteredLeads.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = Math.min(pageStartIndex + LEADS_PAGE_SIZE, filteredLeads.length);
  const hasActiveFilters = Object.values(columnFilters).some((value) => (value?.trim() ?? '') !== '');

  const setColumnFilter = (key: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!value.trim()) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  return (
    <>
      <div
        className="rounded-[10px] border border-[rgba(23,44,113,0.1)] overflow-hidden"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[rgba(23,44,113,0.07)]">
          <div>
            <span className="block text-[0.72rem] font-extrabold tracking-[0.14em] uppercase text-brand-blue">
              Lead management
            </span>
            <h2 className="m-0 text-[1.15rem] font-extrabold leading-tight tracking-[-0.02em]">
              All Leads
            </h2>
          </div>
          <button
            type="button"
            onClick={loadLeads}
            className="min-h-[38px] rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-4 font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors"
          >
            Refresh
          </button>
        </div>

        {fetchError ? (
          <div className="p-6 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">Loading leads…</div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.8)]">
                  {LEAD_TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-2 text-[0.72rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.55)]">
                  {LEAD_TABLE_COLUMNS.map((col) => (
                    <th key={`filter-${col.key}`} className="px-2 py-2 align-top font-normal">
                      {col.key === 'status' ? (
                        <select
                          className="los-input w-full min-h-[32px] py-1 px-2 text-[0.78rem]"
                          value={columnFilters.status ?? ''}
                          onChange={(e) => setColumnFilter('status', e.target.value)}
                        >
                          <option value="">All</option>
                          {statuses.map((status) => (
                            <option key={status.code} value={status.code}>
                              {status.displayName}
                            </option>
                          ))}
                        </select>
                      ) : col.key === 'pan-verified' ? (
                        <select
                          className="los-input w-full min-h-[32px] py-1 px-2 text-[0.78rem]"
                          value={columnFilters['pan-verified'] ?? ''}
                          onChange={(e) => setColumnFilter('pan-verified', e.target.value)}
                        >
                          <option value="">All</option>
                          <option value="0">Not checked</option>
                          <option value="1">Verified</option>
                          <option value="2">Not verified</option>
                          <option value="3">API failure</option>
                          <option value="4">Disabled</option>
                        </select>
                      ) : col.key === 'rejection-reason' ? (
                        <select
                          className="los-input w-full min-h-[32px] py-1 px-2 text-[0.78rem]"
                          value={columnFilters['rejection-reason'] ?? ''}
                          onChange={(e) => setColumnFilter('rejection-reason', e.target.value)}
                        >
                          <option value="">All</option>
                          {rejectionReasons.map((reason) => (
                            <option key={reason.code} value={reason.code}>
                              {reason.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="search"
                          placeholder="Filter…"
                          value={columnFilters[col.key] ?? ''}
                          onChange={(e) => setColumnFilter(col.key, e.target.value)}
                          className="los-input w-full min-h-[32px] py-1 px-2 text-[0.78rem]"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={LEAD_TABLE_COLUMNS.length}
                      className="px-4 py-10 text-center text-brand-muted text-[0.88rem]"
                    >
                      {hasActiveFilters
                        ? 'No leads match the current column filters.'
                        : 'No leads available right now.'}
                    </td>
                  </tr>
                ) : paginatedLeads.map((lead, idx) => (
                  <tr
                    key={lead.uuid}
                    className={`border-b border-[rgba(23,44,113,0.05)] transition-colors hover:bg-[rgba(20,150,243,0.03)] ${
                      idx === paginatedLeads.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="min-w-[140px]">
                        <Link
                          href={`/leads/${lead.uuid}`}
                          className="block text-brand-blue text-[0.86rem] font-extrabold no-underline hover:underline"
                        >
                          {lead.fullName?.trim() || '—'}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap font-mono text-[0.84rem] tracking-wide">
                      {lead.panNumber ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{lead.mobileNumber}</td>
                    <td className="px-4 py-2.5 text-brand-muted whitespace-nowrap">{lead.occupation ?? '—'}</td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <span className="block min-w-[120px] whitespace-normal break-words">{lead.city ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap font-semibold tabular-nums">
                      {lead.cibilScore ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <PanVerifiedBadge lead={lead} />
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <LeadStatusBadge lead={lead} />
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      {lead.rejectionReason ? (
                        <div className="min-w-[140px]">
                          <strong className="block text-[#8d3434] text-[0.84rem] whitespace-normal break-words">
                            {lead.rejectionReason.label}
                          </strong>
                          <span className="block mt-0.5 text-[0.72rem] font-mono text-brand-muted break-all">
                            {lead.rejectionReason.code}
                          </span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <span className="block min-w-[180px] text-[0.8rem] whitespace-normal break-words">
                        {lead.leadStatusNote ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <div className="min-w-[170px]">
                        <strong className="block text-brand-text text-[0.84rem] whitespace-normal break-words">
                          {sourceLabel(lead)}
                        </strong>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <span className="block min-w-[180px] whitespace-normal break-words">
                        {lead.utmCampaign ?? 'No campaign'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted text-[0.8rem] whitespace-nowrap">{formatDateTime(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={safePage}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            totalItems={filteredLeads.length}
            onPrevious={() => setCurrentPage(Math.max(1, safePage - 1))}
            onNext={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
          />
          </>
        )}
      </div>
    </>
  );
}
