'use client';

import { runPreApprovedOfferCheck, type PreApprovedOfferDryRunResult } from '@/lib/api';
import { FormEvent, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

function formatInr(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function PreApprovedOfferPanel() {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PreApprovedOfferDryRunResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setParseError(null);
    setRequestError(null);
    setResult(null);

    let bureauPayload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParseError('Bureau JSON must be a JSON object (Tenacio vendor response envelope).');
        return;
      }
      bureauPayload = parsed as Record<string, unknown>;
    } catch {
      setParseError('Invalid JSON. Paste the full bureau API response body.');
      return;
    }

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      setResult(await runPreApprovedOfferCheck(token, { bureauPayload }));
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Pre-approved offer check failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Paste bureau JSON to see each unsecured account (open and closed), total exposure, the matching credit-limit
        tier, and pre-approved offer (same logic as customer loan eligibility after bureau pull).
      </p>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
          Bureau JSON
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={14}
            className="font-mono rounded-[12px] border border-[rgba(23,44,113,0.12)] bg-[rgba(248,250,255,0.9)] p-3 text-[0.78rem] leading-[1.45]"
            placeholder='{ "data": { "cibilData": { ... } } }'
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? 'Calculating…' : 'Check pre-approved offer'}
        </button>
      </form>

      {parseError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{parseError}</p> : null}
      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      {result ? (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[14px] border border-[rgba(20,150,243,0.2)] bg-[rgba(20,150,243,0.06)] p-4">
              <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                CIBIL / bureau score
              </p>
              <p className="m-0 mt-1 text-[2rem] font-extrabold leading-none text-brand-navy">
                {result.cibilScore ?? 'N/A'}
              </p>
            </div>
            <div
              className={cx(
                'rounded-[14px] border p-4',
                result.preApprovedAmountInr != null
                  ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]'
                  : 'border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.05)]',
              )}
            >
              <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Pre-approved offer
              </p>
              <p className="m-0 mt-1 text-[1.35rem] font-extrabold text-brand-navy">
                {formatInr(result.preApprovedAmountInr)}
              </p>
              <p className="m-0 mt-1 text-[0.78rem] text-brand-muted">
                Product bounds: {formatInr(result.minLoanAmountInr)} – {formatInr(result.maxLoanAmountInr)}
              </p>
            </div>
          </div>

          <section className="rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-4">
            <h3 className="m-0 text-[0.8rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
              Unsecured exposure
            </h3>
            <p className="m-0 mt-2 text-[0.78rem] leading-[1.5] text-brand-muted">
              Tier lookup uses the <strong className="font-bold text-brand-navy">sum of all unsecured</strong>{' '}
              tradelines (open and closed), not open-only and not the largest single account.
            </p>
            <dl className="m-0 mt-3 grid gap-2 text-[0.84rem] sm:grid-cols-3">
              <div className="rounded-[10px] bg-[rgba(20,150,243,0.06)] p-3">
                <dt className="font-bold text-brand-muted">Total unsecured (tier driver)</dt>
                <dd className="m-0 mt-1 text-[1.1rem] font-extrabold text-brand-navy">
                  {formatInr(result.totalUnsecuredExposureInr)}
                </dd>
              </div>
              <div className="rounded-[10px] bg-[rgba(248,250,255,0.9)] p-3">
                <dt className="font-bold text-brand-muted">Total open unsecured</dt>
                <dd className="m-0 mt-1 text-[1.1rem] font-extrabold text-brand-navy">
                  {formatInr(result.totalOpenUnsecuredExposureInr)}
                </dd>
              </div>
              <div className="rounded-[10px] bg-[rgba(248,250,255,0.9)] p-3">
                <dt className="font-bold text-brand-muted">Max single open</dt>
                <dd className="m-0 mt-1 text-[1.1rem] font-extrabold text-brand-navy">
                  {formatInr(result.maxOpenUnsecuredExposureInr)}
                </dd>
              </div>
            </dl>

            {result.openUnsecuredTradelines.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-[0.8rem]">
                  <thead>
                    <tr className="border-b border-[rgba(23,44,113,0.12)] text-[0.7rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
                      <th className="py-2 pr-3">Lender</th>
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3 whitespace-nowrap">Opened</th>
                      <th className="py-2 pr-3 whitespace-nowrap">Closed</th>
                      <th className="py-2 pr-3 text-right">Exposure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.openUnsecuredTradelines.map((row, idx) => (
                      <tr
                        key={`${row.creditorName}-${row.accountNumber}-${idx}`}
                        className="border-b border-[rgba(23,44,113,0.06)]"
                      >
                        <td className="py-2.5 pr-3 font-semibold text-brand-navy">{row.creditorName}</td>
                        <td className="py-2.5 pr-3 font-mono text-[0.75rem] text-brand-text">{row.accountNumber}</td>
                        <td className="py-2.5 pr-3 text-brand-text">{row.accountTypeLabel}</td>
                        <td className="py-2.5 pr-3 text-brand-text">{row.isOpen ? 'Open' : 'Closed'}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-brand-text">
                          {row.dateOpened ?? '—'}
                        </td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-brand-text">
                          {row.dateClosed ?? '—'}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-brand-navy">
                          {formatInr(row.exposureInr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold text-brand-navy">
                      <td className="pt-3 pr-3" colSpan={6}>
                        Total ({result.openUnsecuredTradelines.length} account
                        {result.openUnsecuredTradelines.length === 1 ? '' : 's'})
                      </td>
                      <td className="pt-3 pr-3 text-right">{formatInr(result.totalUnsecuredExposureInr)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="m-0 mt-3 text-[0.84rem] font-semibold text-brand-muted">
                No unsecured tradelines found in bureau JSON.
              </p>
            )}
          </section>

          <dl className="m-0 grid gap-2 rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-4 text-[0.84rem]">
            {result.tier ? (
              <>
                <div className="grid grid-cols-[minmax(140px,42%)_1fr] gap-2">
                  <dt className="font-bold text-brand-muted">Matched tier</dt>
                  <dd className="m-0 font-semibold text-brand-navy">#{result.tier.tierId}</dd>
                </div>
                <div className="grid grid-cols-[minmax(140px,42%)_1fr] gap-2">
                  <dt className="font-bold text-brand-muted">Unsecured band (INR)</dt>
                  <dd className="m-0 font-semibold text-brand-navy">
                    {formatInr(result.tier.minUnsecuredLoan)} –{' '}
                    {result.tier.maxUnsecuredLoan != null ? formatInr(result.tier.maxUnsecuredLoan) : 'no max'}
                  </dd>
                </div>
                <div className="grid grid-cols-[minmax(140px,42%)_1fr] gap-2">
                  <dt className="font-bold text-brand-muted">Tier max bullet loan</dt>
                  <dd className="m-0 font-semibold text-brand-navy">{formatInr(result.tier.maxBulletLoan)}</dd>
                </div>
              </>
            ) : null}
            <div className="grid grid-cols-[minmax(140px,42%)_1fr] gap-2">
              <dt className="font-bold text-brand-muted">Detail</dt>
              <dd className="m-0 text-brand-text">{result.detail}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
