'use client';

import type {
  CibilReportAccountRow,
  CibilReportData,
  CibilReportPaymentMonth,
  LosApplicationCibilReportPayload,
} from '@/lib/api';
import { cx } from '@/components/eligibility/eligibility-ui';
import { type ReactNode, useMemo, useState } from 'react';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatInr(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
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

function DetailGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="m-0 divide-y divide-[rgba(23,44,113,0.08)]">
      {rows.map((row, idx) => (
        <div
          key={`${row.label}-${idx}`}
          className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(120px,180px)_1fr] sm:items-start sm:gap-3"
        >
          <dt className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">{row.label}</dt>
          <dd className="m-0 min-w-0 text-[0.86rem] font-semibold text-brand-text">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReportSection({
  id,
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="los-card overflow-hidden scroll-mt-24">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 border-0 bg-[rgba(20,150,243,0.04)] px-5 py-4 text-left md:px-6"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[0.98rem] font-extrabold tracking-[-0.02em] text-brand-navy">{title}</h3>
          {description ? (
            <p className="m-0 mt-1 max-w-[58ch] text-[0.8rem] leading-relaxed text-brand-muted">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {badge}
          <span
            className={cx(
              'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(23,44,113,0.12)] bg-white text-brand-navy transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>
      </button>
      {open ? <div className="border-t border-[rgba(23,44,113,0.08)] px-5 py-4 md:px-6 md:py-5">{children}</div> : null}
    </section>
  );
}

function paymentStatusClass(status: string): string {
  const s = status.trim().toUpperCase();
  if (s === '000' || s === 'STD' || s === 'XXX') {
    return 'bg-[rgba(34,197,94,0.14)] text-[#166534]';
  }
  if (s === 'SUB' || s === 'DBT' || s === 'LSS' || s === 'SMA' || s === 'DEL' || /^\d{3}$/.test(s) && Number(s) > 0) {
    return 'bg-[rgba(239,68,68,0.12)] text-[#991b1b]';
  }
  return 'bg-[rgba(148,163,184,0.18)] text-brand-muted';
}

function PaymentHistoryGrid({ history }: { history: CibilReportPaymentMonth[] }) {
  if (!history.length) {
    return <p className="m-0 text-[0.82rem] text-brand-muted">No payment history in bureau payload.</p>;
  }

  const sorted = [...history].sort((a, b) => a.year - b.year || a.month - b.month);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1.5">
        {sorted.map((cell) => (
          <div
            key={`${cell.year}-${cell.month}`}
            className="flex w-[52px] flex-col items-center gap-1 rounded-[8px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.9)] p-1.5"
            title={`${MONTH_LABELS[cell.month - 1] ?? cell.month} ${cell.year}: ${cell.status}`}
          >
            <span className="text-[0.6rem] font-extrabold uppercase tracking-wide text-brand-muted">
              {MONTH_LABELS[cell.month - 1] ?? cell.month}
            </span>
            <span className="text-[0.58rem] font-bold text-brand-muted">{String(cell.year).slice(-2)}</span>
            <span
              className={cx(
                'w-full rounded-[4px] px-0.5 py-0.5 text-center font-mono text-[0.62rem] font-extrabold',
                paymentStatusClass(cell.status),
              )}
            >
              {cell.status || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountCard({ account, index }: { account: CibilReportAccountRow; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <article className="rounded-[12px] border border-[rgba(23,44,113,0.1)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="m-0 text-[0.88rem] font-extrabold text-brand-navy">{account.creditor || 'Unknown lender'}</p>
          <p className="m-0 mt-0.5 text-[0.75rem] text-brand-muted">
            {account.accountType}
            {account.accountNumber ? ` · ${account.accountNumber}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cx(
              'inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold',
              account.status.toLowerCase().includes('closed')
                ? 'bg-[rgba(148,163,184,0.2)] text-brand-muted'
                : 'bg-[rgba(34,197,94,0.12)] text-[#166534]',
            )}
          >
            {account.status || '—'}
          </span>
          <span className="text-[0.72rem] font-bold text-brand-text">Bal: {account.currentBalance || '—'}</span>
        </div>
      </button>
      {open ? (
        <div className="border-t border-[rgba(23,44,113,0.08)] px-4 py-3">
          <DetailGrid
            rows={[
              { label: 'Ownership', value: account.ownership || '—' },
              { label: 'Opened', value: account.dateOpened ?? '—' },
              { label: 'Reported', value: account.dateReported ?? '—' },
              { label: 'Closed', value: account.dateClosed ?? '—' },
              { label: 'Last payment', value: account.dateLastPayment ?? '—' },
              { label: 'Sanctioned', value: account.sanctionedAmount || '—' },
              { label: 'EMI', value: account.emiAmount || '—' },
              { label: 'Overdue', value: account.overdueAmount || '—' },
              { label: 'Written off', value: account.writtenOffTotal || '—' },
            ]}
          />
          <p className="mb-2 mt-4 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            Payment status (monthly)
          </p>
          <PaymentHistoryGrid history={account.paymentHistory} />
        </div>
      ) : null}
    </article>
  );
}

function SectionNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: Array<{ id: string; label: string }>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="los-card sticky top-4 hidden h-fit p-3 lg:block" aria-label="CIBIL report sections">
      <p className="m-0 mb-2 px-2 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
        Jump to section
      </p>
      <ul className="m-0 list-none space-y-0.5 p-0">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => onSelect(section.id)}
              className={cx(
                'w-full rounded-[8px] px-2.5 py-2 text-left text-[0.78rem] font-bold transition-colors',
                activeId === section.id
                  ? 'bg-[rgba(20,150,243,0.12)] text-brand-blue'
                  : 'text-brand-navy hover:bg-[rgba(23,44,113,0.05)]',
              )}
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CibilReportViewer({ payload }: { payload: LosApplicationCibilReportPayload }) {
  const report = payload.report;

  const sections = useMemo(
    () => [
      { id: 'cibil-score', label: 'Score & insights' },
      { id: 'cibil-preapproved', label: 'Pre-approved offer' },
      { id: 'cibil-accounts-summary', label: 'Accounts summary' },
      { id: 'cibil-profile', label: 'Consumer profile' },
      { id: 'cibil-tradelines', label: 'Tradelines' },
      { id: 'cibil-enquiries', label: 'Enquiries' },
    ],
    [],
  );

  const [activeSection, setActiveSection] = useState<string | null>(null);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scoreBadge =
    report.cibilScore != null ? (
      <span className="inline-flex rounded-full bg-[rgba(20,150,243,0.12)] px-2.5 py-0.5 text-[0.72rem] font-extrabold text-brand-blue">
        {report.cibilScore}
      </span>
    ) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
      <SectionNav sections={sections} activeId={activeSection} onSelect={scrollToSection} />

      <div className="grid min-w-0 gap-4">
        <header className="los-card p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="los-chip mb-2">CIBIL / TrueLink</span>
              <h2 className="m-0 text-[1.2rem] font-extrabold tracking-[-0.03em] text-brand-navy">
                {report.consumerName || 'Consumer'}
              </h2>
              <p className="m-0 mt-1.5 text-[0.84rem] text-brand-muted">
                Bureau pulled {formatDateTime(payload.fetchedAt)}
                {report.controlNumber ? (
                  <>
                    {' '}
                    · Control # <span className="font-mono font-semibold text-brand-navy">{report.controlNumber}</span>
                  </>
                ) : null}
              </p>
            </div>
            {report.cibilScore != null ? (
              <div className="rounded-[14px] border border-[rgba(20,150,243,0.22)] bg-[rgba(20,150,243,0.06)] px-5 py-3 text-center">
                <p className="m-0 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                  CIBIL score
                </p>
                <p className="m-0 text-[2rem] font-extrabold leading-none text-brand-navy">{report.cibilScore}</p>
                {report.scoreRatingLabel ? (
                  <p className="m-0 mt-1 text-[0.72rem] font-bold text-brand-blue">{report.scoreRatingLabel}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {payload.reportPdfUrl ? (
              <a
                href={payload.reportPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center rounded-full border border-[rgba(23,44,113,0.12)] bg-white px-4 text-[0.8rem] font-bold text-brand-blue no-underline hover:border-[rgba(20,150,243,0.35)]"
              >
                Download summary PDF
              </a>
            ) : null}
            {(payload.htmlUrl ?? report.vendorHtmlUrl) ? (
              <a
                href={payload.htmlUrl ?? report.vendorHtmlUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center rounded-full border border-[rgba(23,44,113,0.12)] bg-white px-4 text-[0.8rem] font-bold text-brand-navy no-underline hover:border-[rgba(20,150,243,0.35)]"
              >
                Official bureau portal
              </a>
            ) : null}
          </div>
        </header>

        <ReportSection
          id="cibil-score"
          title="Score & credit insights"
          description="Score factors and bureau summary metrics from the TrueLink payload."
          defaultOpen
          badge={scoreBadge}
        >
          {report.scoreFactors.length > 0 ? (
            <ul className="m-0 mb-4 list-none space-y-2 p-0">
              {report.scoreFactors.map((factor) => (
                <li
                  key={factor.code}
                  className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.85)] px-3 py-2.5"
                >
                  <span className="font-mono text-[0.68rem] font-bold text-brand-muted">{factor.code}</span>
                  <p className="m-0 mt-1 text-[0.84rem] leading-relaxed text-brand-text">{factor.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <DetailGrid
            rows={[
              { label: 'Score name', value: report.scoreName ?? '—' },
              { label: 'Population rank', value: report.populationRank ?? '—' },
              { label: 'On-time payments', value: report.creditSummary.onTimePaymentHistory ?? '—' },
              { label: 'Card utilization', value: report.creditSummary.creditCardUtilization ?? '—' },
              { label: 'Recent enquiries', value: report.creditSummary.recentEnquiries ?? '—' },
              { label: 'Credit mix', value: report.creditSummary.creditMix ?? '—' },
              { label: 'Oldest account (months)', value: report.creditSummary.oldestCreditAccountMonths ?? '—' },
            ]}
          />
        </ReportSection>

        {report.preApprovedInsight ? (
          <ReportSection
            id="cibil-preapproved"
            title="Pre-approved offer (exposure tier)"
            description="Derived from max open unsecured exposure — same logic as production eligibility."
            defaultOpen
          >
            <DetailGrid
              rows={[
                {
                  label: 'Pre-approved amount',
                  value: formatInr(report.preApprovedInsight.preApprovedAmountInr),
                },
                { label: 'Tier band', value: report.preApprovedInsight.tierBandLabel ?? '—' },
                {
                  label: 'Max open unsecured exposure',
                  value: formatInr(report.exposureInsight.maxOpenUnsecuredExposureInr),
                },
                {
                  label: 'Driving tradeline',
                  value:
                    report.exposureInsight.drivingCreditor && report.exposureInsight.drivingAccountType
                      ? `${report.exposureInsight.drivingCreditor} (${report.exposureInsight.drivingAccountType})`
                      : '—',
                },
                { label: 'Detail', value: report.preApprovedInsight.detail },
              ]}
            />
          </ReportSection>
        ) : null}

        <ReportSection
          id="cibil-accounts-summary"
          title="Accounts overview"
          description="Open/closed status and exposure used for underwriting."
        >
          {report.accountOverview.length === 0 ? (
            <p className="m-0 text-[0.86rem] text-brand-muted">No tradelines in bureau payload.</p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[rgba(23,44,113,0.1)]">
              <table className="w-full min-w-[640px] border-collapse text-left text-[0.78rem]">
                <thead>
                  <tr className="bg-[rgba(248,250,255,0.95)] text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                    <th className="px-3 py-2.5">Creditor</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Exposure</th>
                    <th className="px-3 py-2.5">Unsecured</th>
                  </tr>
                </thead>
                <tbody>
                  {report.accountOverview.map((row, idx) => (
                    <tr key={`${row.creditor}-${idx}`} className="border-t border-[rgba(23,44,113,0.06)]">
                      <td className="px-3 py-2.5 font-semibold text-brand-navy">{row.creditor}</td>
                      <td className="px-3 py-2.5 text-brand-text">{row.accountType}</td>
                      <td className="px-3 py-2.5">{row.status}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-brand-navy">{row.exposureLabel}</td>
                      <td className="px-3 py-2.5">{row.isUnsecured ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>

        <ReportSection id="cibil-profile" title="Consumer profile" description="Identity, contact, and employment from bureau.">
          <DetailGrid
            rows={[
              { label: 'Name', value: report.consumerName },
              { label: 'Date of birth', value: report.dateOfBirthDisplay ?? report.dateOfBirth ?? '—' },
              { label: 'Gender', value: report.gender ?? '—' },
              { label: 'PAN', value: report.pan ?? '—' },
              { label: 'Mobile', value: report.primaryMobile ?? '—' },
              { label: 'Emails', value: report.emails.length ? report.emails.join(', ') : '—' },
              { label: 'Occupation (bureau)', value: report.employmentOccupation ?? '—' },
              { label: 'Employment type', value: report.employmentAccountType ?? '—' },
            ]}
          />
          {report.identifiers.length > 0 ? (
            <>
              <p className="mb-2 mt-5 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                Identifiers
              </p>
              <DetailGrid rows={report.identifiers.map((id) => ({ label: id.type, value: id.number }))} />
            </>
          ) : null}
          {report.addresses.length > 0 ? (
            <>
              <p className="mb-2 mt-5 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                Addresses
              </p>
              <ul className="m-0 list-none space-y-2 p-0">
                {report.addresses.map((addr, idx) => (
                  <li
                    key={idx}
                    className="rounded-[10px] border border-[rgba(23,44,113,0.08)] bg-[rgba(248,250,255,0.85)] px-3 py-2.5 text-[0.84rem]"
                  >
                    <span className="font-extrabold text-brand-navy">{addr.category}</span>
                    <p className="m-0 mt-1 text-brand-text">{addr.address}</p>
                    <p className="m-0 mt-0.5 text-[0.75rem] text-brand-muted">
                      PIN {addr.pincode}
                      {addr.dateReported ? ` · Reported ${addr.dateReported}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {report.phones.length > 0 ? (
            <>
              <p className="mb-2 mt-5 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                Phone numbers
              </p>
              <DetailGrid rows={report.phones.map((p) => ({ label: p.type, value: p.number }))} />
            </>
          ) : null}
        </ReportSection>

        <ReportSection
          id="cibil-tradelines"
          title="Tradelines"
          description="Expand each account for balances and monthly payment status."
          badge={
            <span className="inline-flex rounded-full bg-[rgba(23,44,113,0.08)] px-2 py-0.5 text-[0.68rem] font-extrabold text-brand-navy">
              {report.accounts.length}
            </span>
          }
        >
          {report.accounts.length === 0 ? (
            <p className="m-0 text-[0.86rem] text-brand-muted">No account tradelines.</p>
          ) : (
            <div className="grid gap-3">
              {report.accounts.map((account, index) => (
                <AccountCard key={`${account.creditor}-${account.accountNumber}-${index}`} account={account} index={index} />
              ))}
            </div>
          )}
        </ReportSection>

        <ReportSection
          id="cibil-enquiries"
          title="Credit enquiries"
          description="Hard/soft enquiry records in the bureau window."
          badge={
            <span className="inline-flex rounded-full bg-[rgba(23,44,113,0.08)] px-2 py-0.5 text-[0.68rem] font-extrabold text-brand-navy">
              {report.inquiries.length}
            </span>
          }
        >
          {report.inquiries.length === 0 ? (
            <p className="m-0 text-[0.86rem] text-brand-muted">No enquiries listed.</p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[rgba(23,44,113,0.1)]">
              <table className="w-full min-w-[560px] border-collapse text-left text-[0.78rem]">
                <thead>
                  <tr className="bg-[rgba(248,250,255,0.95)] text-[0.65rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Member</th>
                    <th className="px-3 py-2.5">Purpose</th>
                    <th className="px-3 py-2.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.inquiries.map((row, idx) => (
                    <tr key={idx} className="border-t border-[rgba(23,44,113,0.06)]">
                      <td className="px-3 py-2.5 font-semibold text-brand-navy">{row.date}</td>
                      <td className="px-3 py-2.5">{row.member}</td>
                      <td className="px-3 py-2.5">{row.purpose}</td>
                      <td className="px-3 py-2.5 font-mono">{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>

        <p className="m-0 px-1 text-[0.72rem] leading-relaxed text-brand-muted">
          Internal view from stored bureau JSON. For the authoritative report, use the official bureau portal link above.
        </p>
      </div>
    </div>
  );
}
