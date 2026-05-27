'use client';

import { CibilReportViewer } from '@/components/applications/cibil-report-viewer';
import { getApplicationCibilReport, type LosApplicationCibilReportPayload } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
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

export function ApplicationCibilReportTab({ applicationUuid }: { applicationUuid: string }) {
  const [payload, setPayload] = useState<LosApplicationCibilReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      setLoading(false);
      return;
    }

    try {
      const data = await getApplicationCibilReport(token, applicationUuid);
      setPayload(data);
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : 'Failed to load CIBIL report.');
    } finally {
      setLoading(false);
    }
  }, [applicationUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="los-card p-8">
        <div className="mx-auto max-w-md animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-[rgba(23,44,113,0.08)]" />
          <div className="h-24 rounded-xl bg-[rgba(23,44,113,0.05)]" />
          <div className="h-40 rounded-xl bg-[rgba(23,44,113,0.05)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="los-card border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.88)] p-6 text-[0.92rem] text-[#8d3434]">
        <strong className="font-extrabold">CIBIL report unavailable.</strong>
        <p className="m-0 mt-2 leading-relaxed">{error}</p>
        <button type="button" onClick={() => void load()} className="los-btn-primary mt-4 min-h-[38px] px-4">
          Retry
        </button>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="los-card p-6 text-[0.9rem] text-brand-muted">
        No bureau data is available for this application yet.
      </div>
    );
  }

  return <CibilReportViewer payload={payload} />;
}
