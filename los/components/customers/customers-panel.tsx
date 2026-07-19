'use client';

import {
  DataTable,
  isoDateTimestamp,
  type DataTableColumn,
} from '@/components/ui/data-table';
import { getCustomers, type LosCustomer } from '@/lib/api';
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

export function CustomersPanel() {
  const [customers, setCustomers] = useState<LosCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  const columns = useMemo((): DataTableColumn<LosCustomer>[] => [
    {
      key: 'customer',
      label: 'Customer',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.fullName ?? '',
      getSortValue: (row) => (row.fullName ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search name…' },
      render: (customer) => {
        const name = formatPersonName(customer.fullName, 'Customer (name pending)');
        const [c1, c2] = avatarColor(name);
        return (
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
        );
      },
    },
    {
      key: 'mobile',
      label: 'Mobile',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.mobileNumber,
      filter: { type: 'text', placeholder: 'Search mobile…' },
      cellClassName: 'text-brand-text whitespace-nowrap',
      render: (customer) => customer.mobileNumber,
    },
    {
      key: 'leads',
      label: 'Leads',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.leadCount,
      getSortValue: (row) => row.leadCount,
      filter: false,
      cellClassName: 'text-brand-text whitespace-nowrap',
      render: (customer) => customer.leadCount,
    },
    {
      key: 'applications',
      label: 'Applications',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.applicationCount,
      getSortValue: (row) => row.applicationCount,
      filter: false,
      cellClassName: 'text-brand-text whitespace-nowrap',
      render: (customer) => customer.applicationCount,
    },
    {
      key: 'latestLead',
      label: 'Latest lead',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.latestLeadStatusLabel ?? '',
      getSortValue: (row) => (row.latestLeadStatusLabel ?? '').toLowerCase(),
      filter: { type: 'text', placeholder: 'Search status…' },
      render: (customer) =>
        customer.latestLeadStatusLabel ? (
          <StatusPill
            label={customer.latestLeadStatusLabel}
            code={customer.latestLeadStatusCode ?? undefined}
          />
        ) : (
          <span className="text-brand-muted">—</span>
        ),
    },
    {
      key: 'kyc',
      label: 'KYC',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => (row.kycVerifiedAt ? 'verified' : 'pending'),
      getSortValue: (row) => (row.kycVerifiedAt ? 0 : 1),
      filter: false,
      cellClassName: 'whitespace-nowrap',
      render: (customer) =>
        customer.kycVerifiedAt ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-bold bg-[rgba(16,185,129,0.1)] text-[#10b981] border border-[rgba(16,185,129,0.2)]">
            Verified
          </span>
        ) : (
          <span className="text-brand-muted">Pending</span>
        ),
    },
    {
      key: 'created',
      label: 'Created',
      headerClassName: 'whitespace-nowrap',
      getFilterValue: (row) => row.createdAt,
      getSortValue: (row) => isoDateTimestamp(row.createdAt),
      filter: { type: 'date' },
      cellClassName: 'text-brand-muted text-[0.78rem] whitespace-nowrap',
      render: (customer) => formatDateTime(customer.createdAt),
    },
  ], []);

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

      <DataTable
        items={customers}
        columns={columns}
        getRowKey={(customer) => customer.uuid}
        entityLabel="customers"
        loading={loading}
        error={fetchError}
        onRetry={() => void loadCustomers()}
        emptyMessage="No customers available right now."
        noResultsMessage="No customers match your filters."
        toolbarActions={
          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="h-[32px] cursor-pointer whitespace-nowrap rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text transition-colors hover:bg-[rgba(20,150,243,0.06)]"
          >
            ↺ Refresh
          </button>
        }
      />
    </div>
  );
}
