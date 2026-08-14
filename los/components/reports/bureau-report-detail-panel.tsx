'use client';

import { ApplicationCibilReportTab } from '@/components/applications/application-cibil-report-tab';
import { getLeadDetails, type LosLeadDetails } from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export function BureauReportDetailPanel({ leadUuid }: { leadUuid: string }) {
  const [lead, setLead] = useState<LosLeadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getLosToken();
    if (!token) {
      setError('Session expired — please log in again.');
      setLoading(false);
      return;
    }
    try {
      setLead(await getLeadDetails(token, leadUuid));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bureau report');
    } finally {
      setLoading(false);
    }
  }, [leadUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = formatPersonName(lead?.profile?.fullName, 'Bureau report');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/reports/bureau-report"
            className="text-[0.8rem] font-bold text-brand-blue no-underline hover:underline"
          >
            ← Bureau Report
          </Link>
          <h1 className="m-0 mt-1 text-[1.35rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            {loading ? 'Loading report…' : name}
          </h1>
          {lead ? (
            <p className="m-0 mt-1 text-[0.86rem] text-brand-muted">
              {lead.mobileNumber}
              {lead.profile?.panNumber ? ` · ${lead.profile.panNumber}` : ''}
            </p>
          ) : null}
        </div>
        {lead ? (
          <Link
            href={`/leads/${lead.uuid}`}
            className="inline-flex min-h-[34px] items-center rounded-full border border-[rgba(23,44,113,0.12)] bg-white px-4 text-[0.78rem] font-bold text-brand-navy no-underline hover:border-[rgba(20,150,243,0.35)]"
          >
            Open lead
          </Link>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <ApplicationCibilReportTab
          leadUuid={leadUuid}
          mobileNumber={lead?.mobileNumber}
          fullName={lead?.profile?.fullName}
          panNumber={lead?.profile?.panNumber}
          onReportCreated={() => void load()}
        />
      ) : null}
    </div>
  );
}
