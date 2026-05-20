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
  } catch {
    return null;
  }
}

function formatCurrency(value: string | null | undefined) {
  if (!value) return '—';

  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatProcessingFees(application: LosApplication) {
  const amount = formatCurrency(application.processingFeeAmount);
  const percent = application.processingFeePercent;
  if (amount === '—' && !percent) return '—';
  if (!percent) return amount;
  return (
    <span className="block min-w-[120px]">
      <strong className="block text-brand-text">{amount}</strong>
      <span className="block mt-0.5 text-[0.72rem] text-brand-muted">{percent}%</span>
    </span>
  );
}

function ApplicationStatusBadge({ application }: { application: LosApplication }) {
  return (
    <span className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-[rgba(23,44,113,0.12)] bg-[rgba(255,197,25,0.16)] px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-navy">
      {application.statusLabel}
    </span>
  );
}

const APPLICATION_TABLE_COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'applicant', label: 'Applicant' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'cibil', label: 'CIBIL score' },
  { key: 'email', label: 'Email' },
  { key: 'eligible-loan', label: 'Eligible loan' },
  { key: 'selected-loan', label: 'Selected loan' },
  { key: 'repay-date', label: 'Repay date' },
  { key: 'repayment', label: 'Repayment amount' },
  { key: 'emi', label: 'EMI' },
  { key: 'processing-fees', label: 'Processing fees' },
  { key: 'bank', label: 'Bank details' },
  { key: 'status', label: 'Status' },
];

const APPLICATIONS_PAGE_SIZE = 20;

type ColumnFilters = Partial<Record<(typeof APPLICATION_TABLE_COLUMNS)[number]['key'], string>>;

function getApplicationColumnSearchText(application: LosApplication, columnKey: string): string {
  switch (columnKey) {
    case 'applicant':
      return application.fullName?.trim() || 'Details pending';
    case 'mobile':
      return application.mobileNumber;
    case 'cibil':
      return application.cibilScore != null ? String(application.cibilScore) : '';
    case 'email':
      return application.email ?? 'Not captured';
    case 'eligible-loan':
      return application.eligibleLoanAmount ?? '';
    case 'selected-loan':
      return application.selectedLoanAmount ?? '';
    case 'repay-date':
      return application.repayDate ? formatDateOnly(application.repayDate) : '';
    case 'repayment':
      return application.repaymentAmount ?? '';
    case 'emi':
      return application.emi ?? '';
    case 'processing-fees':
      return [application.processingFeeAmount, application.processingFeePercent].filter(Boolean).join(' ');
    case 'bank':
      return application.bankDetails ?? '';
    case 'status':
      return `${application.statusCode} ${application.statusLabel}`;
    default:
      return '';
  }
}

function applicationMatchesColumnFilters(application: LosApplication, filters: ColumnFilters): boolean {
  for (const col of APPLICATION_TABLE_COLUMNS) {
    const raw = filters[col.key]?.trim() ?? '';
    if (!raw) continue;

    if (col.key === 'status') {
      if (application.statusCode !== raw) return false;
      continue;
    }

    if (!getApplicationColumnSearchText(application, col.key).toLowerCase().includes(raw.toLowerCase())) {
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
          ? 'No applications to display'
          : `Showing ${rangeStart}–${rangeEnd} of ${totalItems} applications`}
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

export function ApplicationsPanel() {
  const [applications, setApplications] = useState<LosApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statuses, setStatuses] = useState<Array<{ code: string; displayName: string }>>([]);

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
      const [applicationsResponse, masters] = await Promise.all([getApplications(token), getMasters(token)]);
      setApplications(applicationsResponse);
      setStatuses(masters.applicationStatuses.filter((item) => item.isActive).map((item) => ({
        code: item.code,
        displayName: item.displayName,
      })));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters]);

  const filteredApplications = applications.filter((application) =>
    applicationMatchesColumnFilters(application, columnFilters),
  );
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / APPLICATIONS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * APPLICATIONS_PAGE_SIZE;
  const paginatedApplications = filteredApplications.slice(
    pageStartIndex,
    pageStartIndex + APPLICATIONS_PAGE_SIZE,
  );
  const rangeStart = filteredApplications.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = Math.min(pageStartIndex + APPLICATIONS_PAGE_SIZE, filteredApplications.length);
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

  const draftApplications = applications.filter((application) => application.statusCode === 'DRAFT').length;
  const inReviewApplications = applications.filter((application) => application.statusCode === 'IN_REVIEW').length;
  const approvedApplications = applications.filter((application) => (
    application.statusCode === 'APPROVED' || application.statusCode === 'DISBURSED'
  )).length;
  const applicationsWithAmount = applications.filter((application) => application.selectedLoanAmount !== null).length;

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
          <span className="block text-[0.78rem] text-brand-muted">In review</span>
          <strong className="block mt-0.5 text-[1.6rem] font-extrabold tracking-[-0.03em] leading-none">
            {loading ? '—' : inReviewApplications}
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

        {fetchError ? (
          <div className="p-6 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-8 text-center text-brand-muted text-[0.88rem]">Loading applications…</div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.88rem]">
              <thead>
                <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.8)]">
                  {APPLICATION_TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-2 text-[0.72rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.55)]">
                  {APPLICATION_TABLE_COLUMNS.map((col) => (
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
                {paginatedApplications.length === 0 ? (
                  <tr>
                    <td
                      colSpan={APPLICATION_TABLE_COLUMNS.length}
                      className="px-4 py-10 text-center text-brand-muted text-[0.88rem]"
                    >
                      {hasActiveFilters
                        ? 'No applications match the current column filters.'
                        : 'No applications available right now.'}
                    </td>
                  </tr>
                ) : paginatedApplications.map((application, idx) => (
                  <tr
                    key={application.uuid}
                    className={`border-b border-[rgba(23,44,113,0.05)] transition-colors hover:bg-[rgba(20,150,243,0.03)] ${
                      idx === paginatedApplications.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-brand-muted">
                      <div className="min-w-[160px]">
                        <Link
                          href={`/applications/${application.uuid}`}
                          className="block text-brand-blue text-[0.86rem] font-extrabold no-underline hover:underline"
                        >
                          {application.fullName?.trim() || 'Details pending'}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{application.mobileNumber}</td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap font-semibold tabular-nums">
                      {application.cibilScore ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <span className="block min-w-[200px] whitespace-normal break-all">
                        {application.email ?? 'Not captured'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">
                      {formatCurrency(application.eligibleLoanAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">
                      {formatCurrency(application.selectedLoanAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted whitespace-nowrap">
                      {formatDateOnly(application.repayDate)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">
                      {formatCurrency(application.repaymentAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">
                      {formatCurrency(application.emi)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      {formatProcessingFees(application)}
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <span className="block min-w-[180px] whitespace-normal break-words">
                        {application.bankDetails ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-brand-muted">
                      <ApplicationStatusBadge application={application} />
                    </td>
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
            totalItems={filteredApplications.length}
            onPrevious={() => setCurrentPage(Math.max(1, safePage - 1))}
            onNext={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
          />
          </>
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
