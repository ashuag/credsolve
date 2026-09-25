'use client';

import Link from 'next/link';
import { WorkspaceRecordHeader } from '@/components/shared/workspace-record-header';
import { LosStatusPill } from '@/components/shared/los-status-pill';
import { formatPersonName } from '@/lib/format-person-name';
import { getCustomerDetails, type LosCustomerDetails } from '@/lib/api';
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

function formatInr(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function SectionCard({
  eyebrow, title, children,
}: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section
      className="overflow-hidden rounded-[12px] border border-[rgba(15,39,72,0.09)]"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))' }}
    >
      <div className="flex items-center gap-2 border-b border-[rgba(15,39,72,0.07)] bg-[rgba(248,250,255,0.7)] px-4 py-2.5">
        <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: 'rgba(94,103,130,0.6)' }}>{eyebrow}</span>
        <span className="w-px h-3 bg-[rgba(15,39,72,0.1)]" aria-hidden />
        <h2 className="m-0 text-[0.88rem] font-extrabold tracking-[-0.01em] text-brand-navy">{title}</h2>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function DetailGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="m-0 divide-y divide-[rgba(15,39,72,0.06)]">
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
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-[rgba(15,39,72,0.12)] bg-[rgba(255,255,255,0.85)] px-2.5 text-[0.72rem] font-bold text-brand-navy transition-colors hover:border-[rgba(34,197,94,0.35)]"
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

function activeLead(customer: LosCustomerDetails) {
  return customer.leads.find((lead) => lead.isActive) ?? customer.leads[0] ?? null;
}

