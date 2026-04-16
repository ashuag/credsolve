function BureauBadge({
  name,
  accentColor,
  textColor
}: {
  name: string;
  accentColor: string;
  textColor: string;
}) {
  return (
    <div className="inline-flex items-center justify-center rounded-[16px] border border-[rgba(18,36,79,0.1)] bg-white px-4 py-3 shadow-[0_10px_18px_rgba(23,44,113,0.06)]">
      <svg viewBox="0 0 140 32" className="h-8 w-[112px]" role="img" aria-label={name}>
        <rect x="1" y="1" width="138" height="30" rx="12" fill="white" stroke="rgba(18,36,79,0.08)" />
        <circle cx="18" cy="16" r="6" fill={accentColor} />
        <text
          x="34"
          y="20"
          fill={textColor}
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 800, letterSpacing: '0.08em' }}
        >
          {name}
        </text>
      </svg>
    </div>
  );
}

export function CreditBureauPoweredBy() {
  return (
    <div className="grid gap-3 rounded-[22px] border border-[rgba(18,36,79,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,249,255,0.94))] px-4 py-4 shadow-[0_14px_28px_rgba(23,44,113,0.08)]">
      <div>
        <span className="block text-[0.74rem] font-extrabold uppercase tracking-[0.14em] text-brand-blue">
          Powered by
        </span>
        <strong className="mt-1 block text-[1rem] text-brand-navy">TU CIBIL and Equifax</strong>
      </div>

      <div className="flex flex-wrap gap-3 max-sm:flex-col">
        <BureauBadge name="CIBIL" accentColor="#1496f3" textColor="#12244f" />
        <BureauBadge name="Equifax" accentColor="#7dc142" textColor="#12244f" />
      </div>
    </div>
  );
}
