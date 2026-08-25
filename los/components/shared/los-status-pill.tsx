export function losStatusPillStyles(code: string): { bg: string; text: string; ring: string } {
  const c = code.toUpperCase();
  if (c === 'OVERDUE' || c === 'FAILED') {
    return { bg: 'rgba(239,68,68,0.14)', text: '#b91c1c', ring: 'rgba(239,68,68,0.3)' };
  }
  if (c === 'CLOSED' || c === 'PAID' || c.includes('PAID_FULL') || c === 'SUCCESS') {
    return { bg: 'rgba(16,185,129,0.14)', text: '#047857', ring: 'rgba(16,185,129,0.32)' };
  }
  if (c === 'PENDING') {
    return { bg: 'rgba(245,158,11,0.18)', text: '#6b4e00', ring: 'rgba(245,158,11,0.35)' };
  }
  if (c === 'ACTIVE') {
    return { bg: 'rgba(14,165,233,0.14)', text: '#0369a1', ring: 'rgba(14,165,233,0.3)' };
  }
  if (c === 'WRITTEN_OFF') {
    return { bg: 'rgba(100,116,139,0.16)', text: '#334155', ring: 'rgba(100,116,139,0.28)' };
  }
  if (c === 'NEW' || c === 'IN_PROGRESS') {
    return { bg: 'rgba(20,150,243,0.14)', text: '#0b4f86', ring: 'rgba(20,150,243,0.35)' };
  }
  if (c === 'DRAFT') {
    return { bg: 'rgba(100,116,139,0.14)', text: '#334155', ring: 'rgba(100,116,139,0.28)' };
  }
  if (c === 'CONVERTED' || c.includes('APPROVED') || c.includes('DISBURS')) {
    return { bg: 'rgba(29,157,112,0.14)', text: '#14523a', ring: 'rgba(29,157,112,0.32)' };
  }
  if (c.includes('REJECT') || c.includes('DECLIN') || c.includes('CANCEL') || c === 'KYC_FAILED' || c === 'PENNYDROP_FAILED') {
    return { bg: 'rgba(231,95,95,0.14)', text: '#8d3434', ring: 'rgba(231,95,95,0.28)' };
  }
  if (c === 'IN_REVIEW' || c === 'UNDER_REVIEW' || c === 'INTERNAL_ERROR') {
    return { bg: 'rgba(255,197,25,0.18)', text: '#6b4e00', ring: 'rgba(245,158,11,0.35)' };
  }
  return { bg: 'rgba(23,44,113,0.08)', text: '#172c71', ring: 'rgba(23,44,113,0.16)' };
}

export function LosStatusPill({ code, label }: { code: string; label: string }) {
  const s = losStatusPillStyles(code);
  const c = code.toUpperCase();
  const display =
    c === 'CLOSED' || c === 'PAID'
      ? 'Paid fully'
      : c === 'OVERDUE'
        ? 'Overdue'
        : label;
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-3 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.07em] ring-1 ring-inset"
      style={{ backgroundColor: s.bg, color: s.text, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      <span className="truncate">{display}</span>
    </span>
  );
}
