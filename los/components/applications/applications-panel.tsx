'use client';

import { getApplications, type LosApplication } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
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

function formatCurrency(value: string | null) {
  if (!value) return 'Not set';

  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function ApplicationStatusBadge({ application }: { application: LosApplication }) {
  return (
    <span className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-[rgba(23,44,113,0.12)] bg-[rgba(255,197,25,0.16)] px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-navy">
      {application.statusLabel}
    </span>
  );
}

export function ApplicationsPanel() {
  const [applications, setApplications] = useState<LosApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      setLoading(false);
      return;
    }

    try {
      setApplications(await getApplications(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const searchTerm = search.trim().toLowerCase();
  const filteredApplications = applications.filter((application) => (
    searchTerm === ''
    || application.uuid.toLowerCase().includes(searchTerm)
    || application.customerUuid.toLowerCase().includes(searchTerm)
    || (application.leadUuid ?? '').toLowerCase().includes(searchTerm)
    || application.mobileNumber.toLowerCase().includes(searchTerm)
    || (application.email ?? '').toLowerCase().includes(searchTerm)
    || (application.fullName ?? '').toLowerCase().includes(searchTerm)
    || application.statusCode.toLowerCase().includes(searchTerm)
    || application.statusLabel.toLowerCase().includes(searchTerm)
  ));

  const draftApplications = applications.filter((application) => application.statusCode === 'DRAFT').length;
  const submittedApplications = applications.filter((application) => application.statusCode === 'SUBMITTED').length;
  const approvedApplications = applications.filter((application) => (
    application.statusCode === 'APPROVED' || application.statusCode === 'DISBURSED'
  )).length;
  const applicationsWithAmount = applications.filter((application) => application.loanAmount !== null).length;

  return (
    <>
      <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-4">
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Total applications</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : applications.length}
          </strong>
        </article>
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Draft</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : draftApplications}
          </strong>
        </article>
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Submitted</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : submittedApplications}
          </strong>
        </article>
        <article
          className="rounded-[8px] border border-[rgba(23,44,113,0.1)] px-4 py-3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,246,255,0.94))' }}
        >
          <span className="block text-[0.78rem] text-brand-muted">Approved / Disbursed</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : approvedApplications}
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
              Application management
            </span>
            <h2 className="m-0 text-[1.15rem] font-extrabold leading-tight tracking-[-0.02em]">
              All Application
            </h2>
          </div>
          <button
            type="button"
            onClick={loadApplications}
            className="min-h-[38px] rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-4 font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-3 px-4 py-3 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.72)] md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="grid gap-1">
            <span className="text-[0.72rem] font-extrabold tracking-[0.08em] uppercase text-brand-muted">
              Search
            </span>
            <input
              type="search"
              placeholder="Application UUID, lead, mobile, applicant or status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="los-input"
            />
          </label>

          <div className="flex items-end text-[0.8rem] text-brand-muted">
            Showing {filteredApplications.length} of {applications.length} applications
          </div>
        </div>

        {fetchError ? (
          <div className="p-6 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">Loading applications…</div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">
            {searchTerm ? 'No applications match the current search.' : 'No applications available right now.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.8)]">
                  {['Application', 'Applicant', 'Mobile', 'Email', 'Status', 'Loan Amount', 'Created', 'Updated'].map((heading) => (
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
                {filteredApplications.map((application, idx) => (
                  <tr
                    key={application.uuid}
                    className={`border-b border-[rgba(23,44,113,0.05)] transition-colors hover:bg-[rgba(20,150,243,0.03)] ${
                      idx === filteredApplications.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="min-w-[220px]">
                        <strong className="block text-brand-text text-[0.84rem] break-all">{application.uuid}</strong>
                        <span className="block text-brand-muted text-[0.75rem] break-all">
                          {application.leadUuid ? `Lead ${application.leadUuid}` : `Customer ${application.customerUuid}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <div className="min-w-[200px]">
                        <strong className="block text-brand-text text-[0.84rem] whitespace-normal break-words">
                          {application.fullName ?? 'Details pending'}
                        </strong>
                        <span className="block text-[0.75rem] break-all">
                          Customer {application.customerUuid}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{application.mobileNumber}</td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <span className="block min-w-[220px] whitespace-normal break-all">
                        {application.email ?? 'Not captured'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <ApplicationStatusBadge application={application} />
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">
                      {formatCurrency(application.loanAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted text-[0.8rem] whitespace-nowrap">{formatDateTime(application.createdAt)}</td>
                    <td className="px-4 py-2.5 text-brand-muted text-[0.8rem] whitespace-nowrap">{formatDateTime(application.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && !fetchError ? (
        <div className="mt-3 text-[0.78rem] text-brand-muted">
          Loan amount captured for {applicationsWithAmount} of {applications.length} applications.
        </div>
      ) : null}
    </>
  );
}
