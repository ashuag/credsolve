'use client';

import Link from 'next/link';
import { WorkspaceRecordHeader } from '@/components/shared/workspace-record-header';
import { LosStatusPill } from '@/components/shared/los-status-pill';
import { canRejectLeadStatus, RejectRecordModal } from '@/components/shared/reject-record-modal';
import { ApplicationCibilReportTab } from '@/components/applications/application-cibil-report-tab';
import { buildLeadIntakeJourney } from '@/lib/customer-journey';
import { formatCibilScoreLabel } from '@/lib/application-review-format';
import { formatPersonName } from '@/lib/format-person-name';
import { buildWorkspaceAlertText } from '@/lib/workspace-alert';
import { getLeadDetails, type LosLeadDetails } from '@/lib/api';
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

function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ageFromDateOfBirth(iso: string | null | undefined) {
  if (!iso) return '—';
  const dob = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return '—';

  const now = new Date();
  if (now < dob) return '—';

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${years} yrs, ${months} months, ${days} days`;
}

function formatInr(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function NsdlNameMatchMark({ matched }: { matched: boolean | null }) {
  if (matched == null) return null;
  return (
    <span
      className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[0.72rem] font-black leading-none ${
        matched ? 'bg-[rgba(29,157,112,0.14)] text-[#16a34a]' : 'bg-[rgba(220,38,38,0.12)] text-[#dc2626]'
      }`}
      title={matched ? 'NSDL name match' : 'NSDL name mismatch'}
      aria-label={matched ? 'NSDL name match' : 'NSDL name mismatch'}
    >
      {matched ? '✓' : '✕'}
    </span>
  );
}

function sourceSummary(lead: LosLeadDetails) {
  if (lead.sourceName) {
    return lead.sourceType ? `${lead.sourceName} · ${lead.sourceType}` : lead.sourceName;
  }
  const u = lead.utm;
  if (u?.source) return u.medium ? `${u.source} · ${u.medium}` : u.source;
  return 'Unattributed';
}

function SectionCard({
  eyebrow, title, children,
}: { eyebrow: string; title: string; description?: string; children: ReactNode }) {
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

function UtmGrid({ utm }: { utm: NonNullable<LosLeadDetails['utm']> }) {
  const cells = [
    { k: 'Source', v: utm.source },
    { k: 'Medium', v: utm.medium },
    { k: 'Campaign', v: utm.campaign },
    { k: 'Term', v: utm.term },
    { k: 'Content', v: utm.content },
  ].filter((x) => x.v);
  if (cells.length === 0) return <p className="m-0 text-[0.88rem] text-brand-muted">No UTM parameters captured for this lead.</p>;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cells.map((cell) => (
        <div
          key={cell.k}
          className="rounded-[12px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.65)] px-3 py-2.5"
        >
          <span className="block text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">{cell.k}</span>
          <span className="mt-0.5 block text-[0.88rem] font-bold text-brand-text">{cell.v}</span>
        </div>
      ))}
    </div>
  );
}

