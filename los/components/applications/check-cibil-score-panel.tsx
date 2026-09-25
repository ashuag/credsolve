'use client';

import { canCheckCibilScore } from '@/lib/access';
import { formatCibilScoreLabel } from '@/lib/application-review-format';
import {
  checkApplicationCibilScore,
  checkLeadCibilScore,
  getApplicationCibilHits,
  getLeadCibilHits,
  type LosCheckCibilResult,
  type LosCibilHitLog,
  type LosCibilHitsPayload,
} from '@/lib/api';
import { getLosStoredUser, LOS_STORAGE_KEY } from '@/lib/auth';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

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

function formatHitTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function JsonViewButton({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (value == null) {
    return <span className="text-brand-muted">—</span>;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatJson(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-[30px] items-center rounded-[8px] border border-[rgba(15,39,72,0.12)] bg-white px-2.5 text-[0.72rem] font-bold text-brand-blue hover:border-[rgba(34,197,94,0.35)]"
        onClick={() => setOpen(true)}
      >
        View
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,26,46,0.45)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[min(82vh,880px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[16px] border border-[rgba(15,39,72,0.12)] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(15,39,72,0.08)] px-4 py-3">
              <h3 className="m-0 text-[0.92rem] font-extrabold text-brand-navy">{label}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[32px] items-center rounded-full border border-[rgba(15,39,72,0.12)] bg-white px-3 text-[0.74rem] font-bold text-brand-navy hover:border-[rgba(34,197,94,0.35)]"
                  onClick={() => void handleCopy()}
                >
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[32px] items-center rounded-full border border-[rgba(15,39,72,0.12)] bg-white px-3 text-[0.74rem] font-bold text-brand-muted hover:text-brand-navy"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="m-0 flex-1 overflow-auto bg-[#0f172a] p-4 text-[0.72rem] leading-relaxed text-[#e2e8f0]">
              <code>{formatJson(value)}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CibilHitLogs({ hits }: { hits: LosCibilHitLog[] }) {
  if (hits.length === 0) {
    return (
      <div className="los-card border border-dashed border-[rgba(15,39,72,0.16)] bg-[rgba(248,250,255,0.88)] p-6">
        <h3 className="m-0 text-[0.95rem] font-extrabold text-brand-navy">No CIBIL hit logs yet</h3>
        <p className="m-0 mt-1 max-w-[52ch] text-[0.82rem] leading-relaxed text-brand-muted">
          Bureau pulls for this lead will appear here, with the original vendor JSON and the
          converted Tenacio response JSON.
        </p>
      </div>
    );
  }

  return (
    <div className="los-card overflow-hidden">
      <div className="border-b border-[rgba(15,39,72,0.08)] bg-[rgba(248,250,255,0.85)] px-4 py-3">
        <p className="m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">
          Bureau pulls
        </p>
        <h3 className="m-0 mt-0.5 text-[0.95rem] font-extrabold text-brand-navy">
          CIBIL hit logs · {hits.length} {hits.length === 1 ? 'pull' : 'pulls'}
        </h3>
        <p className="m-0 mt-1 text-[0.78rem] leading-relaxed text-brand-muted">
          Each row is a bureau call or stored report snapshot. Original JSON is the raw vendor
          response. Tenacio JSON is that payload converted to a Tenacio-style response.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-[0.78rem]">
          <thead>
            <tr className="border-b border-[rgba(15,39,72,0.08)] bg-[rgba(255,255,255,0.7)] text-[0.66rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
              <th className="px-4 py-2.5 font-extrabold">When</th>
              <th className="px-4 py-2.5 font-extrabold">Source</th>
              <th className="px-4 py-2.5 font-extrabold">Service</th>
              <th className="px-4 py-2.5 font-extrabold">HTTP</th>
              <th className="px-4 py-2.5 font-extrabold">Outcome</th>
              <th className="px-4 py-2.5 font-extrabold">Original JSON</th>
              <th className="px-4 py-2.5 font-extrabold">Tenacio JSON</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((hit) => (
              <tr key={hit.id} className="border-b border-[rgba(15,39,72,0.06)] last:border-b-0">
                <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-brand-navy">
                  {formatHitTime(hit.at)}
                </td>
                <td className="px-4 py-2.5 text-brand-text">
                  {hit.providerName ?? (hit.kind === 'report' ? 'Stored report' : '—')}
                  {hit.dummyFetched ? (
                    <span className="ml-1.5 text-[0.68rem] font-bold text-brand-muted">mock</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 font-mono text-[0.72rem] text-brand-muted">{hit.serviceName ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-brand-navy">{hit.httpStatus ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      hit.outcome === 'success'
                        ? 'font-extrabold text-[#166534]'
                        : 'font-extrabold text-[#991b1b]'
                    }
                  >
                    {hit.outcome === 'success' ? 'Success' : 'Failure'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <JsonViewButton label="Original vendor JSON" value={hit.originalJson} />
                </td>
                <td className="px-4 py-2.5">
                  <JsonViewButton
                    label="Converted Tenacio response JSON"
                    value={hit.wrappedJson}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CheckResultBanner({ result }: { result: LosCheckCibilResult }) {
  const failed = result.rejected || !result.ok || result.postBre?.passed === false;
  return (
    <div
      className={
        failed
          ? 'los-card border border-[rgba(239,68,68,0.28)] bg-[rgba(255,241,241,0.9)] p-4'
          : 'los-card border border-[rgba(34,197,94,0.28)] bg-[rgba(240,253,244,0.9)] p-4'
      }
    >
      <p
        className={`m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] ${
          failed ? 'text-[#991b1b]' : 'text-[#166534]'
        }`}
      >
        {failed ? 'CIBIL check · rejected or failed' : 'CIBIL check · passed'}
      </p>
      <p className="m-0 mt-1 text-[0.9rem] font-extrabold text-brand-navy">{result.message}</p>
      <dl className="m-0 mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <dt className="text-[0.66rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">CIBIL</dt>
          <dd className="m-0 text-[0.86rem] font-bold text-brand-navy">{formatCibilScoreLabel(result.cibilScore)}</dd>
        </div>
        <div>
          <dt className="text-[0.66rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">Lead status</dt>
          <dd className="m-0 text-[0.86rem] font-bold text-brand-navy">{result.leadStatusLabel}</dd>
        </div>
        <div>
          <dt className="text-[0.66rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">Post-BRE</dt>
          <dd className="m-0 text-[0.86rem] font-bold text-brand-navy">
            {result.postBre == null
              ? 'Not run'
              : result.postBre.passed
                ? 'Passed'
                : result.postBre.rejectReason ?? result.postBre.rejectionReasonCode ?? 'Failed'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

type CheckCibilScorePanelProps = {
  applicationUuid?: string;
  leadUuid?: string;
  compact?: boolean;
  emptyState?: boolean;
  lastResult?: LosCheckCibilResult | null;
  onCompleted?: (result: LosCheckCibilResult) => void;
  buttonClassName?: string;
  /** Hide the hit-log table (shown on the dedicated CIBIL hits tab instead). */
  hideHitLogs?: boolean;
  /** Render the check button in a parent toolbar instead of above the panel body. */
  renderToolbarButton?: (button: ReactNode) => ReactNode;
};

export function CheckCibilScorePanel({
  applicationUuid,
  leadUuid,
  compact = false,
  emptyState = false,
  lastResult = null,
  onCompleted,
  buttonClassName,
  hideHitLogs = false,
  renderToolbarButton,
}: CheckCibilScorePanelProps) {
  const [allowed] = useState(() => {
    const user = getLosStoredUser();
    return canCheckCibilScore(user?.roleName ?? user?.role, user?.hierarchyLevel);
  });
  const [hits, setHits] = useState<LosCibilHitsPayload | null>(
    lastResult ? { hitCount: lastResult.hitCount, hits: lastResult.hits } : null,
  );
  const [result, setResult] = useState<LosCheckCibilResult | null>(lastResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHits = useCallback(async () => {
    const token = getToken();
    if (!token || (!applicationUuid && !leadUuid)) return;
    try {
      const data = applicationUuid
        ? await getApplicationCibilHits(token, applicationUuid)
        : await getLeadCibilHits(token, leadUuid!);
      setHits(data);
    } catch {
      setHits(null);
    }
  }, [applicationUuid, leadUuid]);

  useEffect(() => {
    void loadHits();
  }, [loadHits]);

  async function handleCheck() {
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    if (!applicationUuid && !leadUuid) {
      setError('Missing application or lead reference.');
      return;
    }

    const nextHit = (hits?.hitCount ?? 0) + 1;
    const confirmed = window.confirm(
      nextHit > 1
        ? `This will pull CIBIL again (hit #${nextHit}) and run post-BRE.\n\nIf any post-BRE rule fails, the lead will be rejected.`
        : 'This will pull the CIBIL score and then run post-BRE.\n\nIf any post-BRE rule fails, the lead will be rejected.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const data = applicationUuid
        ? await checkApplicationCibilScore(token, applicationUuid)
        : await checkLeadCibilScore(token, leadUuid!);
      setResult(data);
      setHits({ hitCount: data.hitCount, hits: data.hits });
      onCompleted?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check CIBIL score.');
    } finally {
      setBusy(false);
    }
  }

  const button = allowed ? (
    <button
      type="button"
      className={buttonClassName ?? 'los-btn-primary min-h-[40px] px-4'}
      disabled={busy}
      onClick={() => void handleCheck()}
    >
      {busy ? 'Checking CIBIL…' : hits && hits.hitCount > 0 ? 'Re-check CIBIL score' : 'Check CIBIL score'}
    </button>
  ) : null;

  if (compact) {
    const body = (
      <>
        {error ? <p className="m-0 text-[0.82rem] font-semibold text-[#8d3434]">{error}</p> : null}
        {result ? <CheckResultBanner result={result} /> : null}
        {!hideHitLogs && hits ? <CibilHitLogs hits={hits.hits} /> : null}
      </>
    );

    if (renderToolbarButton) {
      return (
        <div className="grid gap-3">
          {renderToolbarButton(button)}
          {body}
        </div>
      );
    }

    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {button}
        </div>
        {error ? <p className="m-0 text-[0.82rem] font-semibold text-[#8d3434]">{error}</p> : null}
        {result ? <CheckResultBanner result={result} /> : null}
        {!hideHitLogs && hits ? <CibilHitLogs hits={hits.hits} /> : null}
      </div>
    );
  }

  if (emptyState) {
    return (
      <div className="los-card border border-dashed border-[rgba(15,39,72,0.18)] bg-[rgba(248,250,255,0.88)] p-6 md:p-8">
        <span className="los-chip mb-3">CIBIL report</span>
        <h3 className="m-0 text-[1.05rem] font-extrabold tracking-[-0.02em] text-brand-navy">
          No bureau report on file
        </h3>
        <p className="m-0 mt-2 max-w-[56ch] text-[0.88rem] leading-relaxed text-brand-muted">
          Pull the customer&apos;s CIBIL score and immediately run post-BRE. If any post-BRE rule fails, the
          lead is rejected.
        </p>
        <div className="mt-5">{button}</div>
        {error ? <p className="m-0 mt-4 text-[0.82rem] font-semibold text-[#8d3434]">{error}</p> : null}
        {result ? (
          <div className="mt-4">
            <CheckResultBanner result={result} />
          </div>
        ) : null}
        {hits ? (
          <div className="mt-4">
            <CibilHitLogs hits={hits.hits} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {button}
      {error ? <p className="m-0 text-[0.82rem] font-semibold text-[#8d3434]">{error}</p> : null}
      {result ? <CheckResultBanner result={result} /> : null}
      {hits ? <CibilHitLogs hits={hits.hits} /> : null}
    </div>
  );
}

type CibilHitLogsPanelProps = {
  applicationUuid?: string;
  leadUuid?: string;
  refreshKey?: string | number | null;
};

export function CibilHitLogsPanel({ applicationUuid, leadUuid, refreshKey }: CibilHitLogsPanelProps) {
  const [hits, setHits] = useState<LosCibilHitLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHits = useCallback(async () => {
    const token = getToken();
    if (!token || (!applicationUuid && !leadUuid)) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = applicationUuid
        ? await getApplicationCibilHits(token, applicationUuid)
        : await getLeadCibilHits(token, leadUuid!);
      setHits(data.hits);
    } catch (e) {
      setHits(null);
      setError(e instanceof Error ? e.message : 'Failed to load CIBIL hit logs.');
    } finally {
      setLoading(false);
    }
  }, [applicationUuid, leadUuid]);

  useEffect(() => {
    void loadHits();
  }, [loadHits, refreshKey]);

  if (loading) {
    return (
      <div className="los-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 rounded bg-[rgba(15,39,72,0.08)]" />
          <div className="h-24 rounded-xl bg-[rgba(15,39,72,0.05)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="los-card border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.88)] p-4 text-[0.86rem] text-[#8d3434]">
        {error}
        <button type="button" className="los-btn-primary mt-3 min-h-[34px] px-4" onClick={() => void loadHits()}>
          Retry
        </button>
      </div>
    );
  }

  return <CibilHitLogs hits={hits ?? []} />;
}
