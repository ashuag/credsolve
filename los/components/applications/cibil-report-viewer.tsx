'use client';

import type {
  CibilAssessmentInsights,
  CibilCreditAssessment,
  CibilReportAccountRow,
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

function formatInsightCount(value: number | null | undefined): string {
  if (value == null) return '—';
  return String(value);
}

function InsightMetricGrid({
  rows,
}: {
  rows: Array<{ label: string; hint?: string; value: string; tone?: 'ok' | 'warn' | 'bad' }>;
}) {
  return (
    <dl className="m-0 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-[10px] border border-[rgba(15,39,72,0.08)] bg-[rgba(255,255,255,0.78)] px-3 py-2.5"
        >
          <dt className="text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted leading-tight">
            {row.label}
          </dt>
          <dd
            className={cx(
              'm-0 mt-1 text-[0.92rem] font-extrabold leading-snug',
              row.tone === 'bad'
                ? 'text-[#b91c1c]'
                : row.tone === 'warn'
                  ? 'text-[#b45309]'
                  : 'text-brand-navy',
            )}
          >
            {row.value}
          </dd>
          {row.hint ? <p className="m-0 mt-0.5 text-[0.68rem] text-brand-muted">{row.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function InsightFlagList({ items, emptyLabel = 'None' }: { items: string[]; emptyLabel?: string }) {
  if (items.length === 0) {
    return <span className="text-[0.82rem] font-semibold text-brand-muted">{emptyLabel}</span>;
  }
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {items.map((item, idx) => (
        <li
          key={`${item}-${idx}`}
          className="inline-flex rounded-full border border-[rgba(180,83,9,0.22)] bg-[rgba(245,158,11,0.1)] px-2.5 py-0.5 text-[0.72rem] font-bold text-[#b45309]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function CibilInsightsSection({ insights }: { insights: CibilAssessmentInsights }) {
  const score = insights.riskScore;
  const scoreLabel =
    score == null
      ? '—'
      : score === -1 || score === 0 || score === 1
        ? `NTC (${score})`
        : String(score);

  const flagRows: Array<{ label: string; hint: string; items: string[] }> = [
    { label: 'Default loans', hint: 'Wilful default / suit filed', items: insights.defaultLoans },
    { label: 'Write-off amounts', hint: 'Write-off per tradeline (INR)', items: insights.writeoffLoan },
    { label: 'Settled amounts', hint: 'Settlement amounts per tradeline', items: insights.settledLoan },
    { label: 'SMA tradelines', hint: 'Special Mention Account flags', items: insights.loanContainStatusSma },
    { label: 'Substandard', hint: 'SUB asset classification', items: insights.loanContainStatusSub },
    { label: 'Doubtful', hint: 'DBT asset classification', items: insights.loanContainStatusDbt },
    { label: 'Loss', hint: 'LSS asset classification', items: insights.loanContainStatusLss },
    { label: 'DPD 30+ (3 months)', hint: 'Tradelines with 30+ DPD in last 3 months', items: insights.dpd30Last3Months },
    { label: 'DPD 60+ (9 months)', hint: 'Tradelines with 60+ DPD in last 9 months', items: insights.dpd60Last9Months },
    { label: 'DPD 90+ (12 months)', hint: 'Tradelines with 90+ DPD in last 12 months', items: insights.dpd90Last12Months },
    { label: 'Open DPD (6 months)', hint: 'Open tradelines with DPD in last 6 months', items: insights.openLoanDpdLast6Months },
    { label: 'Defaults (18 months)', hint: 'Wilful default / suit / settled events', items: insights.defaultsInLast18Months },
    { label: 'Doubtful (18 months)', hint: 'SUB / DBT / LSS in last 18 months', items: insights.doubtfulInLast18Months },
    { label: 'Restructured loans', hint: 'Renegotiated / restructured facilities', items: insights.restructuredLoans },
    { label: 'PWOS tradelines', hint: 'Post write-off settled', items: insights.pwosTradelines },
    { label: 'Missed payments (6 months)', hint: 'Missed EMI months in last 6 months', items: insights.missedPaymentsIn6m },
  ];

  return (
    <ReportSection
      id="cibil-insights"
      title="CIBIL insights"
      description="Assessment features derived from bureau tradelines — the same columns used by the CIBIL credit engine."
      defaultOpen
    >
      <p className="mb-2 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
        Portfolio snapshot
      </p>
      <InsightMetricGrid
        rows={[
          {
            label: 'CIBIL risk score',
            hint: '300–900; 0 / −1 / 1 = no usable score (NTC)',
            value: scoreLabel,
            tone: score != null && (score < 1 || score === 1) ? 'warn' : undefined,
          },
          { label: 'Total tradelines', hint: 'Active + closed loan accounts', value: formatInsightCount(insights.noOfLoans) },
          { label: 'Credit cards', hint: 'Credit card tradeline count', value: formatInsightCount(insights.noOfCreditcards) },
          { label: 'Unsecured loans', hint: 'Personal, consumer, cards, etc.', value: formatInsightCount(insights.noOfUnsecuredLoans) },
          { label: 'Secured loans', hint: 'Home, auto, gold, etc.', value: formatInsightCount(insights.noOfSecuredLoans) },
          { label: 'Gold loans', hint: 'Gold loan tradeline count', value: formatInsightCount(insights.noOfGoldLoans) },
          { label: 'Enquiries (6 months)', hint: 'Bureau enquiries in last 6 months', value: formatInsightCount(insights.sixMEnq) },
          { label: 'Total enquiries', hint: 'All-time enquiry count', value: formatInsightCount(insights.totalEnq) },
          { label: 'Settled loan count', hint: 'Number of settled accounts', value: formatInsightCount(insights.settledLoansCounts) },
          {
            label: 'Total overdue',
            hint: 'Sum of outstanding overdue (INR)',
            value: formatInr(insights.totalOverdueAmounts),
            tone: insights.totalOverdueAmounts > 0 ? 'bad' : 'ok',
          },
          { label: 'Category', hint: 'Original model category (A–H); blank for new data', value: insights.category?.trim() || '—' },
        ]}
      />

      <p className="mb-2 mt-5 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
        Adverse flags
      </p>
      <dl className="m-0 divide-y divide-[rgba(15,39,72,0.08)]">
        {flagRows.map((row) => (
          <div key={row.label} className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(160px,220px)_1fr] sm:items-start sm:gap-3">
            <dt>
              <span className="text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">{row.label}</span>
              <span className="mt-0.5 block text-[0.68rem] font-medium normal-case tracking-normal text-brand-muted">
                {row.hint}
              </span>
            </dt>
            <dd className="m-0 min-w-0">
              <InsightFlagList items={row.items} />
            </dd>
          </div>
        ))}
      </dl>
    </ReportSection>
  );
}

const CREDIT_ASSESSMENT_CATEGORY_TONE: Record<CibilCreditAssessment['category'], 'ok' | 'warn' | 'bad'> = {
  A: 'ok',
  B: 'ok',
  C: 'ok',
  D: 'warn',
  E: 'warn',
  F: 'warn',
  G: 'bad',
  H: 'bad',
};

function StatusPill({ status }: { status: 'Approved' | 'Rejected' }) {
  return (
    <span
      className={cx(
        'inline-flex rounded-full px-3 py-1 text-[0.78rem] font-extrabold',
        status === 'Approved' ? 'bg-[rgba(34,197,94,0.14)] text-[#166534]' : 'bg-[rgba(220,38,38,0.12)] text-[#b91c1c]',
      )}
    >
      {status}
    </span>
  );
}

function CibilCreditAssessmentSection({ assessment }: { assessment: CibilCreditAssessment | null }) {
  if (!assessment) {
    return (
      <ReportSection
        id="cibil-credit-assessment"
        title="Credit Assessment"
        description="Rule-based category, credit decision and payment probability computed from the bureau pull."
      >
        <p className="m-0 text-[0.82rem] text-brand-muted">
          No credit assessment has been computed for this bureau report yet.
        </p>
      </ReportSection>
    );
  }

  const rejectionReasons = assessment.rejectionReasons ? assessment.rejectionReasons.split('|').filter(Boolean) : [];
  const recommendationRejectionReasons = assessment.recommendationRejectionReason
    ? assessment.recommendationRejectionReason.split('|').filter(Boolean)
    : [];
  const tone = CREDIT_ASSESSMENT_CATEGORY_TONE[assessment.category];

  return (
    <ReportSection
      id="cibil-credit-assessment"
      title="Credit Assessment"
      description="Rule-based category, credit decision and payment probability computed from the bureau pull."
      defaultOpen
      badge={
        <span
          className={cx(
            'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[0.8rem] font-extrabold',
            tone === 'ok'
              ? 'bg-[rgba(34,197,94,0.14)] text-[#166534]'
              : tone === 'warn'
                ? 'bg-[rgba(245,158,11,0.16)] text-[#b45309]'
                : 'bg-[rgba(220,38,38,0.12)] text-[#b91c1c]',
          )}
        >
          {assessment.category}
        </span>
      }
    >
      <InsightMetricGrid
        rows={[
          { label: 'Category', value: assessment.category, hint: assessment.categoryDescription },
          { label: 'Payment probability', value: `${assessment.paymentProbabilityPct.toFixed(2)}%` },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-[rgba(15,39,72,0.08)] bg-[rgba(255,255,255,0.78)] px-3 py-2.5">
          <dt className="text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted leading-tight">
            Credit status
          </dt>
          <dd className="m-0 mt-1.5 flex flex-wrap items-center gap-2">
            <StatusPill status={assessment.creditStatus} />
          </dd>
          {rejectionReasons.length > 0 ? (
            <div className="mt-2">
              <InsightFlagList items={rejectionReasons} />
            </div>
          ) : null}
        </div>
        <div className="rounded-[10px] border border-[rgba(15,39,72,0.08)] bg-[rgba(255,255,255,0.78)] px-3 py-2.5">
          <dt className="text-[0.62rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted leading-tight">
            Credit recommendation
          </dt>
          <dd className="m-0 mt-1.5 flex flex-wrap items-center gap-2">
            <StatusPill status={assessment.creditRecommendation} />
          </dd>
          {recommendationRejectionReasons.length > 0 ? (
            <div className="mt-2">
              <InsightFlagList items={recommendationRejectionReasons} />
            </div>
          ) : null}
        </div>
      </div>

      <p className="mb-2 mt-5 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
        Underlying signals
      </p>
      <InsightMetricGrid
        rows={[
          { label: 'Total tradelines', value: formatInsightCount(assessment.signals.noOfLoans) },
          { label: 'Credit cards', value: formatInsightCount(assessment.signals.noOfCreditCards) },
          { label: 'Unsecured loans', value: formatInsightCount(assessment.signals.noOfUnsecuredLoans) },
          {
            label: 'Active unsecured loans',
            hint: 'Open unsecured tradelines only',
            value: formatInsightCount(assessment.signals.noOfActiveUnsecuredLoans),
          },
          { label: 'Secured loans', value: formatInsightCount(assessment.signals.noOfSecuredLoans) },
          { label: 'Gold loans', value: formatInsightCount(assessment.signals.noOfGoldLoans) },
          { label: 'Enquiries (6 months)', value: formatInsightCount(assessment.signals.sixMonthEnquiries) },
          { label: 'Total enquiries', value: formatInsightCount(assessment.signals.totalEnquiries) },
          { label: 'Settled loans', value: formatInsightCount(assessment.signals.settledLoansCount) },
          {
            label: 'Total overdue',
            value: formatInr(assessment.signals.totalOverdueAmountInr),
            tone: assessment.signals.totalOverdueAmountInr > 0 ? 'bad' : 'ok',
          },
          {
            label: 'Wilful default',
            value: assessment.signals.hasWilfulDefault ? 'Yes' : 'No',
            tone: assessment.signals.hasWilfulDefault ? 'bad' : undefined,
          },
          {
            label: 'Restructured loans',
            value: formatInsightCount(assessment.signals.restructuredLoansCount),
            tone: assessment.signals.restructuredLoansCount > 0 ? 'warn' : undefined,
          },
          {
            label: 'DPD 90+ (12 months)',
            value: formatInsightCount(assessment.signals.dpd90InLast12MonthsCount),
            tone: assessment.signals.dpd90InLast12MonthsCount > 0 ? 'bad' : undefined,
          },
        ]}
      />
    </ReportSection>
  );
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
    <dl className="m-0 divide-y divide-[rgba(15,39,72,0.08)]">
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
        className="flex w-full items-start justify-between gap-3 border-0 bg-[rgba(34,197,94,0.04)] px-5 py-4 text-left md:px-6"
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
              'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(15,39,72,0.12)] bg-white text-brand-navy transition-transform',
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
      {open ? <div className="border-t border-[rgba(15,39,72,0.08)] px-5 py-4 md:px-6 md:py-5">{children}</div> : null}
    </section>
  );
}

type PayStatusStyle = { bg: string; fg: string };

function parsePayStatusToDpdDays(raw: string): number | null {
  if (!raw) return null;
  if (raw === '0' || raw === '00' || raw === '000') return 0;
  if (/^\d+$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function resolvePaymentStatusStyle(raw: string): PayStatusStyle {
  const s = raw.trim().toUpperCase();
  if (!s) return { bg: 'transparent', fg: '#8c9199' };
  if (s === 'XXX') return { bg: 'transparent', fg: '#8c9199' };
  if (s === 'STD' || s === '0' || s === '00' || s === '000') return { bg: '#e6f5e6', fg: '#197a38' };
  if (s === 'SMA' || s.startsWith('SMA')) return { bg: '#ffeda6', fg: '#8c5905' };
  if (s === 'PWOS') return { bg: '#f2bf8c', fg: '#732e0d' };
  if (s === 'SUB') return { bg: '#fad1b8', fg: '#b2381f' };
  if (s === 'DBT') return { bg: '#eb7261', fg: '#fff' };
  if (s === 'LSS' || s === 'LOSS') return { bg: '#b81f24', fg: '#fff' };
  if (s === 'SET' || s === 'SETTLED') return { bg: '#8c479e', fg: '#fff' };
  if (s === 'WOF' || s === 'WOFF' || s === 'WO' || s.includes('WRITTEN')) return { bg: '#731f1f', fg: '#fff' };

  const dpd = parsePayStatusToDpdDays(s);
  if (dpd != null) {
    if (dpd === 0) return { bg: '#e6f5e6', fg: '#197a38' };
    if (dpd >= 90) return { bg: '#b81f24', fg: '#fff' };
    if (dpd >= 60) return { bg: '#fab8ad', fg: '#9e1a1a' };
    if (dpd >= 30) return { bg: '#ffd18c', fg: '#9e4705' };
    return { bg: '#fff2b8', fg: '#856105' };
  }

  return { bg: '#f0f0f0', fg: '#1f2429' };
}

const MONTHS_DESC = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function PaymentHistoryGrid({ history }: { history: CibilReportPaymentMonth[] }) {
  if (!history.length) {
    return <p className="m-0 text-[0.82rem] text-brand-muted">No payment history in bureau payload.</p>;
  }

  const byYearMonth = new Map<string, string>();
  for (const cell of history) {
    byYearMonth.set(`${cell.year}-${cell.month}`, cell.status);
  }

  const years = [...new Set(history.map((c) => c.year))].sort((a, b) => b - a);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-16 pr-4 text-right text-xs font-extrabold uppercase tracking-wide text-brand-muted">Year</th>
            {MONTHS_DESC.map((m) => (
              <th key={m} className="w-16 px-1 pb-2 text-center text-xs font-extrabold uppercase tracking-wide text-brand-muted">
                {MONTH_LABELS[m - 1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="pr-4 text-right text-sm font-extrabold text-brand-navy">{year}</td>
              {MONTHS_DESC.map((m) => {
                const status = byYearMonth.get(`${year}-${m}`);
                const { bg, fg } = resolvePaymentStatusStyle(status ?? '');
                return (
                  <td
                    key={m}
                    className="px-1 py-1"
                    title={status ? `${MONTH_LABELS[m - 1]} ${year}: ${status}` : undefined}
                  >
                    {status != null ? (
                      <span
                        className="flex h-10 w-full items-center justify-center rounded font-mono text-sm font-extrabold"
                        style={{ backgroundColor: bg, color: fg }}
                      >
                        {status || '—'}
                      </span>
                    ) : (
                      <span className="flex h-10 w-full items-center justify-center rounded bg-[rgba(15,39,72,0.03)] text-sm text-[rgba(15,39,72,0.2)]">
                        –
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountCard({ account, index }: { account: CibilReportAccountRow; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <article className="rounded-[12px] border border-[rgba(15,39,72,0.1)] bg-white">
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
        <div className="border-t border-[rgba(15,39,72,0.08)] px-4 py-3">
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
                  ? 'bg-[rgba(34,197,94,0.12)] text-brand-blue'
                  : 'text-brand-navy hover:bg-[rgba(15,39,72,0.05)]',
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

export function CibilReportViewer({
  payload,
  pdfDownloadUrl,
}: {
  payload: LosApplicationCibilReportPayload;
  pdfDownloadUrl?: string | null;
}) {
  const report = payload.report;

  const sections = useMemo(
    () => [
      { id: 'cibil-insights', label: 'CIBIL insights' },
      { id: 'cibil-credit-assessment', label: 'Credit Assessment' },
      { id: 'cibil-score', label: 'Score & insights' },
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
      <span className="inline-flex rounded-full bg-[rgba(34,197,94,0.12)] px-2.5 py-0.5 text-[0.72rem] font-extrabold text-brand-blue">
        {report.cibilScore === -1 || report.cibilScore === 0 || report.cibilScore === 1 ? 'NTC' : report.cibilScore}
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
                {payload.vendorName ? (
                  <>
                    {' '}
                    · via <span className="font-semibold text-brand-navy">{payload.vendorName}</span>
                  </>
                ) : null}
                {report.controlNumber ? (
                  <>
                    {' '}
                    · Control # <span className="font-mono font-semibold text-brand-navy">{report.controlNumber}</span>
                  </>
                ) : null}
              </p>
            </div>
            {report.cibilScore != null ? (
              <div className="rounded-[14px] border border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.06)] px-5 py-3 text-center">
                <p className="m-0 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                  CIBIL score
                </p>
                <p className="m-0 text-[2rem] font-extrabold leading-none text-brand-navy">
                  {report.cibilScore === -1 || report.cibilScore === 0 || report.cibilScore === 1
                    ? 'NTC'
                    : report.cibilScore}
                </p>
                {report.scoreRatingLabel ? (
                  <p className="m-0 mt-1 text-[0.72rem] font-bold text-brand-blue">{report.scoreRatingLabel}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {pdfDownloadUrl ? (
              <a
                href={pdfDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center rounded-full border border-[rgba(15,39,72,0.12)] bg-white px-4 text-[0.8rem] font-bold text-brand-blue no-underline hover:border-[rgba(34,197,94,0.35)]"
              >
                Download CIBIL report
              </a>
            ) : null}
            {report.vendorHtmlUrl ? (
              <a
                href={report.vendorHtmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center rounded-full border border-[rgba(15,39,72,0.12)] bg-white px-4 text-[0.8rem] font-bold text-brand-navy no-underline hover:border-[rgba(34,197,94,0.35)]"
              >
                Official bureau portal
              </a>
            ) : null}
          </div>
        </header>

        {report.assessmentInsights ? <CibilInsightsSection insights={report.assessmentInsights} /> : null}

        <CibilCreditAssessmentSection assessment={payload.creditAssessment} />

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
                  className="rounded-[10px] border border-[rgba(15,39,72,0.08)] bg-[rgba(248,250,255,0.85)] px-3 py-2.5"
                >
                  <span className="font-mono text-[0.68rem] font-bold text-brand-muted">{factor.code}</span>
                  <p className="m-0 mt-1 text-[0.84rem] leading-relaxed text-brand-text">{factor.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <DetailGrid
            rows={[
              { label: 'Population rank', value: report.populationRank ?? '—' },
              { label: 'On-time payments', value: report.creditSummary.onTimePaymentHistory ?? '—' },
              { label: 'Card utilization', value: report.creditSummary.creditCardUtilization ?? '—' },
              { label: 'Recent enquiries', value: report.creditSummary.recentEnquiries ?? '—' },
              { label: 'Credit mix', value: report.creditSummary.creditMix ?? '—' },
              { label: 'Oldest account (months)', value: report.creditSummary.oldestCreditAccountMonths ?? '—' },
            ]}
          />
        </ReportSection>


        <ReportSection
          id="cibil-accounts-summary"
          title="Accounts overview"
          description="Open/closed status and exposure used for underwriting."
        >
          {report.accountOverview.length === 0 ? (
            <p className="m-0 text-[0.86rem] text-brand-muted">No tradelines in bureau payload.</p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[rgba(15,39,72,0.1)]">
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
                    <tr key={`${row.creditor}-${idx}`} className="border-t border-[rgba(15,39,72,0.06)]">
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
                    className="rounded-[10px] border border-[rgba(15,39,72,0.08)] bg-[rgba(248,250,255,0.85)] px-3 py-2.5 text-[0.84rem]"
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
            <span className="inline-flex rounded-full bg-[rgba(15,39,72,0.08)] px-2 py-0.5 text-[0.68rem] font-extrabold text-brand-navy">
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
            <span className="inline-flex rounded-full bg-[rgba(15,39,72,0.08)] px-2 py-0.5 text-[0.68rem] font-extrabold text-brand-navy">
              {report.inquiries.length}
            </span>
          }
        >
          {report.inquiries.length === 0 ? (
            <p className="m-0 text-[0.86rem] text-brand-muted">No enquiries listed.</p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[rgba(15,39,72,0.1)]">
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
                    <tr key={idx} className="border-t border-[rgba(15,39,72,0.06)]">
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
