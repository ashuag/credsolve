import type { ReactNode } from 'react';
import type { KycMatchVerdict } from '@/lib/kyc-field-match';

const STYLES: Record<KycMatchVerdict, string> = {
  match: 'border-[rgba(29,157,112,0.35)] bg-[rgba(29,157,112,0.1)] text-[#14523a]',
  partial: 'border-[rgba(180,100,0,0.35)] bg-[rgba(255,160,0,0.1)] text-[#7a4800]',
  mismatch: 'border-[rgba(231,95,95,0.35)] bg-[rgba(255,241,241,0.9)] text-[#8d3434]',
  missing: 'border-[rgba(15,39,72,0.12)] bg-[rgba(248,250,255,0.9)] text-brand-muted',
};

const LABELS: Record<KycMatchVerdict, string> = {
  match: 'Match',
  partial: 'Partial match',
  mismatch: 'Mismatch',
  missing: 'Not compared',
};

export function KycFieldMatchBadge({
  verdict,
  score,
  detail,
}: {
  verdict: KycMatchVerdict;
  score?: number;
  detail?: string;
}) {
  const label =
    verdict !== 'missing' && score != null ? `${LABELS[verdict]} ${score}%` : LABELS[verdict];

  return (
    <span
      className={`inline-flex items-center rounded-[6px] border px-1.5 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-[0.04em] ${STYLES[verdict]}`}
      title={detail}
    >
      {label}
    </span>
  );
}

export function KycComparedValue({
  value,
  verdict,
  score,
  compareLabel,
}: {
  value: ReactNode;
  verdict: KycMatchVerdict;
  score?: number;
  compareLabel?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{value}</span>
      <KycFieldMatchBadge
        verdict={verdict}
        score={score}
        detail={compareLabel ? `Profile vs ${compareLabel}` : undefined}
      />
    </span>
  );
}
