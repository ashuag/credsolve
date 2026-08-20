'use client';

import { losStatusPillStyles } from '@/components/shared/los-status-pill';
import { formatCibilScoreLabel, formatReviewDateOnly, formatReviewDateTime, formatReviewInr } from '@/lib/application-review-format';
import { getLeadReportDetails, type LosLeadReportDetails } from '@/lib/api';
import { getLosToken } from '@/lib/auth';
import { formatPersonName } from '@/lib/format-person-name';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

function StatusBadge({ code, label }: { code: string | null; label: string | null }) {
  if (!code || !label || code === 'NOT_APPLICABLE') {
    return <span className="text-brand-muted">—</span>;
  }
  const s = losStatusPillStyles(code);
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
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-[12px] border border-[rgba(23,44,113,0.09)]"
      style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,246,255,0.95))' }}
    >
      <div className="flex items-center gap-2 border-b border-[rgba(23,44,113,0.07)] bg-[rgba(248,250,255,0.7)] px-4 py-2.5">
        <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.14em]" style={{ color: 'rgba(94,103,130,0.6)' }}>
          {eyebrow}
        </span>
        <span className="h-3 w-px bg-[rgba(23,44,113,0.1)]" aria-hidden />
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
          <dt className="w-[148px] flex-shrink-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] leading-tight text-brand-muted">
            {row.label}
          </dt>
          <dd className="m-0 min-w-0 flex-1 text-[0.84rem] font-semibold leading-snug text-brand-text">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatPercent(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return `${n}%`;
}

function formatTenure(days: number | null | undefined): string {
  if (days == null) return '—';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function samePublicId(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = left?.trim().toUpperCase();
  const b = right?.trim().toUpperCase();
  return Boolean(a && b && a === b);
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[34px] items-center rounded-full border border-[rgba(23,44,113,0.12)] bg-white px-4 text-[0.78rem] font-bold text-brand-navy no-underline hover:border-[rgba(20,150,243,0.35)]"
    >
      {children}
    </Link>
  );
}