export function LeadDetailsPanel({ leadUuid }: { leadUuid: string }) {
  const [lead, setLead] = useState<LosLeadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

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
      const data = await getLeadDetails(token, leadUuid);
      setLead(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead details.');
    } finally {
      setLoading(false);
    }
  }, [leadUuid]);

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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-32 rounded-xl bg-[rgba(23,44,113,0.05)]" />
            <div className="h-32 rounded-xl bg-[rgba(23,44,113,0.05)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="los-card border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.88)] p-6 text-[0.92rem] text-[#8d3434]">
        <strong className="font-extrabold">Unable to load this lead.</strong>
        <p className="m-0 mt-2 leading-relaxed">{error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/leads"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(23,44,113,0.14)] bg-[rgba(255,255,255,0.9)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline"
          >
            Back to leads
          </Link>
          <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="los-card p-6 text-[0.9rem] text-brand-muted">
        Lead not found.
        <div className="mt-3">
          <Link href="/leads" className="font-bold text-brand-blue no-underline hover:underline">
            Return to lead queue
          </Link>
        </div>
      </div>
    );
  }

  const displayName = formatPersonName(lead.profile?.fullName, 'Lead (name pending)');
  const profile = lead.profile;
  const journeySteps = buildLeadIntakeJourney(lead);
  const alertText = buildWorkspaceAlertText({
    statusCode: lead.statusCode,
    rejectionReason: lead.rejectionReason?.label,
    leadStatusNote: lead.leadStatusNote,
    bureauFetchedNote: lead.bureauFetchedNote,
    panVerified: lead.panVerified,
    bureauFetched: lead.bureauFetched,
  });

  return (
    <div className="grid gap-4 pb-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/leads"
          className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.88)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline shadow-sm transition-colors hover:border-[rgba(20,150,243,0.28)]"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back to leads
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/customers/${lead.customerUuid}`}
            className="inline-flex min-h-[38px] items-center rounded-full border border-[rgba(23,44,113,0.14)] bg-white px-4 text-[0.82rem] font-bold text-brand-navy no-underline hover:border-[rgba(20,150,243,0.28)]"
          >
            Customer profile
          </Link>
          <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]">
            Refresh data
          </button>
          {canRejectLeadStatus(lead.statusCode) ? (
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              className="min-h-[38px] rounded-[8px] border border-[rgba(239,68,68,0.35)] bg-white px-4 text-[0.82rem] font-bold text-[#dc2626] hover:bg-[rgba(254,242,242,0.9)]"
            >
              Reject lead
            </button>
          ) : null}
        </div>
      </div>

      <RejectRecordModal
        open={rejectOpen}
        token={getToken()}
        recordType="lead"
        recordUuid={lead.uuid}
        recordLabel={displayName}
        onClose={() => setRejectOpen(false)}
        onSuccess={() => void load()}
      />

      <WorkspaceRecordHeader
        eyebrow="Loan pipeline"
        title={displayName}
        mobile={lead.mobileNumber}
        email={lead.email}
        statusCode={lead.statusCode}
        statusLabel={lead.statusLabel}
        sourceLabel={sourceSummary(lead)}
        rejectionReason={lead.rejectionReason?.label}
        alertText={alertText}
        createdAt={formatDateTime(lead.createdAt)}
        updatedAt={formatDateTime(lead.updatedAt)}
        quickStats={[
          { label: 'Lead ID', value: lead.leadNumber },
          { label: 'PAN', value: lead.panVerifiedLabel ?? '—' },
          { label: 'Bureau', value: lead.bureauFetchedLabel ?? '—' },
          { label: 'CIBIL', value: formatCibilScoreLabel(lead.bureauReport?.cibilScore) },
        ]}
        journeyTitle="Intake progress"
        journeySubtitle="Steps before an application is created"
        journeySteps={journeySteps}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <SectionCard eyebrow="Borrower profile" title="Onboarding snapshot" description="Captured during customer onboarding.">
            {profile ? (
              <div className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
                <DetailGrid
                  rows={[
                    { label: 'Lead ID', value: lead.leadNumber },
                    {
                      label: 'Full name',
                      value: (
                        <span className="inline-flex items-center gap-2">
                          {formatPersonName(profile.fullName)}
                          <NsdlNameMatchMark matched={lead.panNameMatch} />
                        </span>
                      ),
                    },
                    { label: 'Date of birth', value: formatDateOnly(profile.dateOfBirth ?? undefined) },
                    { label: 'Age', value: ageFromDateOfBirth(profile.dateOfBirth ?? undefined) },
                    { label: 'PAN', value: profile.panNumber ?? '—' },
                    { label: 'PAN status', value: lead.panVerifiedLabel ?? '—' },
                    { label: 'Bureau', value: lead.bureauFetchedLabel ?? '—' },
                    { label: 'CIBIL', value: formatCibilScoreLabel(lead.bureauReport?.cibilScore) },
                    { label: 'Gender', value: profile.gender ?? '—' },
                    { label: 'Occupation', value: profile.occupation ?? '—' },
                  ]}
                />
                <DetailGrid
                  rows={[
                    { label: 'City', value: profile.city ?? '—' },
                    { label: 'State', value: profile.state ?? '—' },
                    { label: 'PIN', value: profile.pincode ?? '—' },
                    {
                      label: 'Address',
                      value: [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', ') || '—',
                    },
                    { label: 'Net monthly income', value: formatInr(profile.netMonthlyIncome) },
                    { label: 'Bureau consent', value: formatDateTime(profile.cibilConsentAt ?? undefined) },
                  ]}
                />
              </div>
            ) : (
              <p className="m-0 text-[0.88rem] text-brand-muted">No profile saved yet.</p>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 content-start">
          <SectionCard eyebrow="Attribution" title="Source & campaign" description="How this lead entered the funnel.">
            <DetailGrid rows={[{ label: 'Lead source', value: sourceSummary(lead) }]} />
            {lead.utm ? <div className="mt-3"><UtmGrid utm={lead.utm} /></div> : null}
          </SectionCard>

          {lead.applications.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[rgba(23,44,113,0.14)] bg-[rgba(248,250,255,0.5)] px-4 py-5 text-center text-[0.84rem] text-brand-muted">
              No application yet — customer is still in lead intake.
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <p className="m-0 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-brand-muted">Credit bureau</p>
          <h2 className="m-0 mt-0.5 text-[1.02rem] font-extrabold tracking-[-0.02em] text-brand-navy">CIBIL report</h2>
        </div>
        <ApplicationCibilReportTab
          leadUuid={lead.uuid}
          mobileNumber={lead.mobileNumber}
          fullName={profile?.fullName}
          panNumber={profile?.panNumber}
          onReportCreated={() => void load()}
        />
      </div>

      {lead.applications.length > 0 ? (
        <SectionCard eyebrow="Applications" title="Linked loan applications" description="Open an application for loan terms, bureau, KYC, and disbursement.">
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {lead.applications.map((application) => (
              <li key={application.uuid}>
                <article className="flex h-full flex-col rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Application</span>
                      <p className="m-0 mt-1 font-mono text-[0.72rem] font-bold text-brand-navy">{application.applicationNumber}</p>
                    </div>
                    <LosStatusPill code={application.statusCode} label={application.statusLabel} />
                  </div>
                  <dl className="m-0 mt-3 grid gap-1.5 border-t border-[rgba(23,44,113,0.06)] pt-2.5 text-[0.8rem]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-brand-muted">Amount</dt>
                      <dd className="m-0 font-bold text-brand-navy">{formatInr(application.loanAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-2 text-[0.75rem] text-brand-muted">
                      <dt>Opened</dt>
                      <dd className="m-0">{formatDateTime(application.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex justify-end gap-2 pt-3">
                    <Link
                      href={`/applications/${application.uuid}`}
                      className="inline-flex min-h-[34px] items-center rounded-full bg-brand-navy px-3.5 text-[0.75rem] font-extrabold text-white no-underline"
                    >
                      Open
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
