'use client';

import Link from 'next/link';
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

function statusPillStyles(code: string): { bg: string; text: string; ring: string } {
  const c = code.toUpperCase();
  if (c === 'NEW') {
    return { bg: 'rgba(20,150,243,0.14)', text: '#0b4f86', ring: 'rgba(20,150,243,0.35)' };
  }
  if (c === 'DRAFT') {
    return { bg: 'rgba(100,116,139,0.14)', text: '#334155', ring: 'rgba(100,116,139,0.28)' };
  }
  if (c === 'CONVERTED' || c.includes('APPROVED') || c.includes('DISBURS')) {
    return { bg: 'rgba(29,157,112,0.14)', text: '#14523a', ring: 'rgba(29,157,112,0.32)' };
  }
  if (c.includes('REJECT') || c.includes('DECLIN') || c.includes('CANCEL')) {
    return { bg: 'rgba(231,95,95,0.14)', text: '#8d3434', ring: 'rgba(231,95,95,0.28)' };
  }
  return { bg: 'rgba(23,44,113,0.08)', text: '#172c71', ring: 'rgba(23,44,113,0.16)' };
}

function StatusPill({ code, label }: { code: string; label: string }) {
  const s = statusPillStyles(code);
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.07em] ring-1 ring-inset"
      style={{ backgroundColor: s.bg, color: s.text, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="los-card overflow-hidden">
      <div className="border-b border-[var(--los-panel-border)] bg-[rgba(20,150,243,0.04)] px-5 py-4 md:px-6">
        <span className="los-chip mb-2">{eyebrow}</span>
        <h2 className="m-0 text-[1.05rem] font-extrabold tracking-[-0.02em] text-brand-navy md:text-[1.15rem]">{title}</h2>
        {description ? (
          <p className="m-0 mt-1.5 max-w-[62ch] text-[0.84rem] leading-relaxed text-brand-muted">{description}</p>
        ) : null}
      </div>
      <div className="px-5 py-4 md:px-6 md:py-5">{children}</div>
    </section>
  );
}

function DetailGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="m-0 divide-y divide-[rgba(23,44,113,0.08)]">
      {rows.map((row, idx) => (
        <div key={`${row.label}-${idx}`} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-start sm:gap-4">
          <dt className="text-[0.72rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">{row.label}</dt>
          <dd className="m-0 min-w-0 text-[0.92rem] font-semibold text-brand-text">{row.value}</dd>
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

  const displayName = lead.profile?.fullName?.trim() || 'Lead (name pending)';
  const profile = lead.profile;

  return (
    <div className="grid gap-5 pb-2">
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
        <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]">
          Refresh data
        </button>
      </div>

      {/* Hero */}
      <header className="los-card relative overflow-hidden p-5 md:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-90 blur-2xl"
          style={{ background: 'radial-gradient(circle, rgba(20,150,243,0.22), transparent 68%)' }}
          aria-hidden
        />
        <div className="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <span className="los-chip mb-3">Loan pipeline</span>
            <h1 className="m-0 text-[1.45rem] font-extrabold leading-tight tracking-[-0.04em] text-brand-navy md:text-[1.75rem]">
              {displayName}
            </h1>
            <p className="m-0 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-brand-muted">
              <span className="font-bold text-brand-text">{lead.mobileNumber}</span>
              <span className="hidden text-brand-muted sm:inline" aria-hidden>
                ·
              </span>
              <span className="min-w-0 break-all">{lead.email ?? 'Email not captured'}</span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill code={lead.statusCode} label={lead.statusLabel} />
              <span className="inline-flex items-center rounded-full border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.75)] px-3 py-1 text-[0.72rem] font-bold text-brand-muted">
                Source: <span className="ml-1 text-brand-text">{sourceSummary(lead)}</span>
              </span>
            </div>
          </div>
          <div className="grid w-full max-w-sm gap-2 rounded-[14px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.72)] p-4 text-[0.82rem] lg:justify-self-end">
            <div className="flex justify-between gap-3 border-b border-[rgba(23,44,113,0.06)] pb-2">
              <span className="font-extrabold uppercase tracking-[0.08em] text-brand-muted">Created</span>
              <span className="text-right font-semibold text-brand-text">{formatDateTime(lead.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-3 pt-0.5">
              <span className="font-extrabold uppercase tracking-[0.08em] text-brand-muted">Updated</span>
              <span className="text-right font-semibold text-brand-text">{formatDateTime(lead.updatedAt)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          eyebrow="Identifiers"
          title="Lead & customer references"
          description="Stable IDs for CRM, underwriting, and support. Use copy when pasting into tickets or tools."
        >
          <DetailGrid
            rows={[
              {
                label: 'Lead UUID',
                value: <MonoValue copyLabel="Lead UUID">{lead.uuid}</MonoValue>,
              },
              {
                label: 'Customer UUID',
                value: <MonoValue copyLabel="Customer UUID">{lead.customerUuid}</MonoValue>,
              },
            ]}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Attribution"
          title="Acquisition context"
          description="How this lead entered the funnel — CRM source or last-touch UTM, when available."
        >
          {lead.utm ? <UtmGrid utm={lead.utm} /> : (
            <p className="m-0 text-[0.88rem] text-brand-muted">No campaign attribution payload was stored for this lead.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Borrower profile"
        title="Onboarding & KYC snapshot"
        description="Facts captured during onboarding. Empty fields usually mean the customer has not completed that step yet."
      >
        {profile ? (
          <DetailGrid
            rows={[
              { label: 'Full name', value: profile.fullName ?? '—' },
              { label: 'PAN', value: profile.panNumber ?? '—' },
              { label: 'Gender', value: profile.gender ?? '—' },
              { label: 'Occupation', value: profile.occupation ?? '—' },
              { label: 'City', value: profile.city ?? '—' },
              { label: 'State', value: profile.state ?? '—' },
              { label: 'State code', value: profile.stateCode ?? '—' },
              { label: 'PIN code', value: profile.pincode ?? '—' },
              {
                label: 'Address',
                value: [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', ') || '—',
              },
              { label: 'Net monthly income', value: formatInr(profile.netMonthlyIncome) },
              { label: 'Annual turnover', value: formatInr(profile.annualTurnover) },
              { label: 'Annual profit', value: formatInr(profile.annualProfit) },
              { label: 'CIBIL consent at', value: formatDateTime(profile.cibilConsentAt ?? undefined) },
            ]}
          />
        ) : (
          <p className="m-0 text-[0.9rem] text-brand-muted">No profile has been saved for this lead yet.</p>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Applications"
        title="Linked loan applications"
        description="Each row is an application spawned from this lead. Status reflects the origination workflow stage."
      >
        {lead.applications.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[rgba(23,44,113,0.16)] bg-[rgba(248,250,255,0.5)] px-4 py-8 text-center">
            <p className="m-0 text-[0.9rem] font-semibold text-brand-navy">No applications yet</p>
            <p className="m-0 mt-1 text-[0.84rem] text-brand-muted">When the customer starts an application, it will appear here.</p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {lead.applications.map((application) => (
              <li key={application.uuid}>
                <article className="flex h-full flex-col rounded-[16px] border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.92)] p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">Application</span>
                      <p className="m-0 mt-1 font-mono text-[0.78rem] font-bold leading-snug text-brand-navy">{application.uuid}</p>
                    </div>
                    <StatusPill code={application.statusCode} label={application.statusLabel} />
                  </div>
                  <dl className="m-0 mt-4 grid gap-2 border-t border-[rgba(23,44,113,0.06)] pt-3 text-[0.84rem]">
                    <div className="flex justify-between gap-2">
                      <dt className="font-bold text-brand-muted">Loan amount</dt>
                      <dd className="m-0 font-extrabold text-brand-navy">{formatInr(application.loanAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="font-bold text-brand-muted">Tenure</dt>
                      <dd className="m-0 font-semibold text-brand-text">
                        {application.loanTenure != null ? `${application.loanTenure} months` : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 text-[0.78rem] text-brand-muted">
                      <dt>Opened</dt>
                      <dd className="m-0">{formatDateTime(application.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex justify-end border-t border-[rgba(23,44,113,0.04)] pt-3">
                    <CopyIdButton value={application.uuid} label="Application UUID" />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
