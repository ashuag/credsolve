'use client';

import { MaskedSecret, ReviewSectionLabel } from '@/components/applications/review/application-review-ui';
import { formatReviewDateTime, maskAccount } from '@/lib/application-review-format';
import type { LosApplicationDetails } from '@/lib/api';

type PennyDropAttemptRow = NonNullable<LosApplicationDetails['bankAccountAttempts']>[number];

const COLUMNS = ['#', 'Status', 'When', 'Account', 'IFSC', 'Bank', 'Name on application', 'Name at bank', 'Name match'] as const;

function AttemptStatusCell({ passed, underReview }: { passed: boolean; underReview: boolean }) {
  if (passed) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-extrabold uppercase tracking-[0.06em] text-emerald-800">
        Passed
      </span>
    );
  }
  if (underReview) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-extrabold uppercase tracking-[0.06em] text-amber-900">
        Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[0.7rem] font-extrabold uppercase tracking-[0.06em] text-rose-800">
      Failed
    </span>
  );
}

function NameMatchScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-brand-muted">—</span>;
  const tone =
    score >= 100
      ? { background: 'rgba(16,185,129,0.1)', color: '#047857' }
      : score >= 70
        ? { background: 'rgba(245,158,11,0.12)', color: '#b45309' }
        : { background: 'rgba(239,68,68,0.1)', color: '#b91c1c' };
  return (
    <span
      className="inline-flex min-w-[46px] items-center justify-center rounded-[7px] px-2 py-0.5 text-[0.8rem] font-extrabold"
      style={tone}
    >
      {score}%
    </span>
  );
}

function AttemptHistoryTable({ attempts }: { attempts: PennyDropAttemptRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[rgba(23,44,113,0.1)]">
      <table className="w-full min-w-[760px] border-collapse text-[0.84rem]">
        <thead>
          <tr className="bg-[rgba(23,44,113,0.05)]">
            {COLUMNS.map((label) => (
              <th
                key={label}
                className="border-b border-[rgba(23,44,113,0.08)] px-3 py-2 text-left text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-brand-muted whitespace-nowrap"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt, index) => {
            const passed = attempt.status === true;
            const underReview = !passed && attempt.nameMatchScore != null;
            return (
              <tr
                key={attempt.id}
                className={passed ? 'bg-emerald-50/80' : underReview ? 'bg-amber-50/80' : 'bg-rose-50/80'}
              >
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-extrabold text-brand-navy whitespace-nowrap">
                  {attempts.length - index}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 whitespace-nowrap">
                  <AttemptStatusCell passed={passed} underReview={underReview} />
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text whitespace-nowrap">
                  {formatReviewDateTime(attempt.createdAt)}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5">
                  <MaskedSecret value={attempt.bankAccountNumber} mask={maskAccount(attempt.bankAccountNumber)} />
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text whitespace-nowrap">
                  {attempt.ifscCode || '—'}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text">
                  {attempt.bankName || '—'}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text">
                  {attempt.accountHolderName || '—'}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 font-semibold text-brand-text">
                  {attempt.nameAtBank || '—'}
                </td>
                <td className="border-b border-[rgba(23,44,113,0.06)] px-3 py-2.5 whitespace-nowrap">
                  <NameMatchScoreCell score={attempt.nameMatchScore ?? null} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PennyDropAttemptHistory({
  attempts,
  variant = 'overview',
}: {
  attempts: PennyDropAttemptRow[] | null | undefined;
  variant?: 'overview' | 'review';
}) {
  const rows = attempts ?? [];
  if (rows.length === 0) return null;

  if (variant === 'review') {
    return (
      <div style={{ marginBottom: 16 }}>
        <ReviewSectionLabel>Attempt history</ReviewSectionLabel>
        <AttemptHistoryTable attempts={rows} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[0.82rem] font-extrabold text-brand-navy">Attempt history</span>
        <span className="text-[0.76rem] font-semibold text-brand-muted">
          {rows.length} tr{rows.length === 1 ? 'y' : 'ies'}
        </span>
      </div>
      <AttemptHistoryTable attempts={rows} />
    </div>
  );
}
