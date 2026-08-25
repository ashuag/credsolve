'use client';

import { FormEvent, useState } from 'react';
import { cx, getLosToken } from '@/components/eligibility/eligibility-ui';
import { runNameMatchFuzzScore, type LosNameMatchFuzzScoreResult } from '@/lib/api';

const INPUT_CLASS =
  'rounded-[10px] border border-[rgba(23,44,113,0.12)] px-3 py-2 text-[0.88rem] font-normal';

function outcomeTone(outcome: LosNameMatchFuzzScoreResult['outcome']) {
  if (outcome === 'auto_pass') {
    return 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)]';
  }
  if (outcome === 'under_review') {
    return 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)]';
  }
  return 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.05)]';
}

function outcomeLabel(outcome: LosNameMatchFuzzScoreResult['outcome']) {
  if (outcome === 'auto_pass') return 'Would auto-pass';
  if (outcome === 'under_review') return 'Would stay In Review (Bank details)';
  return 'Missing name';
}

export function NameMatchFuzzScorePanel() {
  const [customerName, setCustomerName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<LosNameMatchFuzzScoreResult | null>(null);

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
      const response = await runNameMatchFuzzScore(token, {
        customerName: customerName.trim(),
        bankAccountName: bankAccountName.trim(),
      });
      setResult(response);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Name match fuzzing score failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.88rem] leading-[1.55] text-brand-muted">
        Dry-run the same 0–100 fuzzing score used after penny-drop: honorifics (Mr / Ms / Mrs /
        Miss) are stripped, token order is ignored, and the score is compared with{' '}
        <code className="font-mono text-[0.8rem]">PENNY_DROP_NAME_MATCH_MIN_SCORE</code> (max 100%).
        Below the threshold the application stays In Review at Bank details until credit
        approves. No vendor call and no lead records are updated.
      </p>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-white p-5"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            Customer name
            <input
              type="text"
              required
              minLength={1}
              maxLength={160}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Saurabh Agarwal"
            />
          </label>
          <label className="grid gap-1.5 text-[0.8rem] font-bold text-brand-navy">
            Bank account name
            <input
              type="text"
              required
              minLength={1}
              maxLength={160}
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Mr SAURABH KUMAR AGARWAL"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-fit cursor-pointer rounded-[12px] bg-brand-blue px-5 py-2.5 text-[0.88rem] font-extrabold text-white disabled:opacity-60"
        >
          {loading ? 'Scoring…' : 'Compute fuzzing score'}
        </button>
      </form>

      {requestError ? <p className="m-0 text-[0.84rem] font-bold text-[#991b1b]">{requestError}</p> : null}

      {result ? (
        <div className={cx('rounded-[14px] border px-4 py-4', outcomeTone(result.outcome))}>
          <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
            Name match fuzzing score
          </p>
          <p className="m-0 mt-1 text-[2rem] font-extrabold leading-none text-brand-navy">
            {result.score}%
          </p>
          <p className="m-0 mt-2 text-[1.05rem] font-extrabold text-brand-navy">
            {outcomeLabel(result.outcome)}
          </p>
          <p className="m-0 mt-1 text-[0.86rem] leading-[1.5] text-brand-text">{result.note}</p>

          <dl className="m-0 mt-3 grid gap-x-6 gap-y-1 text-[0.82rem] sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Token match</dt>
              <dd className="m-0">{result.tokenMatch ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-brand-muted">Min score</dt>
              <dd className="m-0 font-mono">{result.minScore}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="font-bold text-brand-muted">Normalized customer</dt>
              <dd className="m-0 font-mono">{result.normalizedCustomerName || '—'}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="font-bold text-brand-muted">Normalized bank</dt>
              <dd className="m-0 font-mono">{result.normalizedBankAccountName || '—'}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="font-bold text-brand-muted">Stripped customer</dt>
              <dd className="m-0">{result.strippedCustomerName || '—'}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="font-bold text-brand-muted">Stripped bank</dt>
              <dd className="m-0">{result.strippedBankAccountName || '—'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
