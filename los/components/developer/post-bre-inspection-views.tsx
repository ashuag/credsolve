'use client';

import type {
  PostBreCriteriaConfigRow,
  PostBreDryRunResult,
  PostBreEnquiryInspectionRow,
  PostBreTradelineInspectionRow,
} from '@/lib/api';
import { cx } from '@/components/eligibility/eligibility-ui';

function RuleBadges({ rules = [] }: { rules?: string[] }) {
  if (!rules.length) {
    return <span className="text-[0.72rem] text-brand-muted">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {rules.map((id) => (
        <span
          key={id}
          className="inline-flex rounded-[6px] bg-[rgba(34,197,94,0.1)] px-1.5 py-0.5 font-mono text-[0.65rem] font-bold text-brand-blue"
        >
          {id}
        </span>
      ))}
    </div>
  );
}

function SignalPill({ active, label }: { active: boolean; label: string }) {
  if (!active) return null;
  return (
    <span className="inline-flex rounded-[6px] bg-[rgba(239,68,68,0.1)] px-1.5 py-0.5 text-[0.65rem] font-extrabold text-[#991b1b]">
      {label}
    </span>
  );
}

export function PostBreCriteriaTable({ rows }: { rows: PostBreCriteriaConfigRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-[rgba(15,39,72,0.1)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-[0.78rem]">
        <thead>
          <tr className="bg-[rgba(248,250,255,0.95)] text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            <th className="px-3 py-2.5">Key</th>
            <th className="px-3 py-2.5">Label</th>
            <th className="px-3 py-2.5">Value used</th>
            <th className="px-3 py-2.5">Active</th>
            <th className="px-3 py-2.5">Rules</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-[rgba(15,39,72,0.06)]">
              <td className="px-3 py-2.5 font-mono font-semibold text-brand-navy">{row.key}</td>
              <td className="px-3 py-2.5 text-brand-text">
                <p className="m-0 font-semibold text-brand-navy">{row.label}</p>
                {row.description ? (
                  <p className="m-0 mt-0.5 text-[0.72rem] leading-[1.4] text-brand-muted">{row.description}</p>
                ) : null}
              </td>
              <td className="px-3 py-2.5 font-mono font-bold text-brand-navy">{row.value}</td>
              <td className="px-3 py-2.5">
                <span
                  className={cx(
                    'inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold',
                    row.ruleEnabled
                      ? 'bg-[rgba(34,197,94,0.12)] text-[#166534]'
                      : 'bg-[rgba(148,163,184,0.2)] text-brand-muted',
                  )}
                >
                  {row.ruleEnabled ? 'Yes' : 'Off'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <RuleBadges rules={row.appliesToCheckIds} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PostBreBureauSummaryCards({ result }: { result: PostBreDryRunResult }) {
  const { bureau } = result.inspection;
  const cards = [
    { label: 'Vendor request', value: bureau.vendorRequestId ?? '—' },
    { label: 'Response status', value: bureau.responseStatus ?? '—' },
    { label: 'Bureau inquiry date', value: bureau.bureauInquiryDate ?? '—' },
    { label: 'Tradelines', value: `${bureau.tradelineCount} (${bureau.openTradelineCount} open)` },
    {
      label: `Loan enquiries (${bureau.enquiryWindowDays}d)`,
      value:
        result.thresholds.maxEnquiries30Days == null
          ? `${bureau.loanEnquiryCountInWindow} (limit off)`
          : `${bureau.loanEnquiryCountInWindow} / max ${result.thresholds.maxEnquiries30Days}`,
    },
    { label: 'Total enquiries', value: String(bureau.totalEnquiryCount) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[12px] border border-[rgba(15,39,72,0.08)] bg-[rgba(248,250,255,0.85)] px-3 py-2.5"
        >
          <p className="m-0 text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            {card.label}
          </p>
          <p className="m-0 mt-1 break-words text-[0.88rem] font-bold text-brand-navy">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export function PostBreTradelinesTable({ rows }: { rows: PostBreTradelineInspectionRow[] }) {
  if (!rows.length) {
    return (
      <p className="m-0 text-[0.84rem] text-brand-muted">No tradelines found in bureau payload.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-[rgba(15,39,72,0.1)]">
      <table className="w-full min-w-[960px] border-collapse text-left text-[0.76rem]">
        <thead>
          <tr className="bg-[rgba(248,250,255,0.95)] text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            <th className="px-2.5 py-2">#</th>
            <th className="px-2.5 py-2">Lender</th>
            <th className="px-2.5 py-2">Account</th>
            <th className="px-2.5 py-2">Type</th>
            <th className="px-2.5 py-2">Status</th>
            <th className="px-2.5 py-2">Signals</th>
            <th className="px-2.5 py-2">Evaluated by rules</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.rowIndex}-${row.creditorName}-${row.accountNumber ?? ''}`}
              className={cx(
                'border-t border-[rgba(15,39,72,0.06)]',
                (row.restructureSignal || row.smaPwosSignal) && 'bg-[rgba(239,68,68,0.03)]',
              )}
            >
              <td className="px-2.5 py-2 text-brand-muted">{row.rowIndex}</td>
              <td className="px-2.5 py-2 font-semibold text-brand-navy">{row.creditorName}</td>
              <td className="px-2.5 py-2 font-mono text-[0.72rem] text-brand-text">
                {row.accountNumber ?? '—'}
              </td>
              <td className="px-2.5 py-2 text-brand-text">
                <span className="font-semibold text-brand-navy">{row.accountTypeLabel}</span>
                {row.accountTypeSymbol ? (
                  <span className="ml-1 font-mono text-[0.68rem] text-brand-muted">({row.accountTypeSymbol})</span>
                ) : null}
              </td>
              <td className="px-2.5 py-2">
                <span
                  className={cx(
                    'inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold',
                    row.isOpen
                      ? 'bg-[rgba(34,197,94,0.1)] text-brand-blue'
                      : 'bg-[rgba(148,163,184,0.15)] text-brand-muted',
                  )}
                >
                  {row.accountStatus}
                </span>
                {row.isMfiAccount ? (
                  <span className="ml-1 text-[0.65rem] font-bold text-[#92400e]">MFI</span>
                ) : null}
              </td>
              <td className="px-2.5 py-2">
                <div className="flex flex-wrap gap-1">
                  <SignalPill active={row.restructureSignal} label="Restructure" />
                  <SignalPill active={row.smaPwosSignal} label="SMA/PWOS" />
                </div>
              </td>
              <td className="px-2.5 py-2">
                <RuleBadges rules={row.evaluatedByRules} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PostBreEnquiriesTable({ rows }: { rows: PostBreEnquiryInspectionRow[] }) {
  if (!rows.length) {
    return (
      <p className="m-0 text-[0.84rem] text-brand-muted">No enquiries found in bureau payload.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-[rgba(15,39,72,0.1)]">
      <table className="w-full min-w-[800px] border-collapse text-left text-[0.76rem]">
        <thead>
          <tr className="bg-[rgba(248,250,255,0.95)] text-[0.68rem] font-extrabold uppercase tracking-[0.1em] text-brand-muted">
            <th className="px-2.5 py-2">Date</th>
            <th className="px-2.5 py-2">Member</th>
            <th className="px-2.5 py-2">Purpose</th>
            <th className="px-2.5 py-2">Amount</th>
            <th className="px-2.5 py-2">Counts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.controlNumber ?? row.inquiryDate}-${index}`}
              className={cx(
                'border-t border-[rgba(15,39,72,0.06)]',
                row.countsTowardLoanEnquiryLimit && 'bg-[rgba(34,197,94,0.04)]',
              )}
            >
              <td className="px-2.5 py-2 font-mono text-brand-navy">{row.inquiryDate}</td>
              <td className="px-2.5 py-2 text-brand-text">{row.subscriberName ?? '—'}</td>
              <td className="px-2.5 py-2 text-brand-text">
                {row.inquiryTypeLabel}
                {row.inquiryType ? (
                  <span className="ml-1 font-mono text-[0.68rem] text-brand-muted">({row.inquiryType})</span>
                ) : null}
              </td>
              <td className="px-2.5 py-2 font-mono text-brand-text">{row.amount ?? '—'}</td>
              <td className="px-2.5 py-2">
                {row.countsTowardLoanEnquiryLimit ? (
                  <span className="inline-flex rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-[0.68rem] font-extrabold text-[#166534]">
                    Counted
                  </span>
                ) : (
                  <span className="text-[0.72rem] text-brand-muted">{row.excludeReason ?? 'Excluded'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PostBreInspectionSections({ result }: { result: PostBreDryRunResult }) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            Bureau summary
          </h2>
          <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
            Parsed from TrueLink credit report and vendor envelope.
          </p>
        </div>
        <PostBreBureauSummaryCards result={result} />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            Eligibility criteria keys
          </h2>
          <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
            Config values loaded from <code className="text-[0.78rem]">eligibility_criteria</code> for this
            post-BRE run and which checks consume each key.
          </p>
        </div>
        <PostBreCriteriaTable rows={result.inspection.criteria} />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            Tradelines on report
          </h2>
          <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
            Every account scanned; signals highlight restructure (TUEF Tag 33) and SMA/PWOS hits. Rules column
            shows which post-BRE checks evaluate that row.
          </p>
        </div>
        <PostBreTradelinesTable rows={result.inspection.tradelines} />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="m-0 text-[1rem] font-extrabold tracking-[-0.03em] text-brand-navy">
            Credit enquiries
          </h2>
          <p className="m-0 mt-1 text-[0.82rem] text-brand-muted">
            Loan enquiry count uses the rolling window. All enquiry purposes are counted.
          </p>
        </div>
        <PostBreEnquiriesTable rows={result.inspection.enquiries} />
      </section>
    </div>
  );
}
