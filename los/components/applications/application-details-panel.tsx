'use client';

import Link from 'next/link';
import { ApplicationOverviewCibilSection } from '@/components/applications/application-overview-cibil-section';
import { CustomerJourneyTimeline } from '@/components/shared/customer-journey-timeline';
import { WorkspaceRecordHeader } from '@/components/shared/workspace-record-header';
import { buildApplicationJourney } from '@/lib/customer-journey';
import { formatPersonName } from '@/lib/format-person-name';
import {
  getApplicationDetails,
  resolveLosKycPhotoSrc,
  type LosApplicationDetails,
} from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { buildWorkspaceAlertText } from '@/lib/workspace-alert';
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

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function leadSourceSummary(sourceName: string | null | undefined, sourceType: string | null | undefined): string {
  if (!sourceName) return 'Unattributed';
  return sourceType ? `${sourceName} · ${sourceType}` : sourceName;
}

function formatHeaderInr(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function cibilScoreClassName(score: number | null | undefined): string {
  if (score == null) return 'text-brand-muted';
  if (score >= 750) return 'text-[#14523a]';
  if (score >= 650) return 'text-[#7a4800]';
  return 'text-[#8d3434]';
}

function CopyIdButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      title={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.85)] px-2.5 text-[0.72rem] font-bold text-brand-navy transition-colors hover:border-[rgba(20,150,243,0.35)]"
    >
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function HeaderRecordIds({
  applicationUuid,
  leadUuid,
  customerUuid,
}: {
  applicationUuid: string;
  leadUuid: string;
  customerUuid: string;
}) {
  const rows = [
    { label: 'Application', value: applicationUuid, copyLabel: 'Application UUID' },
    { label: 'Lead', value: leadUuid, copyLabel: 'Lead UUID' },
    { label: 'Customer', value: customerUuid, copyLabel: 'Customer UUID' },
  ];

  return (
    <div className="min-w-0 rounded-[10px] border border-[rgba(23,44,113,0.09)] bg-[rgba(248,250,255,0.6)] px-3 py-2.5">
      <p className="m-0 mb-2 text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">Record IDs</p>
      <dl className="m-0 grid gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 rounded-[8px] border border-[rgba(23,44,113,0.06)] bg-white px-2.5 py-2">
            <dt className="text-[0.58rem] font-extrabold uppercase tracking-[0.1em]" style={{ color: 'rgba(94,103,130,0.65)' }}>
              {row.label}
            </dt>
            <dd className="m-0 mt-1 flex items-start gap-1">
              <code className="min-w-0 flex-1 truncate text-[0.68rem] font-semibold text-brand-navy" title={row.value}>
                {row.value}
              </code>
              <CopyIdButton value={row.value} label={row.copyLabel} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function KycPhoto({
  token,
  url,
  label,
  emptyLabel,
  photoVersion,
  compact = false,
}: {
  token: string;
  url: string | null;
  label: string;
  emptyLabel: string;
  photoVersion?: string | number | null;
  compact?: boolean;
}) {
  const src = resolveLosKycPhotoSrc(url, token, photoVersion);

  if (compact) {
    return (
      <figure className="m-0 w-[112px] shrink-0 overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white">
        <figcaption className="border-b border-[rgba(23,44,113,0.07)] px-2 py-1.5 text-center text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-brand-muted">
          {label}
        </figcaption>
        <div className="flex h-[132px] items-center justify-center bg-[rgba(248,250,255,0.9)] p-1.5">
          {src ? (
            <img src={src} alt={label} className="h-full w-full rounded-[8px] object-cover" />
          ) : (
            <span className="px-1 text-center text-[0.62rem] font-semibold leading-tight text-brand-muted">{emptyLabel}</span>
          )}
        </div>
      </figure>
    );
  }

  return (
    <figure className="m-0 overflow-hidden rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-[rgba(248,250,255,0.72)]">
      <figcaption className="border-b border-[rgba(23,44,113,0.07)] px-3 py-2 text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted">
        {label}
      </figcaption>
      <div className="flex min-h-[220px] items-center justify-center p-3">
        {src ? (
          <img src={src} alt={label} className="max-h-[320px] w-full rounded-[10px] object-contain" />
        ) : (
          <span className="text-[0.84rem] font-semibold text-brand-muted">{emptyLabel}</span>
        )}
      </div>
    </figure>
  );
}

export function ApplicationDetailsPanel({ applicationUuid }: { applicationUuid: string }) {
  const [row, setRow] = useState<LosApplicationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getToken();
    if (!token) {
      setError('Session expired - please log in again.');
      setLoading(false);
      return;
    }

    try {
      const data = await getApplicationDetails(token, applicationUuid);
      setRow(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load application details.');
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
          <div className="h-4 w-40 rounded bg-[rgba(23,44,113,0.08)]" />
          <div className="h-10 w-full max-w-lg rounded-lg bg-[rgba(23,44,113,0.06)]" />
          <div className="h-24 rounded-xl bg-[rgba(23,44,113,0.05)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="los-card border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.88)] p-6 text-[0.92rem] text-[#8d3434]">
        <strong className="font-extrabold">Unable to load this application.</strong>
        <p className="m-0 mt-2 leading-relaxed">{error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/applications"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(23,44,113,0.14)] bg-[rgba(255,255,255,0.9)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline"
          >
            Back to applications
          </Link>
          <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="los-card p-6 text-[0.9rem] text-brand-muted">
        Application not found.
        <div className="mt-3">
          <Link href="/applications" className="font-bold text-brand-blue no-underline hover:underline">
            Return to application queue
          </Link>
        </div>
      </div>
    );
  }

  const profile = row.lead.profile;
  const displayName = formatPersonName(profile?.fullName, 'Applicant (name pending)');
  const authToken = getToken();
  const journeySteps = buildApplicationJourney(row);
  const cibilScore = row.bureauReport?.cibilScore ?? row.eligibility?.cibilScore ?? null;
  const loanAmount = row.details?.loanAmount ?? row.preApprovedLoanAmount;
  const alertText = buildWorkspaceAlertText({
    statusCode: row.statusCode,
    leadStatusNote: row.lead.leadStatusNote,
    bureauFetchedNote: row.lead.bureauFetchedNote,
    panVerified: row.lead.panVerified,
    bureauFetched: row.lead.bureauFetched,
  }) ?? buildWorkspaceAlertText({
    statusCode: row.lead.statusCode,
    leadStatusNote: row.lead.leadStatusNote,
    bureauFetchedNote: row.lead.bureauFetchedNote,
    panVerified: row.lead.panVerified,
    bureauFetched: row.lead.bureauFetched,
  });

  return (
    <div className="grid gap-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/applications"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.88)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline shadow-sm transition-colors hover:border-[rgba(20,150,243,0.28)]"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            All applications
          </Link>
          <Link
            href={`/leads/${row.leadUuid}`}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.88)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline shadow-sm transition-colors hover:border-[rgba(20,150,243,0.28)]"
          >
            Lead workspace
          </Link>
        </div>
        <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]">
          Refresh data
        </button>
      </div>

      <WorkspaceRecordHeader
        eyebrow="Loan application"
        title={displayName}
        mobile={row.mobileNumber}
        email={row.email}
        statusCode={row.statusCode}
        statusLabel={row.statusLabel}
        sourceLabel={leadSourceSummary(row.lead.sourceName, row.lead.sourceType)}
        alertText={alertText}
        createdAt={formatDateTime(row.createdAt)}
        updatedAt={formatDateTime(row.updatedAt)}
        createdLabel="Opened"
        updatedLabel="Updated"
        highlights={[
          {
            label: 'CIBIL score',
            value: cibilScore ?? '—',
            valueClassName: cibilScoreClassName(cibilScore),
            accent:
              cibilScore == null
                ? undefined
                : cibilScore >= 750
                  ? '#22c55e'
                  : cibilScore >= 650
                    ? '#f59e0b'
                    : '#ef4444',
          },
          {
            label: 'Loan amount',
            value: formatHeaderInr(loanAmount),
            valueClassName: 'text-brand-navy',
            accent: '#1496f3',
          },
          {
            label: 'KYC',
            value: row.kycStatusLabel,
            valueClassName: 'text-brand-navy',
            accent: '#6366f1',
          },
        ]}
        quickStats={[
          { label: 'Lead', value: row.lead.statusLabel },
          { label: 'Email verified', value: formatDateTime(row.emailVerifiedAt ?? undefined) },
        ]}
        recordIds={
          <HeaderRecordIds
            applicationUuid={row.uuid}
            leadUuid={row.leadUuid}
            customerUuid={row.customerUuid}
          />
        }
        trailing={
          authToken ? (
            <div className="flex gap-2">
              {row.kycPhotos.aadhaarPhotoUrl ? (
                <KycPhoto
                  token={authToken}
                  url={row.kycPhotos.aadhaarPhotoUrl}
                  photoVersion={row.updatedAt}
                  label="Aadhaar"
                  emptyLabel="Not available"
                  compact
                />
              ) : (
                <figure className="m-0 w-[88px] shrink-0 overflow-hidden rounded-[10px] border border-[rgba(23,44,113,0.1)] bg-white">
                  <figcaption className="border-b border-[rgba(23,44,113,0.07)] px-1.5 py-1 text-center text-[0.58rem] font-extrabold uppercase text-brand-muted">
                    Aadhaar
                  </figcaption>
                  <div className="flex h-[100px] items-center justify-center bg-[rgba(248,250,255,0.9)]">
                    <span className="text-[0.58rem] font-semibold text-brand-muted">N/A</span>
                  </div>
                </figure>
              )}
              {row.kycPhotos.selfieUrl ? (
                <KycPhoto
                  token={authToken}
                  url={row.kycPhotos.selfieUrl}
                  photoVersion={row.updatedAt}
                  label="Selfie"
                  emptyLabel="Not captured"
                  compact
                />
              ) : (
                <figure className="m-0 w-[88px] shrink-0 overflow-hidden rounded-[10px] border border-[rgba(23,44,113,0.1)] bg-white">
                  <figcaption className="border-b border-[rgba(23,44,113,0.07)] px-1.5 py-1 text-center text-[0.58rem] font-extrabold uppercase text-brand-muted">
                    Selfie
                  </figcaption>
                  <div className="flex h-[100px] items-center justify-center bg-[rgba(248,250,255,0.9)]">
                    <span className="text-[0.58rem] font-semibold text-brand-muted">N/A</span>
                  </div>
                </figure>
              )}
            </div>
          ) : null
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid min-w-0 gap-4">
      <ApplicationOverviewCibilSection
        row={row}
        applicationUuid={applicationUuid}
        authToken={authToken}
        onReportCreated={() => void load()}
      />
        </div>

        <aside className="min-w-0 lg:order-last">
          <CustomerJourneyTimeline
            title="Application progress"
            subtitle="Intake through KYC, bank details, and references"
            steps={journeySteps}
            orientation="vertical"
          />
        </aside>
      </div>
    </div>
  );
}
