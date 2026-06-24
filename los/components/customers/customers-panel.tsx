'use client';

import { DataTablePagination, LOS_TABLE_PAGE_SIZE, paginateItems } from '@/components/ui/data-table';
import { getCustomers, type LosCustomer } from '@/lib/api';
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const isRejected = s.includes('REJECT') || s.includes('FAIL') || s.includes('DENI');
  const isApproved = s.includes('APPROV') || s.includes('DISB') || s.includes('ACTIVE') || s.includes('CONVERT');
  const isPending = s.includes('PEND') || s.includes('REVIEW') || s.includes('PROGRESS');
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

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 rounded-[14px] border"
      style={{ background: `${color}09`, borderColor: `${color}22` }}
    >
      <span className="text-[0.68rem] font-extrabold tracking-[0.14em] uppercase" style={{ color: `${color}cc` }}>{label}</span>
      <span className="text-[1.6rem] font-extrabold leading-none tracking-tight" style={{ color }}>{value}</span>
      {sub ? <span className="text-[0.72rem] text-brand-muted">{sub}</span> : null}
    </div>
  );
}

const PAGE_SIZE = LOS_TABLE_PAGE_SIZE;

export function CustomersPanel() {
  const [customers, setCustomers] = useState<LosCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const token = getToken();
    if (!token) {
      setFetchError('Session expired — please log in again.');
      setLoading(false);
      return;
    }
    try {
      setCustomers(await getCustomers(token));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filtered = customers.filter((customer) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const haystack = [customer.fullName, customer.mobileNumber, customer.latestLeadStatusLabel]
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

  const withApplications = customers.filter((customer) => customer.applicationCount > 0).length;
  const kycVerified = customers.filter((customer) => customer.kycVerifiedAt).length;

  return (
    <div className="flex flex-col gap-4">
      {!loading && !fetchError ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Customers" value={customers.length} color="#1496f3" />
          <StatCard label="With Applications" value={withApplications} color="#6366f1" sub="active pipeline" />
          <StatCard label="KYC Verified" value={kycVerified} color="#10b981" sub={`of ${customers.length}`} />
          <StatCard
            label="Blacklisted"
            value={customers.filter((customer) => customer.isBlacklisted).length}
            color="#ef4444"
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
              placeholder="Search name, mobile, status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="los-input h-[36px] text-[0.84rem]"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="h-[36px] px-4 rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent text-[0.84rem] font-bold text-brand-text cursor-pointer hover:bg-[rgba(20,150,243,0.06)] transition-colors whitespace-nowrap"
          >
            ↺ Refresh
          </button>
        </div>

        {fetchError ? (
          <div className="p-8 text-center text-[#8d3434] text-[0.88rem]">{fetchError}</div>
        ) : loading ? (
          <div className="p-10 text-center text-brand-muted text-[0.88rem]">
            <span className="inline-block animate-pulse">Loading customers…</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.84rem]">
                <thead>
                  <tr className="text-left border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.9)]">
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Customer</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Mobile</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Leads</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Applications</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Latest lead</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">KYC</th>
                    <th className="px-4 py-2.5 text-[0.68rem] font-extrabold tracking-[0.1em] uppercase text-brand-muted whitespace-nowrap">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-brand-muted text-[0.86rem]">
                        {search ? 'No customers match your search.' : 'No customers available right now.'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((customer, idx) => {
                      const name = formatPersonName(customer.fullName, 'Customer (name pending)');
                      const [c1, c2] = avatarColor(name);
                      return (
                        <tr
                          key={customer.uuid}
                          className={`border-b transition-colors hover:bg-[rgba(20,150,243,0.025)] ${idx === paginated.length - 1 ? 'border-b-0' : 'border-[rgba(23,44,113,0.05)]'}`}
                        >
                          <td className="px-4 py-2.5">
                            <Link href={`/customers/${customer.uuid}`} className="flex items-center gap-2.5 no-underline group">
                              <span
                                className="flex-shrink-0 grid place-items-center w-8 h-8 rounded-[9px] text-white text-[0.7rem] font-extrabold"
                                style={{ background: `linear-gradient(135deg,${c1},${c2})` }}
                              >
                                {getInitials(customer.fullName)}
                              </span>
                              <span className="text-brand-blue font-semibold text-[0.84rem] group-hover:underline whitespace-nowrap">
                                {name}
                              </span>
                              {customer.isBlacklisted ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-[rgba(239,68,68,0.1)] text-[#ef4444] border border-[rgba(239,68,68,0.2)]">
                                  Blacklisted
                                </span>
                              ) : null}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{customer.mobileNumber}</td>
                          <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{customer.leadCount}</td>
                          <td className="px-4 py-2.5 text-brand-text whitespace-nowrap">{customer.applicationCount}</td>
                          <td className="px-4 py-2.5">
                            {customer.latestLeadStatusLabel ? (
                              <StatusPill
                                label={customer.latestLeadStatusLabel}
                                code={customer.latestLeadStatusCode ?? undefined}
                              />
                            ) : (
                              <span className="text-brand-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {customer.kycVerifiedAt ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold bg-[rgba(16,185,129,0.1)] text-[#10b981] border border-[rgba(16,185,129,0.2)]">
                                Verified
                              </span>
                            ) : (
                              <span className="text-brand-muted">Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-brand-muted text-[0.78rem] whitespace-nowrap">
                            {formatDateTime(customer.createdAt)}
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
              entityLabel="customers"
              onPrev={() => setCurrentPage(Math.max(1, safePage - 1))}
              onNext={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}
