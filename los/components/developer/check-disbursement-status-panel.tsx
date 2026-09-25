'use client';

import {
  runCheckDisbursementStatus,
  type LosCheckDisbursementStatusResult,
  type LosCheckDisbursementStatusRow,
} from '@/lib/api';
import { FormEvent, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

const INPUT_CLASS =
  'rounded-[10px] border border-[rgba(15,39,72,0.12)] px-3 py-2 text-[0.88rem] font-normal';

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function apiStatusTone(row: LosCheckDisbursementStatusRow): string {
  const status = (row.apiStatus ?? '').toLowerCase();
  if (!row.apiHttpOk) return 'text-[#b91c1c]';
  if (status === 'success' || status === 'successful') return 'text-[#047857]';
  if (status === 'failure' || status === 'failed' || status === 'rejected') return 'text-[#b91c1c]';
  if (status === 'pending' || status === 'queued' || status === 'initiated' || status === 'processing') {
    return 'text-[#b45309]';
  }
  return 'text-brand-navy';
}

export function CheckDisbursementStatusPanel() {
  const [mode, setMode] = useState<'dates' | 'application'>('dates');
  const [applicationNumber, setApplicationNumber] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<LosCheckDisbursementStatusResult | null>(null);
  const [openBody, setOpenBody] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRequestError(null);
    setResult(null);
    setOpenBody(null);

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    if (mode === 'application') {
      const ids = applicationNumber.trim();
      if (!ids) {
        setRequestError('Enter one or more application IDs, comma-separated.');
        return;
      }
      if (/\s/.test(ids)) {
        setRequestError('Spaces are not allowed. Use comma-separated application IDs.');
        return;
      }
      if (ids.split(',').filter(Boolean).length === 0) {
        setRequestError('Enter one or more application IDs, comma-separated.');
        return;
      }
    }
    if (mode === 'dates' && (!fromDate || !toDate)) {
      setRequestError('Enter both from and to dates.');
      return;
    }

    setLoading(true);
    try {
      const response = await runCheckDisbursementStatus(
        token,
        mode === 'application'
          ? { applicationNumber: applicationNumber.trim() }
          : { fromDate, toDate },
      );
      setResult(response);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Check disbursement status failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Finds disbursed loans that are still unpaid (not closed), then reads the stored Easebuzz{' '}
        <code className="font-mono text-[0.8rem]">quick-transfer-initiate</code> response from{' '}
        <code className="font-mono text-[0.8rem]">vendor_api_log</code>. The envelope can be{' '}
        <code className="font-mono text-[0.8rem]">success: true</code> while{' '}
        <code className="font-mono text-[0.8rem]">transfer_request.status</code> is failure — check
        the JSON first, then the API status. Filter by date range or comma-separated application
        IDs (no spaces). No loan record is updated.
      </p>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-[16px] border border-[rgba(15,39,72,0.1)] bg-white p-5"
      >
        <div className="flex flex-wrap gap-4 text-[0.84rem] font-bold text-brand-navy">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="filter-mode"
              checked={mode === 'dates'}
              onChange={() => setMode('dates')}
            />
            Date range
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="filter-mode"
              checked={mode === 'application'}
              onChange={() => setMode('application')}
            />
            Application IDs
          </label>
        </div>

        {mode === 'dates' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
              From (disbursed)
              <input
                type="date"
                required={mode === 'dates'}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
              To (disbursed)
              <input
                type="date"
                required={mode === 'dates'}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        ) : (
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            Application IDs
            <input
              type="text"
              required={mode === 'application'}
              maxLength={1200}
              value={applicationNumber}
              onChange={(e) => setApplicationNumber(e.target.value.replace(/\s+/g, '').slice(0, 1200))}
              onKeyDown={(e) => {
                if (e.key === ' ') e.preventDefault();
              }}
              className={`${INPUT_CLASS} font-mono tracking-wide`}
              placeholder="APP2026TSVP8,APP2026ABCD1"
              spellCheck={false}
              autoComplete="off"
            />
            <span className="text-[0.72rem] font-semibold text-brand-muted">
              Comma-separated, no spaces.
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Check disbursement status'}
        </button>
      </form>

      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      {result ? (
        <div className="grid gap-3">
          {!result.configured ? (
            <p className="m-0 rounded-[12px] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] px-3 py-2.5 text-[0.86rem] font-bold text-[#92400e]">
              {result.skipReason ?? 'Easebuzz Wire is not configured.'}
            </p>
          ) : null}

          <p className="m-0 text-[0.84rem] text-brand-muted">
            {result.matched === 0
              ? 'No matching unpaid disbursed loans.'
              : `${result.matched} loan${result.matched === 1 ? '' : 's'} checked.`}
            {result.truncated ? ' Showing the first 40.' : ''}
          </p>

          {result.rows.length > 0 ? (
            <div className="overflow-x-auto rounded-[14px] border border-[rgba(15,39,72,0.1)] bg-white">
              <table className="w-full min-w-[720px] border-collapse text-left text-[0.82rem]">
                <thead>
                  <tr className="border-b border-[rgba(15,39,72,0.08)] bg-[rgba(248,250,255,0.9)] text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                    <th className="px-3 py-2">Application ID</th>
                    <th className="px-3 py-2">UTR</th>
                    <th className="px-3 py-2">Loan status</th>
                    <th className="px-3 py-2">API status</th>
                    <th className="px-3 py-2">Response</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => {
                    const utr = row.apiUtr || row.storedUtr;
                    const key = row.applicationUuid;
                    return (
                      <tr key={key} className="border-b border-[rgba(15,39,72,0.06)] align-top">
                        <td className="px-3 py-2">
                          <div className="font-extrabold text-brand-navy">{row.applicationNumber}</div>
                          <div className="mt-0.5 text-[0.72rem] text-brand-muted">
                            {formatDateTime(row.disbursedAt)} · ₹{row.netDisbursedAmount}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[0.78rem]">{utr ?? '—'}</td>
                        <td className="px-3 py-2 font-bold text-brand-navy">{row.loanStatusLabel}</td>
                        <td className={cx('px-3 py-2 font-extrabold', apiStatusTone(row))}>
                          {!row.apiHttpOk
                            ? 'No response'
                            : (row.apiStatus ?? row.apiMessage ?? '—')}
                          {row.apiHttpOk && row.apiFailureReason ? (
                            <div className="mt-0.5 text-[0.72rem] font-semibold text-[#b91c1c]">
                              {row.apiFailureReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="cursor-pointer rounded-[8px] border border-[rgba(15,39,72,0.14)] bg-transparent px-2 py-1 text-[0.72rem] font-bold text-brand-navy"
                            onClick={() => setOpenBody((prev) => (prev === key ? null : key))}
                          >
                            {openBody === key ? 'Hide' : 'Show'} JSON
                          </button>
                          {openBody === key ? (
                            <pre className="mt-2 max-h-[280px] overflow-auto rounded-[10px] bg-[rgba(248,250,255,0.9)] p-2 text-[0.7rem] leading-[1.4] text-brand-text">
                              {JSON.stringify(row.vendorBody, null, 2)}
                            </pre>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
