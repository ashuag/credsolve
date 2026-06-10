'use client';

import Link from 'next/link';
import { ApplicationOverviewCibilSection } from '@/components/applications/application-overview-cibil-section';
import { CustomerJourneyTimeline } from '@/components/shared/customer-journey-timeline';
import { WorkspaceRecordHeader } from '@/components/shared/workspace-record-header';
import { buildApplicationJourney } from '@/lib/customer-journey';
import {
  generateApplicationLoanDocuments,
  fetchApplicationLoanDocumentBlob,
  getApplicationDetails,
  resolveLosKycPhotoSrc,
  type LosApplicationDetails,
} from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

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

function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string; // kept for API compat, ignored
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.09)]"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))' }}
    >
      <div className="flex items-center gap-2 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.7)] px-4 py-2.5">
        <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: 'rgba(94,103,130,0.6)' }}>{eyebrow}</span>
        <span className="w-px h-3 bg-[rgba(23,44,113,0.1)]" aria-hidden />
        <h2 className="m-0 text-[0.88rem] font-extrabold tracking-[-0.01em] text-brand-navy">{title}</h2>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function DetailGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="m-0 divide-y divide-[rgba(23,44,113,0.06)]">
      {rows.map((row, idx) => (
        <div key={`${row.label}-${idx}`} className="flex items-baseline gap-3 py-1.5 first:pt-0 last:pb-0">
          <dt className="w-[140px] flex-shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-brand-muted leading-tight">{row.label}</dt>
          <dd className="m-0 min-w-0 flex-1 text-[0.84rem] font-semibold text-brand-text leading-snug">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
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

function MonoValue({ children, copyLabel }: { children: string; copyLabel: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <code className="break-all text-[0.8rem] font-semibold leading-snug text-brand-navy">{children}</code>
      <CopyIdButton value={children} label={copyLabel} />
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

function LoanDocumentCard({
  label,
  ready,
  esigned,
  docType,
  applicationUuid,
  token,
}: {
  label: string;
  ready: boolean;
  esigned: boolean;
  docType: 'key-fact';
  applicationUuid: string;
  token: string | null;
}) {
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const handleView = async () => {
    if (!token) return;
    setOpening(true);
    setOpenError(null);
    try {
      const blob = await fetchApplicationLoanDocumentBlob(token, applicationUuid, docType);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'Failed to open document.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.65)] px-3 py-2.5">
      <span className="block text-[0.78rem] font-extrabold text-brand-navy">{label}</span>
      {ready ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-[0.72rem] font-bold text-[#14523a]">Ready</span>
          {esigned ? (
            <span className="inline-flex items-center gap-0.5 rounded-[5px] border border-[rgba(29,157,112,0.3)] bg-[rgba(29,157,112,0.08)] px-1.5 py-0.5 text-[0.65rem] font-extrabold text-[#14523a]">
              ✓ E-Signed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-[5px] border border-[rgba(180,100,0,0.25)] bg-[rgba(255,160,0,0.08)] px-1.5 py-0.5 text-[0.65rem] font-extrabold text-[#7a4800]">
              Not E-Signed
            </span>
          )}
          <button
            type="button"
            disabled={opening || !token}
            onClick={() => void handleView()}
            className="inline-flex items-center gap-1 rounded-[6px] border border-[rgba(20,150,243,0.28)] bg-[rgba(20,150,243,0.07)] px-2 py-0.5 text-[0.68rem] font-bold text-brand-blue disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[rgba(20,150,243,0.13)]"
          >
            {opening ? 'Opening…' : 'View PDF'}
          </button>
          {openError ? (
            <span className="text-[0.68rem] font-semibold text-[#8d3434]">{openError}</span>
          ) : null}
        </div>
      ) : (
        <span className="block mt-0.5 text-[0.72rem] font-bold text-brand-muted">Not generated yet</span>
      )}
    </div>
  );
}

export function ApplicationDetailsPanel({ applicationUuid }: { applicationUuid: string }) {
  const [row, setRow] = useState<LosApplicationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [docsActionResult, setDocsActionResult] = useState<string | null>(null);

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
  const displayName = profile?.fullName?.trim() || 'Applicant (name pending)';
  const authToken = getToken();
  const journeySteps = buildApplicationJourney(row);

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
        createdAt={formatDateTime(row.createdAt)}
        updatedAt={formatDateTime(row.updatedAt)}
        createdLabel="Opened"
        updatedLabel="Updated"
        quickStats={[
          { label: 'Lead', value: row.lead.statusLabel },
          { label: 'CIBIL', value: row.bureauReport?.cibilScore ?? row.eligibility?.cibilScore ?? '—' },
          { label: 'KYC', value: row.kycStatusLabel },
        ]}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard eyebrow="Identifiers" title="Record IDs">
          <DetailGrid
            rows={[
              { label: 'Application UUID', value: <MonoValue copyLabel="Application UUID">{row.uuid}</MonoValue> },
              { label: 'Lead UUID', value: <MonoValue copyLabel="Lead UUID">{row.leadUuid}</MonoValue> },
              { label: 'Customer UUID', value: <MonoValue copyLabel="Customer UUID">{row.customerUuid}</MonoValue> },
              { label: 'Lead source', value: leadSourceSummary(row.lead.sourceName, row.lead.sourceType) },
              { label: 'Email', value: row.email ?? '—' },
              { label: 'Email verified at', value: formatDateTime(row.emailVerifiedAt ?? undefined) },
            ]}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Loan documents"
          title="Generate sanction letter"
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={generatingDocs}
              onClick={async () => {
                const token = getToken();
                if (!token) return;
                setGeneratingDocs(true);
                setDocsActionResult(null);
                try {
                  const result = await generateApplicationLoanDocuments(token, applicationUuid);
                  setDocsActionResult(`Generated: ${result.generated.join(', ')}`);
                  void load();
                } catch (e) {
                  setDocsActionResult(e instanceof Error ? e.message : 'Failed to generate documents.');
                } finally {
                  setGeneratingDocs(false);
                }
              }}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-[10px] border border-[rgba(23,44,113,0.18)] bg-[rgba(23,44,113,0.06)] px-4 text-[0.82rem] font-bold text-brand-navy disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingDocs ? 'Generating…' : 'Generate PDFs'}
            </button>
            {row.lead.profile?.fullName && row.details?.loanAmount ? null : (
              <span className="text-[0.78rem] text-[#b45309]">
                Loan selection must be complete before generating.
              </span>
            )}
            {docsActionResult && (
              <span className={`text-[0.78rem] font-semibold ${docsActionResult.startsWith('Generated') ? 'text-[#14523a]' : 'text-[#8d3434]'}`}>
                {docsActionResult}
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  label: 'Sanction letter cum KFS',
                  ready: row.loanDocuments.keyFactReady,
                  esigned: row.loanDocuments.keyFactEsigned,
                  docType: 'key-fact' as const,
                },
              ]
            ).map((doc) => (
              <LoanDocumentCard
                key={doc.label}
                label={doc.label}
                ready={doc.ready}
                esigned={doc.esigned}
                docType={doc.docType}
                applicationUuid={applicationUuid}
                token={authToken}
              />
            ))}
            {row.loanDocuments.acceptedAt && (
              <div className="rounded-[10px] border border-[rgba(29,157,112,0.2)] bg-[rgba(29,157,112,0.06)] px-3 py-2.5 sm:col-span-2">
                <span className="block text-[0.72rem] font-extrabold text-brand-muted">Accepted by customer</span>
                <span className="block text-[0.78rem] font-bold text-[#14523a]">{formatDateTime(row.loanDocuments.acceptedAt)}</span>
              </div>
            )}
          </div>
        </SectionCard>

        {row.agreement ? (
          <SectionCard eyebrow="Agreement" title="E-sign & legal">
            <DetailGrid
              rows={[
                { label: 'Document', value: row.agreement.documentName ?? '—' },
                { label: 'Signed at', value: formatDateTime(row.agreement.signedAt ?? undefined) },
                { label: 'IP address', value: row.agreement.ipAddress ?? '—' },
              ]}
            />
          </SectionCard>
        ) : null}
      </div>
        </div>

        <aside className="min-w-0 lg:order-last">
          <CustomerJourneyTimeline
            title="Application progress"
            subtitle="Intake through KYC and bank details"
            steps={journeySteps}
            orientation="vertical"
          />
        </aside>
      </div>
    </div>
  );
}
