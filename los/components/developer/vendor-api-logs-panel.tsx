'use client';

import {
  DataTableColumnFilter,
  DataTableColumnHeader,
  DataTablePagination,
  LOS_TABLE_PAGE_SIZE,
  hasActiveColumnFilters,
  type ColumnFilters,
  type SortState,
} from '@/components/ui/data-table';
import {
  getVendorApiLog,
  listVendorApiLogs,
  type LosVendorApiLogDetail,
  type LosVendorApiLogListItem,
} from '@/lib/api';
import { formatApplicationDisplayId } from '@/lib/application-review-format';
import { getLosToken } from '@/lib/auth';
import { cx } from '@/lib/cx';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type SortKey =
  | 'id'
  | 'providerName'
  | 'serviceName'
  | 'requestMethod'
  | 'httpStatus'
  | 'leadId'
  | 'requestedAt'
  | 'respondedAt';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

const OUTCOME_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
];

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncatePath(path: string | null, max = 64): string {
  if (!path?.trim()) return '—';
  const value = path.trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatJson(value: unknown): string {
  if (value == null) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function OutcomeBadge({ outcome }: { outcome: 'success' | 'failure' }) {
  const ok = outcome === 'success';
  return (
    <span
      className={cx(
        'inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-[0.06em]',
        ok
          ? 'bg-[rgba(16,185,129,0.12)] text-[rgb(4,120,87)]'
          : 'bg-[rgba(239,68,68,0.12)] text-[rgb(185,28,28)]',
      )}
    >
      {ok ? 'OK' : 'Fail'}
    </span>
  );
}

function DetailModal({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: LosVendorApiLogDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,66,0.42)] p-4 backdrop-blur-[4px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Vendor API log detail"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[20px] border border-[rgba(23,44,113,0.12)] shadow-[0_28px_70px_rgba(23,44,113,0.22)]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(241,247,255,0.96))' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(23,44,113,0.08)] px-6 py-5">
          <div>
            <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-brand-blue">
              Vendor API Log
            </span>
            <h2 className="m-0 text-[1.2rem] font-extrabold leading-[1.15] tracking-[-0.03em]">
              {detail ? `${detail.providerName} / ${detail.serviceName}` : 'Loading…'}
            </h2>
            {detail ? (
              <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
                Log #{detail.id}
                {detail.applicationNumber
                  ? ` · ${formatApplicationDisplayId(detail.applicationNumber)}`
                  : ' · Application —'}
                {detail.leadId ? ` · Lead #${detail.leadId}` : ' · Lead —'}
                {' · '}
                {detail.requestMethod} · HTTP {detail.httpStatus ?? '—'} · {formatDateTime(detail.requestedAt)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy"
            aria-label="Close"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {loading ? <p className="m-0 text-[0.9rem] text-brand-muted">Loading detail…</p> : null}
          {error ? <p className="m-0 text-[0.9rem] font-bold text-[rgb(185,28,28)]">{error}</p> : null}
          {detail && !loading ? (
            <div className="grid gap-4">
              <div className="grid gap-2 text-[0.86rem] sm:grid-cols-2">
                <div>
                  <span className="font-bold text-brand-muted">Log ID</span>
                  <p className="m-0 mt-0.5 font-mono font-bold">{detail.id}</p>
                </div>
                <div>
                  <span className="font-bold text-brand-muted">Application ID</span>
                  <p className="m-0 mt-0.5 font-mono font-bold">
                    {detail.applicationUuid && detail.applicationNumber ? (
                      <Link
                        href={`/applications/${detail.applicationUuid}`}
                        className="text-brand-blue no-underline hover:underline"
                      >
                        {formatApplicationDisplayId(detail.applicationNumber)}
                      </Link>
                    ) : (
                      (detail.applicationNumber
                        ? formatApplicationDisplayId(detail.applicationNumber)
                        : '—')
                    )}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-brand-muted">Lead ID</span>
                  <p className="m-0 mt-0.5 font-mono font-bold">{detail.leadId ?? '—'}</p>
                </div>
                <div>
                  <span className="font-bold text-brand-muted">Duration</span>
                  <p className="m-0 mt-0.5 font-bold">{detail.durationMs} ms</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-bold text-brand-muted">Request path</span>
                  <p className="m-0 mt-0.5 break-all font-mono text-[0.78rem]">{detail.requestPath ?? '—'}</p>
                </div>
              </div>
              {(
                [
                  ['Request headers', detail.requestHeaders],
                  ['Request payload', detail.requestPayload],
                  ['Response payload', detail.responsePayload],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="grid gap-1.5">
                  <span className="text-[0.82rem] font-bold text-brand-muted">{label}</span>
                  <pre className="m-0 max-h-[240px] overflow-auto whitespace-pre-wrap break-all rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white p-3 font-mono text-[0.72rem] leading-[1.45]">
                    {formatJson(value)}
                  </pre>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function VendorApiLogsPanel() {
  const [items, setItems] = useState<LosVendorApiLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LOS_TABLE_PAGE_SIZE);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<SortState<SortKey>>({ key: 'requestedAt', dir: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<LosVendorApiLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const setColumnFilter = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => {
      if (!value.trim()) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
    setPage(1);
  }, []);

  const clearColumnFilters = useCallback(() => {
    setColumnFilters({});
    setSort({ key: 'requestedAt', dir: 'desc' });
    setPage(1);
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: 'requestedAt', dir: 'desc' };
    });
    setPage(1);
  }, []);

  const debouncedFilters = useDebouncedValue(columnFilters, 300);

  const load = useCallback(async () => {
    const token = getLosToken();
    if (!token) {
      setError('Session expired - please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listVendorApiLogs(token, {
        page,
        pageSize,
        sortBy: sort?.key ?? 'requestedAt',
        sortDir: sort?.dir ?? 'desc',
        providerName: debouncedFilters.providerName,
        serviceName: debouncedFilters.serviceName,
        requestMethod: debouncedFilters.requestMethod,
        httpStatus: debouncedFilters.httpStatus,
        id: debouncedFilters.id,
        leadId: debouncedFilters.leadId,
        applicationNumber: debouncedFilters.applicationNumber,
        requestPath: debouncedFilters.requestPath,
        outcome: debouncedFilters.outcome,
        requestedFrom: debouncedFilters.requestedFrom,
        requestedTo: debouncedFilters.requestedTo,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setError(null);
      if (res.page !== page) setPage(res.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor API logs.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sort, debouncedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(row: LosVendorApiLogListItem) {
    const token = getLosToken();
    if (!token) {
      setDetailError('Session expired - please log in again.');
      setDetailOpen(true);
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const full = await getVendorApiLog(token, row.uuid);
      setDetail(full);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  const range = useMemo(() => {
    if (total === 0) return { start: 0, end: 0 };
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return { start, end };
  }, [page, pageSize, total]);

  const filtersActive = hasActiveColumnFilters(columnFilters);

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(23,44,113,0.07)] px-4 py-3">
          <div>
            <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.02em]">Vendor API logs</h2>
            <p className="m-0 mt-0.5 text-[0.8rem] text-brand-muted">
              Audited outbound vendor calls from <code className="text-[0.75rem]">vendor_api_log</code>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filtersActive ? (
              <button
                type="button"
                onClick={clearColumnFilters}
                className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text hover:bg-[rgba(20,150,243,0.05)]"
              >
                Clear filters
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-3 text-[0.8rem] font-bold text-brand-text hover:bg-[rgba(20,150,243,0.05)]"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-6">
            <p className="m-0 text-[0.9rem] font-bold text-[rgb(185,28,28)]">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-[32px] cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] px-3 text-[0.8rem] font-bold"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left text-[0.84rem]">
              <thead className="sticky top-0 z-[1] bg-[rgba(248,250,255,0.96)]">
                <tr className="border-b border-[rgba(23,44,113,0.08)]">
                  <th className="px-3 py-2 align-bottom">
                    <DataTableColumnHeader label="Log ID" sortKey="id" sort={sort} onSort={toggleSort}>
                      <DataTableColumnFilter
                        type="number"
                        value={columnFilters.id ?? ''}
                        onChange={(value) => setColumnFilter('id', value)}
                        placeholder="Log id…"
                        aria-label="Filter log id"
                      />
                    </DataTableColumnHeader>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
                      Application ID
                    </span>
                    <DataTableColumnFilter
                      value={columnFilters.applicationNumber ?? ''}
                      onChange={(value) => setColumnFilter('applicationNumber', value)}
                      placeholder="App id…"
                      aria-label="Filter application id"
                    />
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <DataTableColumnHeader label="Lead ID" sortKey="leadId" sort={sort} onSort={toggleSort}>
                      <DataTableColumnFilter
                        type="number"
                        value={columnFilters.leadId ?? ''}
                        onChange={(value) => setColumnFilter('leadId', value)}
                        placeholder="Lead id…"
                        aria-label="Filter lead id"
                      />
                    </DataTableColumnHeader>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <DataTableColumnHeader
                      label="Requested"
                      sortKey="requestedAt"
                      sort={sort}
                      onSort={toggleSort}
                    >
                      <div className="mt-1.5 grid gap-1">
                        <DataTableColumnFilter
                          type="date"
                          value={columnFilters.requestedFrom ?? ''}
                          onChange={(value) => setColumnFilter('requestedFrom', value)}
                          aria-label="Requested from"
                        />
                        <DataTableColumnFilter
                          type="date"
                          value={columnFilters.requestedTo ?? ''}
                          onChange={(value) => setColumnFilter('requestedTo', value)}
                          aria-label="Requested to"
                        />
                      </div>
                    </DataTableColumnHeader>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <DataTableColumnHeader label="Provider" sortKey="providerName" sort={sort} onSort={toggleSort}>
                      <DataTableColumnFilter
                        value={columnFilters.providerName ?? ''}
                        onChange={(value) => setColumnFilter('providerName', value)}
                        placeholder="Provider…"
                        aria-label="Filter provider"
                      />
                    </DataTableColumnHeader>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <DataTableColumnHeader label="Service" sortKey="serviceName" sort={sort} onSort={toggleSort}>
                      <DataTableColumnFilter
                        value={columnFilters.serviceName ?? ''}
                        onChange={(value) => setColumnFilter('serviceName', value)}
                        placeholder="Service…"
                        aria-label="Filter service"
                      />
                    </DataTableColumnHeader>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <DataTableColumnHeader label="Method" sortKey="requestMethod" sort={sort} onSort={toggleSort}>
                      <DataTableColumnFilter
                        type="select"
                        value={columnFilters.requestMethod ?? ''}
                        onChange={(value) => setColumnFilter('requestMethod', value)}
                        options={METHOD_OPTIONS}
                        aria-label="Filter method"
                      />
                    </DataTableColumnHeader>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <DataTableColumnHeader label="HTTP" sortKey="httpStatus" sort={sort} onSort={toggleSort}>
                      <DataTableColumnFilter
                        type="number"
                        value={columnFilters.httpStatus ?? ''}
                        onChange={(value) => setColumnFilter('httpStatus', value)}
                        placeholder="Status…"
                        aria-label="Filter HTTP status"
                      />
                    </DataTableColumnHeader>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
                      Outcome
                    </span>
                    <DataTableColumnFilter
                      type="select"
                      value={columnFilters.outcome ?? ''}
                      onChange={(value) => setColumnFilter('outcome', value)}
                      options={OUTCOME_OPTIONS}
                      aria-label="Filter outcome"
                    />
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
                      Path
                    </span>
                    <DataTableColumnFilter
                      value={columnFilters.requestPath ?? ''}
                      onChange={(value) => setColumnFilter('requestPath', value)}
                      placeholder="Path…"
                      aria-label="Filter path"
                    />
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
                      Ms
                    </span>
                  </th>
                  <th className="px-3 py-2 align-bottom">
                    <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
                      Detail
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-brand-muted">
                      Loading logs…
                    </td>
                  </tr>
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-brand-muted">
                      No vendor API logs match the current filters.
                    </td>
                  </tr>
                ) : null}
                {items.map((row) => (
                  <tr
                    key={row.uuid}
                    className="border-b border-[rgba(23,44,113,0.06)] hover:bg-[rgba(20,150,243,0.03)]"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.78rem] font-bold">
                      {row.id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.78rem]">
                      {row.applicationUuid && row.applicationNumber ? (
                        <Link
                          href={`/applications/${row.applicationUuid}`}
                          className="font-semibold text-brand-blue no-underline hover:underline"
                          title={row.applicationNumber}
                        >
                          {formatApplicationDisplayId(row.applicationNumber)}
                        </Link>
                      ) : row.applicationNumber ? (
                        formatApplicationDisplayId(row.applicationNumber)
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.78rem]">
                      {row.leadId ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">
                      {formatDateTime(row.requestedAt)}
                    </td>
                    <td className="px-3 py-2.5 font-bold">{row.providerName}</td>
                    <td className="px-3 py-2.5">{row.serviceName}</td>
                    <td className="px-3 py-2.5 font-mono text-[0.78rem]">{row.requestMethod}</td>
                    <td className="px-3 py-2.5 font-mono">{row.httpStatus ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <OutcomeBadge outcome={row.outcome} />
                    </td>
                    <td className="max-w-[240px] px-3 py-2.5" title={row.requestPath ?? undefined}>
                      <span className="font-mono text-[0.72rem] text-brand-muted">{truncatePath(row.requestPath)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.78rem]">{row.durationMs}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => void openDetail(row)}
                        className="cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.14)] bg-transparent px-2.5 py-1 text-[0.75rem] font-bold text-brand-blue hover:bg-[rgba(20,150,243,0.06)]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DataTablePagination
          page={page}
          total={totalPages}
          start={range.start}
          end={range.end}
          count={total}
          entityLabel="logs"
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {detailOpen ? (
        <DetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetailOpen(false)}
        />
      ) : null}
    </>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
