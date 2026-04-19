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

export function LeadsPanel() {
  const [leads, setLeads] = useState<LosLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [statuses, setStatuses] = useState<Array<{ code: string; displayName: string }>>([]);

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
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const searchTerm = search.trim().toLowerCase();
  const filteredLeads = leads.filter((lead) => (
    (statusFilter === 'all' || lead.statusCode === statusFilter)
    && (searchTerm === ''
    || lead.uuid.toLowerCase().includes(searchTerm)
    || lead.customerUuid.toLowerCase().includes(searchTerm)
    || lead.mobileNumber.toLowerCase().includes(searchTerm)
    || (lead.email ?? '').toLowerCase().includes(searchTerm)
    || lead.statusCode.toLowerCase().includes(searchTerm)
    || lead.statusLabel.toLowerCase().includes(searchTerm)
    || sourceLabel(lead).toLowerCase().includes(searchTerm)
    || (lead.utmCampaign ?? '').toLowerCase().includes(searchTerm))
  ));

  const leadsWithEmail = leads.filter((lead) => !!lead.email).length;
  const attributedLeads = leads.filter((lead) => !!lead.sourceName || !!lead.utmSource).length;
  const newStatusLeads = leads.filter((lead) => lead.statusCode === 'NEW').length;

  return (
    <>
      <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-4">
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Active leads</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : leads.length}
          </strong>
        </article>
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Status NEW</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : newStatusLeads}
          </strong>
        </article>
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Email captured</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : leadsWithEmail}
          </strong>
        </article>
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Attributed source</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : attributedLeads}
          </strong>
        </article>
      </div>

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

        <div className="grid gap-3 px-4 py-3 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-extrabold tracking-[0.08em] uppercase text-brand-muted">
              Search
            </span>
            <input
              type="search"
              placeholder="Lead UUID, customer UUID, mobile, email or source…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="los-input"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-extrabold tracking-[0.08em] uppercase text-brand-muted">
              Status
            </span>
            <select className="los-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status.code} value={status.code}>
                  {status.displayName}
                </option>
              ))}
            </select>
          </label>
          </div>

          <div className="flex items-end text-[0.8rem] text-brand-muted">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </div>

        {fetchError ? (
          <div className="p-6 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">Loading leads…</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">
            {searchTerm ? 'No leads match the current search.' : 'No leads available right now.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.8)]">
                  {['Lead', 'Mobile', 'Email', 'Status', 'Source', 'Campaign', 'Created', 'Updated'].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-2 text-[0.72rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, idx) => (
                  <tr
                    key={lead.uuid}
                    className={`border-b border-[rgba(23,44,113,0.05)] transition-colors hover:bg-[rgba(20,150,243,0.03)] ${
                      idx === filteredLeads.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="min-w-[200px]">
                        <Link href={`/leads/${lead.uuid}`} className="block text-brand-blue text-[0.84rem] break-all font-extrabold no-underline hover:underline">
                          {lead.uuid}
                        </Link>
                        <span className="block text-brand-muted text-[0.75rem] break-all">
                          Customer {lead.customerUuid}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{lead.mobileNumber}</td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <span className="block min-w-[220px] whitespace-normal break-all">
                        {lead.email ?? 'Not captured'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <LeadStatusBadge lead={lead} />
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
                    <td className="px-4 py-2.5 text-brand-muted text-[0.8rem] whitespace-nowrap">{formatDateTime(lead.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