export function CustomerDetailsPanel({ customerUuid }: { customerUuid: string }) {
  const [customer, setCustomer] = useState<LosCustomerDetails | null>(null);
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
      const data = await getCustomerDetails(token, customerUuid);
      setCustomer(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer details.');
    } finally {
      setLoading(false);
    }
  }, [customerUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="los-card p-8">
        <div className="mx-auto max-w-md animate-pulse space-y-4">
          <div className="h-4 w-40 rounded bg-[rgba(15,39,72,0.08)]" />
          <div className="h-10 w-full max-w-lg rounded-lg bg-[rgba(15,39,72,0.06)]" />
          <div className="h-24 rounded-xl bg-[rgba(15,39,72,0.05)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-32 rounded-xl bg-[rgba(15,39,72,0.05)]" />
            <div className="h-32 rounded-xl bg-[rgba(15,39,72,0.05)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="los-card border border-[rgba(231,95,95,0.28)] bg-[rgba(255,241,241,0.88)] p-6 text-[0.92rem] text-[#8d3434]">
        <strong className="font-extrabold">Unable to load this customer.</strong>
        <p className="m-0 mt-2 leading-relaxed">{error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/customers"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(15,39,72,0.14)] bg-[rgba(255,255,255,0.9)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline"
          >
            Back to customers
          </Link>
          <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="los-card p-6 text-[0.9rem] text-brand-muted">
        Customer not found.
      </div>
    );
  }

  const profile = customer.profile;
  const displayName = formatPersonName(profile?.fullName, 'Customer (name pending)');
  const currentLead = activeLead(customer);
  const latestApplication = customer.applications[0] ?? null;

  return (
    <div className="grid gap-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/customers"
          className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[rgba(15,39,72,0.12)] bg-[rgba(255,255,255,0.88)] px-4 text-[0.82rem] font-bold text-brand-navy no-underline shadow-sm transition-colors hover:border-[rgba(34,197,94,0.28)]"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back to customers
        </Link>
        <button type="button" onClick={() => void load()} className="los-btn-primary min-h-[38px] px-4 text-[0.82rem]">
          Refresh data
        </button>
      </div>

      <WorkspaceRecordHeader
        eyebrow="Customer profile"
        title={displayName}
        mobile={customer.mobileNumber}
        email={latestApplication?.email ?? null}
        statusCode={currentLead?.statusCode ?? 'REGISTERED'}
        statusLabel={currentLead?.statusLabel ?? 'Registered'}
        sourceLabel={currentLead?.sourceName ?? 'Customer account'}
        rejectionReason={currentLead?.rejectionReason?.label}
        alertText={
          customer.isBlacklisted
            ? 'This customer is blacklisted and cannot proceed with a new application.'
            : currentLead?.leadStatusNote ?? undefined
        }
        createdAt={formatDateTime(customer.createdAt)}
        updatedAt={formatDateTime(customer.updatedAt)}
        quickStats={[
          { label: 'Leads', value: String(customer.leads.length) },
          { label: 'Applications', value: String(customer.applications.length) },
          { label: 'KYC', value: customer.kycVerifiedAt ? 'Verified' : 'Pending' },
        ]}
        journeyTitle="Account overview"
        journeySubtitle="Customer identity across leads and loan applications"
        journeySteps={[
          {
            id: 'registered',
            label: 'Registered',
            state: 'done',
            detail: formatDateOnly(customer.createdAt),
          },
          {
            id: 'lead',
            label: 'Lead intake',
            state: customer.leads.length > 0 ? 'done' : 'pending',
            detail: customer.leads.length > 0 ? `${customer.leads.length} lead(s)` : undefined,
          },
          {
            id: 'application',
            label: 'Application',
            state: customer.applications.length > 0 ? 'done' : 'pending',
            detail: customer.applications.length > 0 ? `${customer.applications.length} app(s)` : undefined,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <SectionCard eyebrow="Identity" title="Customer information">
            <div className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
              <DetailGrid
                rows={[
                  { label: 'Customer UUID', value: <MonoValue copyLabel="Customer UUID">{customer.uuid}</MonoValue> },
                  { label: 'Mobile', value: customer.mobileNumber },
                  { label: 'Registered', value: formatDateTime(customer.createdAt) },
                  { label: 'Last updated', value: formatDateTime(customer.updatedAt) },
                  { label: 'Blacklisted', value: customer.isBlacklisted ? 'Yes' : 'No' },
                  { label: 'KYC verified', value: formatDateTime(customer.kycVerifiedAt) },
                ]}
              />
              {profile ? (
                <DetailGrid
                  rows={[
                    { label: 'Full name', value: formatPersonName(profile.fullName) },
                    { label: 'Date of birth', value: formatDateOnly(profile.dateOfBirth ?? undefined) },
                    { label: 'PAN', value: profile.panNumber ?? '—' },
                    { label: 'Gender', value: profile.gender ?? '—' },
                    { label: 'Occupation', value: profile.occupation ?? '—' },
                    { label: 'Email ID', value: profile.emailId ?? '—' },
                    { label: 'City', value: profile.city ?? '—' },
                  ]}
                />
              ) : (
                <p className="m-0 text-[0.88rem] text-brand-muted">No profile captured yet.</p>
              )}
            </div>
          </SectionCard>

          {profile ? (
            <SectionCard eyebrow="Profile" title="Latest onboarding snapshot">
              <div className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
                <DetailGrid
                  rows={[
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
            </SectionCard>
          ) : null}
        </div>

        <div className="grid gap-4 content-start">
          <SectionCard eyebrow="Summary" title="Pipeline counts">
            <DetailGrid
              rows={[
                { label: 'Total leads', value: String(customer.leads.length) },
                { label: 'Active leads', value: String(customer.leads.filter((l) => l.isActive).length) },
                { label: 'Applications', value: String(customer.applications.length) },
                {
                  label: 'Latest lead status',
                  value: currentLead ? (
                    <LosStatusPill code={currentLead.statusCode} label={currentLead.statusLabel} />
                  ) : (
                    '—'
                  ),
                },
              ]}
            />
          </SectionCard>
        </div>
      </div>

      <SectionCard eyebrow="Leads" title="Lead history">
        {customer.leads.length === 0 ? (
          <p className="m-0 text-[0.88rem] text-brand-muted">No leads for this customer yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {customer.leads.map((lead) => (
              <li key={lead.uuid}>
                <article className="flex h-full flex-col rounded-[14px] border border-[rgba(15,39,72,0.1)] bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Lead</span>
                      <p className="m-0 mt-1 font-mono text-[0.72rem] font-bold text-brand-navy">{lead.uuid.slice(0, 8)}…</p>
                    </div>
                    <LosStatusPill code={lead.statusCode} label={lead.statusLabel} />
                  </div>
                  <dl className="m-0 mt-3 grid gap-1.5 border-t border-[rgba(15,39,72,0.06)] pt-2.5 text-[0.8rem]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-brand-muted">Active</dt>
                      <dd className="m-0 font-bold text-brand-navy">{lead.isActive ? 'Yes' : 'No'}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-brand-muted">Applications</dt>
                      <dd className="m-0 font-bold text-brand-navy">{lead.applicationCount}</dd>
                    </div>
                    <div className="flex justify-between gap-2 text-[0.75rem] text-brand-muted">
                      <dt>Opened</dt>
                      <dd className="m-0">{formatDateTime(lead.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex justify-end gap-2 pt-3">
                    <Link
                      href={`/leads/${lead.uuid}`}
                      className="inline-flex min-h-[34px] items-center rounded-full bg-brand-navy px-3.5 text-[0.75rem] font-extrabold text-white no-underline"
                    >
                      Open lead
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard eyebrow="Applications" title="Loan applications">
        {customer.applications.length === 0 ? (
          <p className="m-0 text-[0.88rem] text-brand-muted">No applications yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {customer.applications.map((application) => (
              <li key={application.uuid}>
                <article className="flex h-full flex-col rounded-[14px] border border-[rgba(15,39,72,0.1)] bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">Application</span>
                      <p className="m-0 mt-1 font-mono text-[0.72rem] font-bold text-brand-navy">{application.applicationNumber}</p>
                    </div>
                    <LosStatusPill code={application.statusCode} label={application.statusLabel} />
                  </div>
                  <dl className="m-0 mt-3 grid gap-1.5 border-t border-[rgba(15,39,72,0.06)] pt-2.5 text-[0.8rem]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-brand-muted">Amount</dt>
                      <dd className="m-0 font-bold text-brand-navy">{formatInr(application.loanAmount)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-brand-muted">KYC</dt>
                      <dd className="m-0 font-bold text-brand-navy">{application.kycStatusLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-2 text-[0.75rem] text-brand-muted">
                      <dt>Opened</dt>
                      <dd className="m-0">{formatDateTime(application.createdAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex flex-wrap justify-end gap-2 pt-3">
                    <Link
                      href={`/leads/${application.leadUuid}`}
                      className="inline-flex min-h-[34px] items-center rounded-full border border-[rgba(15,39,72,0.14)] bg-white px-3.5 text-[0.75rem] font-extrabold text-brand-navy no-underline"
                    >
                      Lead
                    </Link>
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
        )}
      </SectionCard>
    </div>
  );
}