export function LeadReportDetailPanel({ leadUuid }: { leadUuid: string }) {
  const [row, setRow] = useState<LosLeadReportDetails | null>(null);
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
      setRow(await getLeadReportDetails(token, leadUuid));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lead report');
    } finally {
      setLoading(false);
    }
  }, [leadUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = formatPersonName(row?.panCardName ?? row?.fullName, 'Lead report');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/reports/lead-report"
            className="text-[0.8rem] font-bold text-brand-blue no-underline hover:underline"
          >
            ← Lead Report
          </Link>
          <h1 className="m-0 mt-1 text-[1.35rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            {loading ? 'Loading report…' : name}
          </h1>
          {row ? (
            <p className="m-0 mt-1 text-[0.86rem] text-brand-muted">
              {row.leadNumber}
              {row.mobileNumber ? ` · ${row.mobileNumber}` : ''}
              {row.panNumber ? ` · ${row.panNumber}` : ''}
            </p>
          ) : null}
        </div>
        {row ? (
          <div className="flex flex-wrap items-center gap-2">
            <GhostLink href={`/leads/${row.uuid}`}>Open lead</GhostLink>
            {row.applicationUuid ? (
              <GhostLink href={`/applications/${row.applicationUuid}`}>Open application</GhostLink>
            ) : null}
            {row.loanUuid ? <GhostLink href={`/loans/${row.loanUuid}`}>Open loan</GhostLink> : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-[10px] border border-[rgba(231,95,95,0.22)] bg-[rgba(255,241,241,0.92)] p-[10px_14px] text-[0.86rem] text-[#8d3434]">
          {error}
        </div>
      ) : null}

      {row ? (
        <>
          <div className="flex flex-wrap gap-2">
            <StatusBadge code={row.leadStatusCode} label={row.leadStatusLabel} />
            <StatusBadge code={row.applicationStatusCode} label={row.applicationStatusLabel} />
            <StatusBadge code={row.loanStatusCode} label={row.loanStatusLabel} />
            <StatusBadge code={row.repaymentStatusCode} label={row.repaymentStatusLabel} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard eyebrow="Borrower" title="Profile">
              <DetailGrid
                rows={[
                  { label: 'PAN card name', value: formatPersonName(row.panCardName) },
                  { label: 'Date of birth', value: formatReviewDateOnly(row.dateOfBirth) },
                  { label: 'PAN', value: row.panNumber ?? '—' },
                  { label: 'Gender', value: row.gender ?? '—' },
                  { label: 'Occupation', value: row.occupation ?? '—' },
                  { label: 'City', value: row.city ?? '—' },
                  { label: 'State', value: row.state ?? '—' },
                  { label: 'PIN', value: row.pincode ?? '—' },
                  { label: 'Address', value: row.address ?? '—' },
                  { label: 'Monthly income', value: formatReviewInr(row.netMonthlyIncome) },
                  { label: 'Email', value: row.email ?? '—' },
                  { label: 'CIBIL', value: formatCibilScoreLabel(row.cibilScore) },
                ]}
              />
            </SectionCard>

            <SectionCard eyebrow="Application" title="Loan offer">
              <DetailGrid
                rows={[
                  ...(samePublicId(row.leadNumber, row.applicationNumber)
                    ? []
                    : [{ label: 'Application', value: row.applicationNumber ?? '—' }]),
                  { label: 'Purpose of loan', value: row.purposeOfLoan ?? '—' },
                  { label: 'Loan offer amount', value: formatReviewInr(row.loanOfferAmount) },
                  { label: 'Loan selected amount', value: formatReviewInr(row.loanSelectedAmount) },
                  { label: 'Tenure', value: formatTenure(row.expectedRepaymentDays) },
                  { label: 'Interest rate', value: formatPercent(row.interestRate) },
                  { label: 'Processing fee', value: formatPercent(row.processingFeePercent) },
                  { label: 'Processing fee amount', value: formatReviewInr(row.processingFeeAmount) },
                  { label: 'GST', value: formatPercent(row.gstPercent) },
                  { label: 'GST amount', value: formatReviewInr(row.gstAmount) },
                  { label: 'Expected repay date', value: formatReviewDateOnly(row.expectedRepaymentDate) },
                  { label: 'Repayment amount', value: formatReviewInr(row.repaymentAmount) },
                  { label: 'Application status', value: <StatusBadge code={row.applicationStatusCode} label={row.applicationStatusLabel} /> },
                ]}
              />
            </SectionCard>

            <SectionCard eyebrow="Loan" title="Disbursement & repayment">
              <DetailGrid
                rows={[
                  ...(samePublicId(row.leadNumber, row.loanNumber)
                    ? []
                    : [{ label: 'Loan', value: row.loanNumber ?? '—' }]),
                  { label: 'Loan status', value: <StatusBadge code={row.loanStatusCode} label={row.loanStatusLabel} /> },
                  { label: 'Principal', value: formatReviewInr(row.principalAmount) },
                  { label: 'Net disbursed', value: formatReviewInr(row.netDisbursedAmount) },
                  { label: 'Interest amount', value: formatReviewInr(row.interestAmount) },
                  { label: 'Total repayment', value: formatReviewInr(row.totalRepaymentAmount) },
                  { label: 'Disbursed', value: formatReviewDateTime(row.disbursedAt) },
                  { label: 'Due date', value: formatReviewDateOnly(row.loanMaturityDate) },
                  { label: 'Repayment status', value: <StatusBadge code={row.repaymentStatusCode} label={row.repaymentStatusLabel} /> },
                  { label: 'Latest repayment', value: formatReviewInr(row.latestRepaymentAmount) },
                  { label: 'Repaid on', value: formatReviewDateTime(row.latestRepaymentAt) },
                ]}
              />
            </SectionCard>

            <SectionCard eyebrow="Pipeline" title="Statuses">
              <DetailGrid
                rows={[
                  { label: 'Lead ID', value: row.leadNumber },
                  { label: 'Lead status', value: <StatusBadge code={row.leadStatusCode} label={row.leadStatusLabel} /> },
                  { label: 'Application status', value: <StatusBadge code={row.applicationStatusCode} label={row.applicationStatusLabel} /> },
                  { label: 'Loan status', value: <StatusBadge code={row.loanStatusCode} label={row.loanStatusLabel} /> },
                  { label: 'Repayment status', value: <StatusBadge code={row.repaymentStatusCode} label={row.repaymentStatusLabel} /> },
                  { label: 'Created', value: formatReviewDateTime(row.createdAt) },
                  { label: 'Updated', value: formatReviewDateTime(row.updatedAt) },
                ]}
              />
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}
