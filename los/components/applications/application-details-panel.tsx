'use client';

import Link from 'next/link';
import { ApplicationCibilReportTab } from '@/components/applications/application-cibil-report-tab';
import { cx } from '@/components/eligibility/eligibility-ui';
import { createApplicationCibilReport, getApplicationDetails, fetchLosAuthenticatedBlob, type LosApplicationDetails } from '@/lib/api';
import { LOS_STORAGE_KEY } from '@/lib/auth';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

type ApplicationDetailsTab = 'overview' | 'cibil';

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

function leadSourceSummary(sourceName: string | null | undefined, sourceType: string | null | undefined): string {
  if (!sourceName) return 'Unattributed';
  return sourceType ? `${sourceName} · ${sourceType}` : sourceName;
}

function statusPillStyles(code: string): { bg: string; text: string; ring: string } {
  const c = code.toUpperCase();
  if (c === 'DRAFT') {
    return { bg: 'rgba(100,116,139,0.14)', text: '#334155', ring: 'rgba(100,116,139,0.28)' };
  }
  if (c === 'IN_REVIEW') {
    return { bg: 'rgba(255,197,25,0.18)', text: '#6b4e00', ring: 'rgba(245,158,11,0.35)' };
  }
  if (c.includes('APPROVED') || c.includes('DISBURS')) {
    return { bg: 'rgba(29,157,112,0.14)', text: '#14523a', ring: 'rgba(29,157,112,0.32)' };
  }
  if (c.includes('REJECT')) {
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

function AuthenticatedKycPhoto({
  token,
  path,
  label,
  emptyLabel,
  compact = false,
}: {
  token: string;
  path: string;
  label: string;
  emptyLabel: string;
  compact?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path.trim()) {
      setLoading(false);
      setError(null);
      setSrc(null);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setSrc(null);

    void fetchLosAuthenticatedBlob(token, path, `Failed to load ${label.toLowerCase()}.`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : `Failed to load ${label.toLowerCase()}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, path, label]);

  if (compact) {
    return (
      <figure className="m-0 w-[112px] shrink-0 overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white">
        <figcaption className="border-b border-[rgba(23,44,113,0.07)] px-2 py-1.5 text-center text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-brand-muted">
          {label}
        </figcaption>
        <div className="flex h-[132px] items-center justify-center bg-[rgba(248,250,255,0.9)] p-1.5">
          {loading ? (
            <span className="text-[0.68rem] font-semibold text-brand-muted">…</span>
          ) : error ? (
            <span className="px-1 text-center text-[0.62rem] font-semibold leading-tight text-[#8d3434]">Unavailable</span>
          ) : src ? (
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
        {loading ? (
          <span className="text-[0.84rem] font-semibold text-brand-muted">Loading photo…</span>
        ) : error ? (
          <span className="px-3 text-center text-[0.82rem] font-semibold text-[#8d3434]">{error}</span>
        ) : src ? (
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
  const [activeTab, setActiveTab] = useState<ApplicationDetailsTab>('overview');
  const [creatingBureau, setCreatingBureau] = useState(false);
  const [bureauActionError, setBureauActionError] = useState<string | null>(null);

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
  const canCreateBureauReport = Boolean(
    authToken &&
      row.leadUuid &&
      row.mobileNumber &&
      row.lead.panNumber?.trim() &&
      profile?.fullName?.trim(),
  );

  return (
    <div className="grid gap-5 pb-2">
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

      <header className="los-card relative overflow-hidden p-5 md:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-90 blur-2xl"
          style={{ background: 'radial-gradient(circle, rgba(20,150,243,0.22), transparent 68%)' }}
          aria-hidden
        />
        <div className="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <span className="los-chip mb-3">Loan application</span>
            <h1 className="m-0 text-[1.45rem] font-extrabold leading-tight tracking-[-0.04em] text-brand-navy md:text-[1.75rem]">
              {displayName}
            </h1>
            <p className="m-0 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-brand-muted">
              <span className="font-bold text-brand-text">{row.mobileNumber}</span>
              <span className="hidden text-brand-muted sm:inline" aria-hidden>
                ·
              </span>
              <span className="min-w-0 break-all">{row.email ?? 'Email not captured on application'}</span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill code={row.statusCode} label={row.statusLabel} />
              <span className="inline-flex items-center rounded-full border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.75)] px-3 py-1 text-[0.72rem] font-bold text-brand-muted">
                Lead status:{' '}
                <span className="ml-1 text-brand-text">{row.lead.statusLabel}</span>
              </span>
              <span className="inline-flex items-center rounded-full border border-[rgba(23,44,113,0.1)] bg-[rgba(255,255,255,0.75)] px-3 py-1 text-[0.72rem] font-bold text-brand-muted">
                Lead source:{' '}
                <span className="ml-1 text-brand-text">
                  {leadSourceSummary(row.lead.sourceName, row.lead.sourceType)}
                </span>
              </span>
            </div>
            <p className="m-0 mt-3 text-[0.78rem] font-semibold text-brand-muted">
              Opened {formatDateTime(row.createdAt)} · Updated {formatDateTime(row.updatedAt)}
            </p>
          </div>
          {authToken ? (
            <div className="flex flex-wrap gap-3 lg:justify-self-end">
              {row.kycPhotos.aadhaarPhotoUrl ? (
                <AuthenticatedKycPhoto
                  token={authToken}
                  path={row.kycPhotos.aadhaarPhotoUrl}
                  label="Aadhaar pic"
                  emptyLabel="Not available"
                  compact
                />
              ) : (
                <figure className="m-0 w-[112px] shrink-0 overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white">
                  <figcaption className="border-b border-[rgba(23,44,113,0.07)] px-2 py-1.5 text-center text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-brand-muted">
                    Aadhaar pic
                  </figcaption>
                  <div className="flex h-[132px] items-center justify-center bg-[rgba(248,250,255,0.9)] p-1.5">
                    <span className="px-1 text-center text-[0.62rem] font-semibold leading-tight text-brand-muted">Not available</span>
                  </div>
                </figure>
              )}
              {row.kycPhotos.selfieUrl ? (
                <AuthenticatedKycPhoto
                  token={authToken}
                  path={row.kycPhotos.selfieUrl}
                  label="Selfie"
                  emptyLabel="Not captured"
                  compact
                />
              ) : (
                <figure className="m-0 w-[112px] shrink-0 overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white">
                  <figcaption className="border-b border-[rgba(23,44,113,0.07)] px-2 py-1.5 text-center text-[0.62rem] font-extrabold uppercase tracking-[0.06em] text-brand-muted">
                    Selfie
                  </figcaption>
                  <div className="flex h-[132px] items-center justify-center bg-[rgba(248,250,255,0.9)] p-1.5">
                    <span className="px-1 text-center text-[0.62rem] font-semibold leading-tight text-brand-muted">Not captured</span>
                  </div>
                </figure>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <nav
        className="los-card flex flex-wrap gap-1 p-1.5"
        aria-label="Application workspace sections"
      >
        {(
          [
            { id: 'overview' as const, label: 'Overview' },
            { id: 'cibil' as const, label: 'CIBIL report' },
          ] satisfies Array<{ id: ApplicationDetailsTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'min-h-[40px] flex-1 rounded-[10px] px-4 text-[0.84rem] font-extrabold transition-colors sm:flex-none',
              activeTab === tab.id
                ? 'bg-brand-navy text-white shadow-sm'
                : 'text-brand-navy hover:bg-[rgba(23,44,113,0.06)]',
            )}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
            {tab.id === 'cibil' && row.bureauReport?.cibilScore != null ? (
              <span
                className={cx(
                  'ml-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold',
                  activeTab === tab.id
                    ? 'bg-[rgba(255,255,255,0.2)]'
                    : 'bg-[rgba(20,150,243,0.12)] text-brand-blue',
                )}
              >
                {row.bureauReport.cibilScore}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {activeTab === 'cibil' ? (
        <ApplicationCibilReportTab applicationUuid={applicationUuid} />
      ) : null}

      {activeTab === 'overview' ? (
      <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          eyebrow="Identifiers"
          title="Application & lead references"
          description="Cross-link support tickets, underwriting queues, and disbursement files."
        >
          <DetailGrid
            rows={[
              { label: 'Application UUID', value: <MonoValue copyLabel="Application UUID">{row.uuid}</MonoValue> },
              { label: 'Lead UUID', value: <MonoValue copyLabel="Lead UUID">{row.leadUuid}</MonoValue> },
              { label: 'Customer UUID', value: <MonoValue copyLabel="Customer UUID">{row.customerUuid}</MonoValue> },
              { label: 'Lead source', value: leadSourceSummary(row.lead.sourceName, row.lead.sourceType) },
            ]}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Contact"
          title="Verified contact on file"
          description="Login email captured against the application record (not the lead row)."
        >
          <DetailGrid
            rows={[
              { label: 'Email on application', value: row.email ?? '—' },
              { label: 'Email verified at', value: formatDateTime(row.emailVerifiedAt ?? undefined) },
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Borrower profile"
        title="Lead snapshot (shared intake)"
        description="Same onboarding facts as on the lead page; shown here so credit analysts do not need to switch context."
      >
        {profile ? (
          <DetailGrid
            rows={[
              { label: 'Full name as per PAN card', value: profile.fullName ?? '—' },
              { label: 'Date of birth', value: formatDateOnly(profile.dateOfBirth ?? undefined) },
              { label: 'Age', value: ageFromDateOfBirth(profile.dateOfBirth ?? undefined) },
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
              { label: 'Bureau consent at', value: formatDateTime(profile.cibilConsentAt ?? undefined) },
            ]}
          />
        ) : (
          <p className="m-0 text-[0.9rem] text-brand-muted">No lead profile rows are linked to this application yet.</p>
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          eyebrow="Product"
          title="Loan terms & fees"
          description="Structured offer fields from application details."
        >
          {row.details ? (
            <DetailGrid
              rows={[
                { label: 'Reason for loan', value: row.details.reasonForLoan ?? '—' },
                { label: 'Requested amount', value: formatInr(row.details.loanAmount) },
                {
                  label: 'Tenure',
                  value: row.details.loanTenure != null ? `${row.details.loanTenure} months` : '—',
                },
                { label: 'Pre-approved amount', value: formatInr(row.preApprovedLoanAmount) },
                { label: 'Interest rate', value: row.details.interestRate != null ? `${row.details.interestRate}%` : '—' },
                { label: 'Interest amount', value: formatInr(row.details.interestAmount) },
                { label: 'Processing fee %', value: row.details.processingFee != null ? `${row.details.processingFee}%` : '—' },
                { label: 'Processing fee amount', value: formatInr(row.details.processingFeeAmount) },
                { label: 'GST amount', value: formatInr(row.details.gstAmount) },
                { label: 'Disbursement date (planned)', value: formatDateOnly(row.details.loanDisbursementDate ?? undefined) },
                { label: 'Maturity date (planned)', value: formatDateOnly(row.details.loanMaturityDate ?? undefined) },
              ]}
            />
          ) : (
            <p className="m-0 text-[0.9rem] text-brand-muted">No application_details row exists yet.</p>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Verification"
          title="KYC & liveness"
          description="Verification status from onboarding."
        >
          <DetailGrid
            rows={[
              { label: 'KYC status', value: `${row.kycStatusLabel} (${row.kycStatus})` },
              { label: 'KYC completed at', value: formatDateTime(row.kycCompletedAt ?? undefined) },
              { label: 'Liveness passed', value: row.livenessPassed ? 'Yes' : 'No' },
              { label: 'Liveness checked at', value: formatDateTime(row.livenessCheckedAt ?? undefined) },
            ]}
          />
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          eyebrow="Credit"
          title="Eligibility outcome"
          description="Latest bureau / rules snapshot tied to this application."
        >
          {row.eligibility ? (
            <DetailGrid
              rows={[
                { label: 'Eligible', value: row.eligibility.isEligible ? 'Yes' : 'No' },
                { label: 'Approved amount', value: formatInr(row.eligibility.approvedAmount) },
                { label: 'CIBIL score', value: row.eligibility.cibilScore != null ? String(row.eligibility.cibilScore) : '—' },
                { label: 'Ineligible reason', value: row.eligibility.ineligibleReason ?? '—' },
                { label: 'Checked at', value: formatDateTime(row.eligibility.checkedAt) },
                {
                  label: 'Full bureau view',
                  value: row.bureauReport ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('cibil')}
                        className="border-0 bg-transparent p-0 font-bold text-brand-blue underline"
                      >
                        Open CIBIL report tab
                      </button>
                      {row.bureauReport.reportPdfUrl ? (
                        <a
                          href={row.bureauReport.reportPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-brand-blue underline"
                        >
                          Download report PDF
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <span>No bureau pull on file</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="los-btn-primary min-h-[34px] px-3 text-[0.78rem]"
                          disabled={!canCreateBureauReport || creatingBureau}
                          onClick={() => {
                            if (!authToken) {
                              setBureauActionError('Session expired - please log in again.');
                              return;
                            }
                            if (!profile?.fullName?.trim() || !row.lead.panNumber?.trim()) {
                              setBureauActionError('Full name and PAN are required to create CIBIL report.');
                              return;
                            }
                            setBureauActionError(null);
                            setCreatingBureau(true);
                            void createApplicationCibilReport(authToken, {
                              leadUuid: row.leadUuid,
                              mobileNumber: row.mobileNumber,
                              fullName: profile.fullName.trim(),
                              panNumber: row.lead.panNumber.trim().toUpperCase(),
                            })
                              .then(async () => {
                                await load();
                                setActiveTab('cibil');
                              })
                              .catch((actionError) => {
                                setBureauActionError(
                                  actionError instanceof Error
                                    ? actionError.message
                                    : 'Unable to create CIBIL report.',
                                );
                              })
                              .finally(() => setCreatingBureau(false));
                          }}
                        >
                          {creatingBureau ? 'Creating report...' : 'Create CIBIL report'}
                        </button>
                        {!canCreateBureauReport ? (
                          <span className="text-[0.78rem] text-brand-muted">
                            Requires full name and PAN on lead profile.
                          </span>
                        ) : null}
                      </div>
                      {bureauActionError ? (
                        <span className="text-[0.8rem] font-semibold text-[#8d3434]">{bureauActionError}</span>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <p className="m-0 text-[0.9rem] text-brand-muted">No eligibility check has been stored for this application.</p>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Agreement"
          title="E-sign & legal"
          description="Agreement metadata after the borrower completes signing."
        >
          {row.agreement ? (
            <DetailGrid
              rows={[
                { label: 'Document', value: row.agreement.documentName ?? '—' },
                { label: 'Signed at', value: formatDateTime(row.agreement.signedAt ?? undefined) },
                { label: 'IP address', value: row.agreement.ipAddress ?? '—' },
              ]}
            />
          ) : (
            <p className="m-0 text-[0.9rem] text-brand-muted">No agreement record yet.</p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Disbursement"
        title="Payout & bank confirmation"
        description="Post-approval settlement details when disbursement is executed."
      >
        {row.disbursement ? (
          <DetailGrid
            rows={[
              { label: 'Amount', value: formatInr(row.disbursement.amount) },
              { label: 'Account number', value: row.disbursement.accountNumber ?? '—' },
              { label: 'IFSC', value: row.disbursement.ifscCode ?? '—' },
              { label: 'Bank', value: row.disbursement.bankName ?? '—' },
              { label: 'UTR', value: row.disbursement.utr ?? '—' },
              { label: 'Disbursed at', value: formatDateTime(row.disbursement.disbursedAt ?? undefined) },
            ]}
          />
        ) : (
          <p className="m-0 text-[0.9rem] text-brand-muted">No disbursement record yet.</p>
        )}
      </SectionCard>
      </div>
      ) : null}
    </div>
  );
}
