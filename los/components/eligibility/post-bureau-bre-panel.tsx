'use client';

import { PostBreInspectionSections } from '@/components/developer/post-bre-inspection-views';
import {
  runPostBureauBreCheck,
  type PostBreDryRunResult,
  type PostBreRuleCheck,
  type PostBreRuleFinding,
} from '@/lib/api';
import { FormEvent, useState } from 'react';
import { cx, getLosToken } from './eligibility-ui';

function FindingDataTable({ data }: { data: Record<string, string | number | boolean | null> }) {
  const entries = Object.entries(data).filter(([, value]) => value !== null && value !== '');
  if (!entries.length) return null;

  return (
    <dl className="m-0 mt-2 grid gap-1.5 rounded-[8px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.85)] p-2.5">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(100px,38%)_1fr] gap-2 text-[0.75rem]">
          <dt className="m-0 font-mono text-brand-muted">{key}</dt>
          <dd className="m-0 break-words font-semibold text-brand-navy">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function FindingBlock({ finding, index }: { finding: PostBreRuleFinding; index: number }) {
  return (
    <li className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-white p-3">
      <p className="m-0 text-[0.8rem] font-extrabold text-brand-navy">
        {index + 1}. {finding.title}
      </p>
      {finding.detail ? (
        <p className="m-0 mt-1 text-[0.78rem] leading-[1.45] text-brand-text">{finding.detail}</p>
      ) : null}
      {finding.data ? <FindingDataTable data={finding.data} /> : null}
    </li>
  );
}

function CheckCard({ check }: { check: PostBreRuleCheck }) {
  const isInfo = check.id === 'bureau_score_present';
  const hasFindings = Boolean(check.findings?.length);
  const showDrillDown = hasFindings && (!check.passed || isInfo);
  const [expanded, setExpanded] = useState(!check.passed && hasFindings);

  return (
    <article
      className={cx(
        'rounded-[14px] border p-4',
        check.passed && !isInfo
          ? 'border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.04)]'
          : isInfo
            ? 'border-[rgba(20,150,243,0.18)] bg-[rgba(20,150,243,0.04)]'
            : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.04)]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[0.95rem] font-extrabold tracking-[-0.02em] text-brand-navy">{check.label}</h3>
          <p className="m-0 mt-0.5 font-mono text-[0.68rem] text-brand-muted">{check.id}</p>
        </div>
        {isInfo ? (
          <span className="inline-flex rounded-full bg-[rgba(20,150,243,0.1)] px-2.5 py-0.5 text-[0.72rem] font-extrabold text-brand-blue">
            Info
          </span>
        ) : (
          <span
            className={cx(
              'inline-flex rounded-full px-2.5 py-0.5 text-[0.72rem] font-extrabold',
              check.passed
                ? 'bg-[rgba(34,197,94,0.12)] text-[#166534]'
                : 'bg-[rgba(239,68,68,0.1)] text-[#991b1b]',
            )}
          >
            {check.passed ? 'Passed' : 'Failed'}
          </span>
        )}
      </div>

      <p className="m-0 mt-3 text-[0.84rem] leading-[1.5] text-brand-text">{check.detail ?? '—'}</p>

      {check.rejectionReasonCode ? (
        <p className="m-0 mt-2 font-mono text-[0.72rem] text-brand-muted">
          Rejection code: <span className="text-brand-navy">{check.rejectionReasonCode}</span>
        </p>
      ) : null}

      {check.criteriaKeys?.length ? (
        <p className="m-0 mt-2 text-[0.75rem] text-brand-muted">
          Criteria keys:{' '}
          <span className="font-mono font-semibold text-brand-navy">{check.criteriaKeys.join(', ')}</span>
        </p>
      ) : null}

      {showDrillDown ? (
        <div className="mt-3 border-t border-[rgba(23,44,113,0.08)] pt-3">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[8px] border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.9)] px-3 py-2 text-left text-[0.8rem] font-bold text-brand-navy transition-colors hover:border-[rgba(20,150,243,0.28)]"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            <span>
              {expanded ? 'Hide' : 'Show'} drill-down ({check.findings!.length}{' '}
              {check.findings!.length === 1 ? 'item' : 'items'})
            </span>
            <span aria-hidden className="text-brand-muted">
              {expanded ? '▲' : '▼'}
            </span>
          </button>

          {expanded ? (
            <ol className="m-0 mt-3 grid list-none gap-2 p-0">
              {check.findings!.map((finding, index) => (
                <FindingBlock key={`${check.id}-${index}`} finding={finding} index={index} />
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function PostBreResultsSummary({ result }: { result: PostBreDryRunResult }) {
  const failed = result.checks.filter((c) => c.id !== 'bureau_score_present' && !c.passed);

  return (
    <div className="grid gap-4">
      <div
        className={cx(
          'rounded-[14px] border px-4 py-3',
          result.overallPassed
            ? 'border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)]'
            : 'border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.06)]',
        )}
      >
        <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
          Overall decision
        </p>
        <p className="m-0 mt-1 text-[1.1rem] font-extrabold tracking-[-0.03em] text-brand-navy">
          {result.overallPassed ? 'Post-BRE would pass' : `Post-BRE would reject (${failed.length} rule(s) failed)`}
        </p>
        <p className="m-0 mt-1 text-[0.84rem] text-brand-muted">
          Bureau score: {result.cibilScore ?? 'not found'} · Customer type:{' '}
          {result.isExistingCustomer ? 'existing (repeat)' : 'new'}
        </p>
      </div>

      {result.unsecuredExposure && (
        <div className="rounded-[14px] border border-[rgba(20,150,243,0.22)] bg-[rgba(20,150,243,0.06)] px-4 py-4 grid gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="m-0 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Total Unsecured Loan
              </p>
              <p className="m-0 mt-0.5 text-[1.1rem] font-extrabold text-brand-navy">
                ₹{result.unsecuredExposure.totalUnsecuredExposureInr.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="m-0 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Total Open Unsecured Loan
              </p>
              <p className="m-0 mt-0.5 text-[1.1rem] font-extrabold text-brand-navy">
                ₹{result.unsecuredExposure.totalOpenUnsecuredExposureInr.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="m-0 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Max Single Unsecured Loan
              </p>
              <p className="m-0 mt-0.5 text-[1.1rem] font-extrabold text-brand-navy">
                ₹{result.unsecuredExposure.maxOpenUnsecuredExposureInr.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {result.overallPassed && result.creditLimit && (
            <div className="grid gap-2 border-t border-[rgba(20,150,243,0.14)] pt-3">
              <div>
                <p className="m-0 text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
                  Pre-Approved Credit Limit
                </p>
                <p className="m-0 mt-1 text-[1.6rem] font-extrabold tracking-[-0.03em] text-brand-navy">
                  ₹{result.creditLimit.preApprovedAmountInr.toLocaleString('en-IN')}
                </p>
                <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
                  From total unsecured ₹
                  {result.creditLimit.totalUnsecuredExposureInr.toLocaleString('en-IN')}. Product range: ₹
                  {result.creditLimit.minLoanAmountInr.toLocaleString('en-IN')} – ₹
                  {result.creditLimit.maxLoanAmountInr.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <PostBreInspectionSections result={result} />

      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.03em] text-brand-navy">Rule results</h2>
          <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
            Pass/fail per post-BRE rule with drill-down on failing accounts and signals.
          </p>
        </div>
        <div className="grid gap-3">
          {result.checks.map((check) => (
            <CheckCard key={check.id} check={check} />
          ))}
        </div>
      </section>

      <details className="rounded-xl border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.72)] p-3">
        <summary className="cursor-pointer text-[0.84rem] font-bold text-brand-navy">
          Resolved thresholds (raw JSON)
        </summary>
        <pre className="mt-2 overflow-x-auto text-[0.75rem] leading-normal text-brand-muted">
          {JSON.stringify(result.thresholds, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function PostBureauBrePanel() {
  const [jsonText, setJsonText] = useState('');
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [applicantMobile, setApplicantMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<PostBreDryRunResult | null>(null);

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
      const response = await runPostBureauBreCheck(token, {
        bureauPayload,
        isExistingCustomer,
        applicantMobile: applicantMobile.trim() || null,
      });
      setResult(response);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Unable to run post-BRE check.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-4 rounded-2xl border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_12px_40px_rgba(23,44,113,0.06)]"
        onSubmit={handleSubmit}
      >
        <div>
          <h2 className="m-0 text-[1.05rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            Bureau JSON
          </h2>
          <p className="m-0 mt-1 text-[0.84rem] leading-[1.45] text-brand-muted">
            Paste the full Tenacio bureau soft-pull response (same JSON stored in{' '}
            <code className="text-[0.8rem]">bureau_report.raw_payload</code>). The inspector shows
            which eligibility keys and tradelines drive each rule, plus pass/fail results.
          </p>
        </div>

        <label className="grid gap-1.5">
          <span className="text-[0.84rem] font-bold text-brand-muted">Payload</span>
          <textarea
            className="los-input min-h-70 resize-y font-mono text-[0.78rem] leading-normal"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            placeholder='{"requestId":"...","data":{"cibilData":{...}}}'
            spellCheck={false}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-[0.84rem] font-bold text-brand-muted">
            Applicant mobile (optional — bureau phone match)
          </span>
          <input
            type="text"
            inputMode="tel"
            className="los-input font-mono text-[0.88rem]"
            value={applicantMobile}
            onChange={(event) => setApplicantMobile(event.target.value)}
            placeholder="9876543210"
            maxLength={20}
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-[0.88rem] font-semibold text-brand-navy">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-blue"
            checked={isExistingCustomer}
            onChange={(event) => setIsExistingCustomer(event.target.checked)}
          />
          Treat as existing customer (use cibil_min_existing threshold)
        </label>

        {parseError ? (
          <p className="m-0 rounded-[10px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-[0.84rem] text-[#991b1b]">
            {parseError}
          </p>
        ) : null}

        {requestError ? (
          <p className="m-0 rounded-[10px] border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-[0.84rem] text-[#991b1b]">
            {requestError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="los-btn-primary min-h-10.5 px-5"
            disabled={loading || !jsonText.trim()}
          >
            {loading ? 'Running checks…' : 'Run post-BRE check'}
          </button>
          <button
            type="button"
            className="min-h-10.5 cursor-pointer rounded-[10px] border border-[rgba(23,44,113,0.14)] bg-white px-5 text-[0.88rem] font-bold text-brand-navy transition-colors hover:border-[rgba(20,150,243,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={() => {
              setJsonText('');
              setResult(null);
              setParseError(null);
              setRequestError(null);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {result ? <PostBreResultsSummary result={result} /> : null}
    </div>
  );
}
