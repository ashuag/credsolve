'use client';

import { runGetPaymentStatus, type LosGetPaymentStatusResult } from '@/lib/api';
import { FormEvent, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

const INPUT_CLASS =
  'rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal';

export function GetPaymentStatusPanel() {
  const [txnid, setTxnid] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<LosGetPaymentStatusResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRequestError(null);
    setResult(null);

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    const trimmed = txnid.trim();
    if (!trimmed) {
      setRequestError('Enter a merchant txnid.');
      return;
    }

    setLoading(true);
    try {
      const response = await runGetPaymentStatus(token, { txnid: trimmed });
      setResult(response);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Get payment status failed.');
    } finally {
      setLoading(false);
    }
  }

  const succeeded = result != null && result.configured && result.ok;

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Live Easebuzz Transaction V2.1 retrieve. Paste the merchant{' '}
        <code className="font-mono text-[0.8rem]">txnid</code> from a Pay Now attempt (stored on{' '}
        <code className="font-mono text-[0.8rem]">loan_repayment.vendor_ref</code>). The call is
        audited in <code className="font-mono text-[0.8rem]">vendor_api_log</code>; no loan or
        repayment record is created or updated.
      </p>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5"
      >
        <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
          Merchant txnid
          <input
            type="text"
            required
            maxLength={40}
            value={txnid}
            onChange={(e) => setTxnid(e.target.value.slice(0, 40))}
            className={`${INPUT_CLASS} font-mono tracking-wide`}
            placeholder="MCASH1234172551234567"
          />
        </label>

        <button
          type="submit"
          disabled={loading || !txnid.trim()}
          className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? 'Retrieving…' : 'Get payment status'}
        </button>
      </form>

      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      {result ? (
        <div
          className={cx(
            'rounded-[14px] border px-4 py-4',
            succeeded
              ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]'
              : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]',
          )}
        >
          <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
            {result.vendor} result
          </p>
          <p className="m-0 mt-1 text-[1.15rem] font-extrabold text-brand-navy">
            {!result.configured
              ? 'Not configured'
              : result.ok
                ? 'Payment success'
                : (result.status ?? result.message ?? 'Not success')}
          </p>

          <dl className="m-0 mt-3 grid gap-x-6 gap-y-1 text-[0.82rem] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Status</dt>
              <dd className="m-0 font-mono">{result.status ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Amount</dt>
              <dd className="m-0 font-mono">{result.amount ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">txnid</dt>
              <dd className="m-0 font-mono">{result.txnid || '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">easepayid</dt>
              <dd className="m-0 font-mono">{result.easepayid ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Bank ref</dt>
              <dd className="m-0 font-mono">{result.bankRef ?? '—'}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="font-bold text-brand-muted">Retrieve URL</dt>
              <dd className="m-0 break-all font-mono">{result.retrieveUrl ?? '—'}</dd>
            </div>
          </dl>

          {result.skipReason ? (
            <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-brand-text">{result.skipReason}</p>
          ) : null}
          {result.message && result.configured ? (
            <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-[#991b1b]">{result.message}</p>
          ) : null}

          {result.vendorBody != null ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-[0.82rem] font-bold text-brand-navy">
                Vendor response body
              </summary>
              <pre className="mt-2 max-h-[480px] overflow-auto rounded-[10px] bg-[rgba(248,250,255,0.9)] p-3 text-[0.72rem] leading-[1.4] text-brand-text">
                {JSON.stringify(result.vendorBody, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
