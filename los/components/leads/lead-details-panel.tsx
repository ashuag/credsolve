'use client';

import Link from 'next/link';
import { WorkspaceRecordHeader } from '@/components/shared/workspace-record-header';
import { LosStatusPill } from '@/components/shared/los-status-pill';
import { buildLeadIntakeJourney } from '@/lib/customer-journey';
import { formatPersonName } from '@/lib/format-person-name';
import { buildWorkspaceAlertText } from '@/lib/workspace-alert';
import { getLeadDetails, getMasters, rejectLead, type LosLeadDetails, type LosNamedMaster } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';

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

function RejectLeadModal({
  leadUuid,
  leadName,
  onClose,
  onRejected,
}: {
  leadUuid: string;
  leadName: string;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reasons, setReasons] = useState<LosNamedMaster[]>([]);
  const [reasonsLoading, setReasonsLoading] = useState(true);
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      setReasonsLoading(false);
      return;
    }
    void (async () => {
      try {
        const masters = await getMasters(token);
        if (!active) return;
        setReasons(masters.rejectionReasons.filter((r) => r.isActive));
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Failed to load rejection reasons.');
      } finally {
        if (active) setReasonsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reasonId) {
      setError('Please select a rejection reason.');
      return;
    }
    const token = getToken();
    if (!token) {
      setError('Session expired — please log in again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await rejectLead(token, leadUuid, {
        rejectionReasonId: Number(reasonId),
        note: note.trim() || undefined,
      });
      onRejected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject lead.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,28,66,0.4)] backdrop-blur-[4px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal
      aria-label="Reject lead"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[440px] rounded-[20px] border border-[rgba(23,44,113,0.12)] shadow-[0_32px_64px_rgba(23,44,113,0.22)] p-6"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,244,244,0.96))' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="mb-1 block text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-[#c0392b]">
              Reject lead
            </span>
            <h2 className="m-0 text-[1.3rem] font-extrabold leading-[1.1] tracking-[-0.04em] text-brand-navy">
              {leadName}
            </h2>
            <p className="m-0 mt-1.5 text-[0.8rem] leading-snug text-brand-muted">
              This sets the lead status to <strong className="text-[#8d3434]">Rejected</strong>. This cannot be undone from here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-[rgba(23,44,113,0.12)] bg-[rgba(255,255,255,0.9)] text-brand-navy transition-transform hover:-translate-y-px disabled:opacity-50"
            aria-label="Close"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            Rejection reason <span className="text-[#c0392b]">*</span>
          </span>
          <select
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value)}
            disabled={reasonsLoading || submitting}
            required
            className="w-full rounded-[10px] border border-[rgba(23,44,113,0.16)] bg-white px-3 py-2.5 text-[0.86rem] font-semibold text-brand-navy outline-none focus:border-[rgba(20,150,243,0.5)] disabled:opacity-60"
          >
            <option value="">{reasonsLoading ? 'Loading reasons…' : 'Select a reason…'}</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[0.7rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            Note <span className="font-bold normal-case tracking-normal text-brand-muted">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={256}
            rows={3}
            disabled={submitting}
            placeholder="Add context for this rejection…"
            className="w-full resize-none rounded-[10px] border border-[rgba(23,44,113,0.16)] bg-white px-3 py-2.5 text-[0.86rem] font-medium text-brand-navy outline-none focus:border-[rgba(20,150,243,0.5)] disabled:opacity-60"
          />
          <span className="mt-1 block text-right text-[0.66rem] font-semibold text-brand-muted">{note.length}/256</span>
        </label>

        {error ? (
          <p className="m-0 mt-3 rounded-[8px] border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.9)] px-3 py-2 text-[0.78rem] font-semibold text-[#8d3434]">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex min-h-[40px] items-center rounded-full border border-[rgba(23,44,113,0.14)] bg-white px-4 text-[0.82rem] font-bold text-brand-navy disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || reasonsLoading}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-[#c0392b] px-5 text-[0.82rem] font-extrabold text-white transition-colors hover:bg-[#a93226] disabled:opacity-60"
          >
            {submitting ? 'Rejecting…' : 'Reject lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function LeadDetailsPanel({ leadUuid }: { leadUuid: string }) {
  const [lead, setLead] = useState<LosLeadDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);

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
  const canReject = lead.statusCode !== 'REJECTED' && lead.statusCode !== 'CONVERTED';
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
        <div className="flex flex-wrap gap-2">
          {canReject ? (
            <button
              type="button"
              onClick={() => setShowReject(true)}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(192,57,43,0.3)] bg-[rgba(255,244,244,0.9)] px-4 text-[0.82rem] font-bold text-[#c0392b] shadow-sm transition-colors hover:border-[rgba(192,57,43,0.5)] hover:bg-[rgba(255,236,236,0.95)]"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
              Reject lead
            </button>
          ) : null}
          <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]">
            Refresh data
          </button>
        </div>
      </div>

      {showReject ? (
        <RejectLeadModal
          leadUuid={leadUuid}
          leadName={displayName}
          onClose={() => setShowReject(false)}
          onRejected={() => {
            setShowReject(false);
            void load();
          }}
        />
      ) : null}

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
          { label: 'PAN', value: lead.panVerifiedLabel ?? '—' },
          { label: 'Bureau', value: lead.bureauFetchedLabel ?? '—' },
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
                    { label: 'Full name', value: formatPersonName(profile.fullName) },
                    { label: 'Date of birth', value: formatDateOnly(profile.dateOfBirth ?? undefined) },
                    { label: 'Age', value: ageFromDateOfBirth(profile.dateOfBirth ?? undefined) },
                    { label: 'PAN', value: profile.panNumber ?? '—' },
                    { label: 'PAN status', value: lead.panVerifiedLabel ?? '—' },
                    { label: 'Bureau', value: lead.bureauFetchedLabel ?? '—' },
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

      {lead.applications.length > 0 ? (
        <SectionCard eyebrow="Applications" title="Linked loan applications" description="Open an application for loan terms, bureau, KYC, and disbursement.">
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {lead.applications.map((application) => (
              <li key={application.uuid}>
                <article className="flex h-full flex-col rounded-[14px] border border-[rgba(23,44,113,0.1)] bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Application</span>
                      <p className="m-0 mt-1 font-mono text-[0.72rem] font-bold text-brand-navy">{application.uuid.slice(0, 8)}…</p>
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
