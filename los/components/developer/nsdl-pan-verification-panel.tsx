'use client';

import { runNsdlPanVerification, type LosNsdlPanVerificationResult } from '@/lib/api';
import { FormEvent, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';

const INPUT_CLASS =
  'rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal';

export function NsdlPanVerificationPanel() {
  const [panNumber, setPanNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<LosNsdlPanVerificationResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setRequestError(null);
    setResult(null);

    const token = getLosToken();
    if (!token) {
      setRequestError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    try {
      const response = await runNsdlPanVerification(token, {
        panNumber: panNumber.trim().toUpperCase(),
        fullName: fullName.trim(),
        dateOfBirth,
        consent,
      });
      setResult(response);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'NSDL PAN verification failed.');
    } finally {
      setLoading(false);
    }
  }

  const succeeded = result != null && result.configured && result.ok;

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Live Tenacio NSDL PAN name and date-of-birth check. The call is audited in{' '}
        <code className="font-mono text-[0.8rem]">vendor_api_log</code>; no lead or PAN status
        record is created or updated.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            PAN number
            <input
              type="text"
              required
              maxLength={10}
              pattern="[A-Za-z]{5}\d{4}[A-Za-z]"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
              className={`${INPUT_CLASS} font-mono tracking-wide`}
              placeholder="ABCDE1234F"
            />
          </label>
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            Date of birth
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy md:col-span-2">
            Full name (as per PAN)
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Rahul Sharma"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-[0.84rem] font-bold text-brand-navy">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Customer consent for NSDL PAN verification
        </label>

        <button
          type="submit"
          disabled={loading || !consent}
          className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? 'Verifying…' : 'Run NSDL PAN verification'}
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
                ? 'PAN verified'
                : result.panVerifiedLabel}
          </p>

          <dl className="m-0 mt-3 grid gap-x-6 gap-y-1 text-[0.82rem] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">HTTP status</dt>
              <dd className="m-0 font-mono">{result.httpStatus ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Structure check</dt>
              <dd className="m-0">{result.structureValid ? 'Passed' : 'Failed'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">PAN status</dt>
              <dd className="m-0">{result.panStatus ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Category</dt>
              <dd className="m-0">{result.category ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Name match</dt>
              <dd className="m-0">{result.nameMatch ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">DOB match</dt>
              <dd className="m-0">{result.dobMatch ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="font-bold text-brand-muted">Request ID</dt>
              <dd className="m-0 font-mono">{result.vendorRequestId ?? '—'}</dd>
            </div>
          </dl>

          {result.structureNote ? (
            <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-brand-text">
              Structure: {result.structureNote}
            </p>
          ) : null}
          {result.skipReason ? (
            <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-brand-text">{result.skipReason}</p>
          ) : null}
          {result.note ? (
            <p className="m-0 mt-2 text-[0.86rem] leading-[1.5] text-[#991b1b]">{result.note}</p>
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
