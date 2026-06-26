export function losStatusPillStyles(code: string): { bg: string; text: string; ring: string } {
  const c = code.toUpperCase();
  if (c === 'NEW' || c === 'IN_PROGRESS') {
    return { bg: 'rgba(20,150,243,0.14)', text: '#0b4f86', ring: 'rgba(20,150,243,0.35)' };
  }
  if (c === 'DRAFT') {
    return { bg: 'rgba(100,116,139,0.14)', text: '#334155', ring: 'rgba(100,116,139,0.28)' };
  }
  if (c === 'CONVERTED' || c.includes('APPROVED') || c.includes('DISBURS')) {
    return { bg: 'rgba(29,157,112,0.14)', text: '#14523a', ring: 'rgba(29,157,112,0.32)' };
  }
  if (c.includes('REJECT') || c.includes('DECLIN') || c.includes('CANCEL') || c === 'KYC_FAILED') {
    return { bg: 'rgba(231,95,95,0.14)', text: '#8d3434', ring: 'rgba(231,95,95,0.28)' };
  }
  if (c === 'IN_REVIEW' || c === 'INTERNAL_ERROR') {
    return { bg: 'rgba(255,197,25,0.18)', text: '#6b4e00', ring: 'rgba(245,158,11,0.35)' };
  }
  return { bg: 'rgba(23,44,113,0.08)', text: '#172c71', ring: 'rgba(23,44,113,0.16)' };
}

export function LosStatusPill({ code, label }: { code: string; label: string }) {
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
