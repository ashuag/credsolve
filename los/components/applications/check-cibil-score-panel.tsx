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
import { useCallback, useEffect, useState } from 'react';

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

function CibilHitLogs({ hits }: { hits: LosCibilHitLog[] }) {
  if (hits.length < 2) return null;

  return (
    <div className="los-card overflow-hidden border border-[rgba(245,158,11,0.28)] bg-[rgba(255,251,235,0.72)]">
      <div className="border-b border-[rgba(245,158,11,0.18)] px-4 py-3">
        <p className="m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-[#92400e]">
          Multiple bureau hits
        </p>
        <h3 className="m-0 mt-0.5 text-[0.95rem] font-extrabold text-brand-navy">
          CIBIL hit log · {hits.length} pulls
        </h3>
        <p className="m-0 mt-1 text-[0.78rem] leading-relaxed text-brand-muted">
          This lead has been pulled more than once. Each row is a bureau call or stored report snapshot.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[0.78rem]">
          <thead>
            <tr className="border-b border-[rgba(23,44,113,0.08)] bg-[rgba(255,255,255,0.7)] text-[0.66rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
              <th className="px-4 py-2.5 font-extrabold">When</th>
              <th className="px-4 py-2.5 font-extrabold">Source</th>
              <th className="px-4 py-2.5 font-extrabold">Service</th>
              <th className="px-4 py-2.5 font-extrabold">HTTP</th>
              <th className="px-4 py-2.5 font-extrabold">Outcome</th>
              <th className="px-4 py-2.5 font-extrabold">Score</th>
            </tr>
          </thead>
          <tbody>
            {hits.map((hit) => (
              <tr key={hit.id} className="border-b border-[rgba(23,44,113,0.06)] last:border-b-0">
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
                <td className="px-4 py-2.5 font-bold text-brand-navy">{formatCibilScoreLabel(hit.cibilScore)}</td>
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
};

export function CheckCibilScorePanel({
  applicationUuid,
  leadUuid,
  compact = false,
  emptyState = false,
  lastResult = null,
  onCompleted,
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
      className="los-btn-primary min-h-[40px] px-4"
      disabled={busy}
      onClick={() => void handleCheck()}
    >
      {busy ? 'Checking CIBIL…' : hits && hits.hitCount > 0 ? 'Re-check CIBIL score' : 'Check CIBIL score'}
    </button>
  ) : null;

  if (compact) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {button}
          {hits && hits.hitCount > 1 ? (
            <span className="text-[0.74rem] font-bold text-[#92400e]">{hits.hitCount} bureau hits on this lead</span>
          ) : null}
        </div>
        {error ? <p className="m-0 text-[0.82rem] font-semibold text-[#8d3434]">{error}</p> : null}
        {result ? <CheckResultBanner result={result} /> : null}
        {hits ? <CibilHitLogs hits={hits.hits} /> : null}
      </div>
    );
  }

  if (emptyState) {
    return (
      <div className="los-card border border-dashed border-[rgba(23,44,113,0.18)] bg-[rgba(248,250,255,0.88)] p-6 md:p-8">
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
