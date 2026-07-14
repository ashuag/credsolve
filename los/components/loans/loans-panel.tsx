'use client';

import { DataTablePagination, LOS_TABLE_PAGE_SIZE, paginateItems } from '@/components/ui/data-table';
import { getLoans, type LosLoan } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
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

function formatINR(value: string | null | undefined) {
  if (!value) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
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

function StatusPill({ label, code }: { label: string; code?: string }) {
  const s = (code ?? label).toUpperCase();
  const isClosed = s.includes('CLOSED') || s.includes('WRITE') || s === 'PAID';
  const isOverdue = s.includes('OVERDUE');
  const isActive = s === 'ACTIVE' || s.includes('DISBURS');
  const style = isOverdue
    ? { background: 'rgba(239,68,68,0.14)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.28)' }
    : isClosed
      ? { background: 'rgba(16,185,129,0.14)', color: '#047857', border: '1px solid rgba(16,185,129,0.3)' }
      : isActive
        ? { background: 'rgba(14,165,233,0.14)', color: '#0369a1', border: '1px solid rgba(14,165,233,0.28)' }
        : { background: 'rgba(99,102,241,0.12)', color: '#4338ca', border: '1px solid rgba(99,102,241,0.22)' };
  const display =
    isClosed && !s.includes('WRITE')
      ? 'Paid fully'
      : isOverdue
        ? 'Overdue'
        : label;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap" style={style}>
      {display}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 rounded-[14px] border"
      style={{ background: `${color}09`, borderColor: `${color}22` }}
    >
      <span className="text-[0.68rem] font-extrabold tracking-[0.14em] uppercase" style={{ color: `${color}cc` }}>
        {label}
      </span>
      <span className="text-[1.45rem] font-extrabold leading-none tracking-tight" style={{ color }}>
        {value}
      </span>
      {sub ? <span className="text-[0.72rem] text-brand-muted">{sub}</span> : null}
    </div>
  );
}

const PAGE_SIZE = LOS_TABLE_PAGE_SIZE;

export function LoansPanel() {
  const [loans, setLoans] = useState<LosLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      setLoading(false);
      return;
    }
    try {
      setLoans(await getLoans(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLoans();
  }, [loadLoans]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = loans.filter((loan) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const haystack = [
      loan.fullName,
      loan.mobileNumber,
      loan.loanNumber,
      loan.applicationNumber,
      loan.loanStatusLabel,
      loan.email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const { paginated, safePage, totalPages, rangeStart, rangeEnd, count } = paginateItems(
    filtered,
    currentPage,
    PAGE_SIZE,
  );

  const totalDisbursed = loans.reduce((sum, loan) => sum + (Number(loan.netDisbursedAmount) || 0), 0);
  const activeCount = loans.filter((loan) => loan.loanStatusCode.toUpperCase() === 'ACTIVE').length;
  const overdueCount = loans.filter((loan) => loan.loanStatusCode.toUpperCase() === 'OVERDUE').length;

  return (
    <div className="flex flex-col gap-4">
      {!loading && !fetchError ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Loans" value={loans.length} color="#1496f3" />
          <StatCard label="Active" value={activeCount} color="#10b981" sub={`of ${loans.length}`} />
          <StatCard label="Overdue" value={overdueCount} color="#ef4444" />
          <StatCard
            label="Net Disbursed"
            value={formatINR(String(totalDisbursed))}
            color="#6366f1"
            sub="all time"
          />
        </div>
      ) : null}

      <div
        className="rounded-[14px] border border-[rgba(23,44,113,0.1)] overflow-hidden"
        style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.94))' }}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[rgba(23,44,113,0.07)]">
          <div className="flex-1 min-w-[180px]">
            <input
              type="search"
              placeholder="Search loan no, name, mobile, application…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="los-input h-[36px] text-[0.84rem]"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadLoans()}
            className="h-[36px] px-4 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent text-[0.84rem] font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors whitespace-nowrap"
          >
            ↺ Refresh
          </button>
        </div>

        {fetchError ? (
          <div className="p-8 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-10 text-center text-brand-muted text-[0.88rem]">
            <span className="inline-block animate-pulse">Loading loans…</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.84rem]">
                <thead>
                  <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)]">
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">
                      Loan
                    </th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">
                      Borrower
                    </th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">
                      Principal
                    </th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">
                      Net disbursed
                    </th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">
                      Repay by
                    </th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">
                      Disbursed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-brand-muted text-[0.86rem]">
                        {search
                          ? 'No loans match your search.'
                          : 'No disbursed loans yet. Approve and disburse an application to see it here.'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((loan, idx) => {
                      const name = formatPersonName(loan.fullName, 'Borrower (name pending)');
                      return (
                        <tr
                          key={loan.uuid}
                          className={`border-b transition-colors hover:bg-[rgba(20,150,243,0.025)] ${idx === paginated.length - 1 ? 'border-b-0' : 'border-[rgba(23,44,113,0.05)]'}`}
                        >
                          <td className="px-4 py-2.5">
                            <Link href={`/loans/${loan.uuid}`} className="no-underline group">
                              <div className="font-extrabold text-brand-navy group-hover:text-brand-blue">
                                {loan.loanNumber}
                              </div>
                              <div className="text-[0.72rem] text-brand-muted mt-0.5">
                                App {loan.applicationNumber}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-brand-text">{name}</div>
                            <div className="text-[0.72rem] text-brand-muted mt-0.5">{loan.mobileNumber}</div>
                          </td>
                          <td className="px-4 py-2.5 font-bold text-brand-text whitespace-nowrap">
                            {formatINR(loan.principalAmount)}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-[#047857] whitespace-nowrap">
                            {formatINR(loan.netDisbursedAmount)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-brand-text">
                            {formatDate(loan.loanMaturityDate)}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusPill label={loan.loanStatusLabel} code={loan.loanStatusCode} />
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-brand-muted">
                            {formatDateTime(loan.disbursedAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <DataTablePagination
              page={safePage}
              total={totalPages}
              start={rangeStart}
              end={rangeEnd}
              count={count}
              entityLabel="loans"
              onPrev={() => setCurrentPage(Math.max(1, safePage - 1))}
              onNext={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}
