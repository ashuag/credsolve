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