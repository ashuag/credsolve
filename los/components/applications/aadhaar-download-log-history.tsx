'use client';

import { ReviewSectionLabel } from '@/components/applications/review/application-review-ui';
import { formatReviewDateTime } from '@/lib/application-review-format';
import {
  getVendorApiLog,
  type LosApplicationDetails,
  type LosVendorApiLogDetail,
} from '@/lib/api';
import { useEffect, useState } from 'react';

type AadhaarDownloadLogRow = NonNullable<LosApplicationDetails['aadhaarDownloadLogs']>[number];

const COLUMNS = ['#', 'When', 'Provider', 'API', 'HTTP', 'Outcome', 'Message', ''] as const;

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
      className={
        ok
          ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-extrabold uppercase tracking-[0.06em] text-emerald-800'
          : 'inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[0.7rem] font-extrabold uppercase tracking-[0.06em] text-rose-800'
      }
    >
      {ok ? 'OK' : 'Fail'}
    </span>
  );
}

function VendorLogDetailModal({
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
      aria-label="Aadhaar download log detail"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[20px] border border-[rgba(23,44,113,0.12)] shadow-[0_28px_70px_rgba(23,44,113,0.22)]"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.99), rgba(241,247,255,0.96))' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(23,44,113,0.08)] px-6 py-5">
          <div>
            <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-brand-blue">
              Aadhaar download log
            </span>
            <h2 className="m-0 text-[1.2rem] font-extrabold leading-[1.15] tracking-[-0.03em]">
              {detail ? `${detail.providerName} / ${detail.serviceName}` : 'Loading…'}
            </h2>
            {detail ? (
              <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
                Log #{detail.id}
                {' · '}
                {detail.requestMethod} · HTTP {detail.httpStatus ?? '—'} · {formatReviewDateTime(detail.requestedAt)}
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
                  <span className="font-bold text-brand-muted">Request path</span>
                  <p className="m-0 mt-0.5 break-all font-mono text-[0.78rem]">{detail.requestPath ?? '—'}</p>
                </div>
                <div>
                  <span className="font-bold text-brand-muted">Duration</span>
                  <p className="m-0 mt-0.5 font-bold">{detail.durationMs} ms</p>
                </div>
              </div>
              {(
                [
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

function LogHistoryTable({
  logs,
  authToken,
}: {
  logs: AadhaarDownloadLogRow[];
  authToken: string | null;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<LosVendorApiLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function openDetail(row: AadhaarDownloadLogRow) {
    if (!authToken) {
      setDetailError('Session expired — please log in again.');
      setDetailOpen(true);
      return;
    }
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setDetail(await getVendorApiLog(authToken, row.uuid));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load log detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-[10px] border border-[rgba(23,44,113,0.1)]">
        <table className="w-full min-w-[720px] border-collapse text-[0.84rem]">
          <thead>
            <tr className="bg-[rgba(23,44,113,0.05)]">
              {COLUMNS.map((label) => (
                <th
                  key={label || 'view'}
                  className="border-b border-[rgba(23,44,113,0.08)] px-3 py-2 text-left text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted whitespace-nowrap"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((row, index) => (
              <tr
                key={row.uuid}
                className={row.outcome === 'success' ? 'bg-emerald-50/80' : 'bg-rose-50/80'}
              >
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-extrabold text-brand-navy whitespace-nowrap">
                  {logs.length - index}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text whitespace-nowrap">
                  {formatReviewDateTime(row.respondedAt || row.requestedAt)}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text whitespace-nowrap">
                  {row.providerName}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text whitespace-nowrap">
                  {row.serviceName}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-mono font-bold text-brand-navy whitespace-nowrap">
                  {row.httpStatus ?? '—'}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 whitespace-nowrap">
                  <OutcomeBadge outcome={row.outcome} />
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text">
                  {row.errorMessage || '—'}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => void openDetail(row)}
                    className="cursor-pointer rounded-[8px] border border-[rgba(23,44,113,0.12)] bg-white px-2.5 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.06em] text-brand-blue"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detailOpen ? (
        <VendorLogDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetailOpen(false)}
        />
      ) : null}
    </>
  );
}

export function AadhaarDownloadLogHistory({
  logs,
  authToken,
  variant = 'overview',
}: {
  logs: LosApplicationDetails['aadhaarDownloadLogs'];
  authToken: string | null;
  variant?: 'overview' | 'review';
}) {
  const rows = logs ?? [];
  if (rows.length === 0) return null;

  if (variant === 'review') {
    return (
      <div style={{ marginTop: 16 }}>
        <ReviewSectionLabel>Aadhaar download logs</ReviewSectionLabel>
        <LogHistoryTable logs={rows} authToken={authToken} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[0.82rem] font-extrabold text-brand-navy">Aadhaar download logs</span>
        <span className="text-[0.76rem] font-semibold text-brand-muted">
          {rows.length} call{rows.length === 1 ? '' : 's'}
        </span>
      </div>
      <LogHistoryTable logs={rows} authToken={authToken} />
    </div>
  );
}
