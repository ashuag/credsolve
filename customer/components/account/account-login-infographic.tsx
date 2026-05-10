/**
 * Hero graphic for my-account login.
 * Shows a stylized phone with the customer's loan dashboard inside,
 * surrounded by trust badges and a compact 3-step strip below.
 */
export function AccountLoginInfographic() {
  return (
    <div className="relative mx-auto flex w-full max-w-[320px] flex-col items-center">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-10 top-1/4 h-44 w-44 rounded-full bg-[#1496f3]/22 blur-3xl" />
        <div className="absolute -right-6 bottom-1/4 h-44 w-44 rounded-full bg-[#ffc519]/14 blur-3xl" />
      </div>

      <div className="relative flex w-full justify-center">
        <PhoneMockup />

        <FloatingChip
          className="absolute -left-1 top-6 -rotate-[6deg]"
          tone="blue"
          icon={<IconLock />}
          label="Bank-grade"
        />
        <FloatingChip
          className="absolute -right-2 top-1/3 rotate-[5deg]"
          tone="gold"
          icon={<IconBolt />}
          label="30s OTP"
        />
        <FloatingChip
          className="absolute -left-2 bottom-10 -rotate-[4deg]"
          tone="green"
          icon={<IconCheck />}
          label="Paperless"
        />
      </div>

      <div className="relative mt-5 grid w-full grid-cols-3 gap-1.5">
        <StepPill index={1} label="Mobile" sub="+91" />
        <StepPill index={2} label="OTP" sub="SMS" highlight />
        <StepPill index={3} label="My account" sub="Hub" />
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative h-[300px] w-[170px] rounded-[34px] border border-white/15 bg-[#0a1628] p-2 shadow-[0_28px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="absolute left-1/2 top-2 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/70" aria-hidden />

      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[26px] bg-[linear-gradient(160deg,#fbfdff_0%,#eef5ff_100%)] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[0.5rem] font-black uppercase tracking-[0.16em] text-slate-400">
              My account
            </p>
            <p className="text-[0.78rem] font-extrabold leading-tight text-brand-navy">
              Welcome back
            </p>
          </div>
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1496f3]/12 text-[0.6rem] font-black text-brand-blue">
            R
          </span>
        </div>

        <div className="mt-2 rounded-[14px] border border-[rgba(20,150,243,0.18)] bg-white p-2.5 shadow-[0_8px_18px_rgba(23,44,113,0.08)]">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-wider text-emerald-700">
              Active
            </span>
            <span className="text-[0.5rem] font-bold text-slate-400">
              Loan #1
            </span>
          </div>
          <p className="mt-1.5 text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">
            Outstanding
          </p>
          <p className="text-[1.05rem] font-black leading-none tracking-tight text-brand-navy">
            ₹25,000
          </p>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#1496f3] to-[#38bdf8]" />
          </div>
          <p className="mt-1 text-[0.5rem] font-semibold text-slate-500">
            Due 15 Jun
          </p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <MiniStat label="Repaid" value="₹14k" tone="blue" />
          <MiniStat label="Score" value="A+" tone="gold" />
        </div>

        <div className="mt-2 flex flex-1 items-end">
          <Sparkline />
        </div>

        <div className="mt-1.5 flex items-center justify-center gap-1 rounded-full bg-[#12244f] py-1 text-[0.55rem] font-black uppercase tracking-wider text-[#ffc519]">
          <span className="h-1 w-1 rounded-full bg-[#ffc519]" />
          Continue
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'gold';
}) {
  const accent =
    tone === 'gold'
      ? 'bg-[#fff8df] text-amber-800 ring-amber-200'
      : 'bg-[#eaf5ff] text-brand-navy ring-blue-200';
  return (
    <div className={`rounded-[10px] p-1.5 ring-1 ${accent}`}>
      <p className="text-[0.48rem] font-black uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="text-[0.7rem] font-black leading-tight">{value}</p>
    </div>
  );
}

function Sparkline() {
  return (
    <svg
      viewBox="0 0 140 32"
      className="h-7 w-full"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="accSparkFill" x1="0" y1="0" x2="0" y2="32">
          <stop stopColor="#1496f3" stopOpacity="0.28" />
          <stop offset="1" stopColor="#1496f3" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 24 L20 18 L40 22 L60 12 L80 16 L100 8 L120 14 L140 4 L140 32 L0 32 Z"
        fill="url(#accSparkFill)"
      />
      <path
        d="M0 24 L20 18 L40 22 L60 12 L80 16 L100 8 L120 14 L140 4"
        stroke="#1496f3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FloatingChip({
  className,
  tone,
  icon,
  label,
}: {
  className?: string;
  tone: 'blue' | 'gold' | 'green';
  icon: React.ReactNode;
  label: string;
}) {
  const palette =
    tone === 'gold'
      ? 'bg-gradient-to-br from-[#fff8df] to-[#ffe492] text-amber-900 ring-[#ffc519]/40'
      : tone === 'green'
        ? 'bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] text-emerald-900 ring-emerald-300/50'
        : 'bg-gradient-to-br from-white to-[#dbeafe] text-brand-navy ring-blue-200/70';

  return (
    <div
      className={`pointer-events-none inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-extrabold shadow-[0_10px_22px_rgba(0,0,0,0.25)] ring-1 backdrop-blur-sm ${palette} ${className ?? ''}`}
    >
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
        {icon}
      </span>
      {label}
    </div>
  );
}

function StepPill({
  index,
  label,
  sub,
  highlight,
}: {
  index: number;
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex min-h-[58px] flex-col items-center justify-center rounded-[14px] px-2 py-2 text-center ${
        highlight
          ? 'border border-[#ffc519]/55 bg-gradient-to-br from-[#ffc519]/16 to-[#ffc519]/[0.04] shadow-[0_10px_24px_rgba(255,197,25,0.18)]'
          : 'border border-white/10 bg-white/[0.05] backdrop-blur-sm'
      }`}
    >
      <span
        className={`absolute -top-2 inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.55rem] font-black ${
          highlight ? 'bg-[#ffc519] text-[#12244f]' : 'bg-white/20 text-white'
        }`}
      >
        {index}
      </span>
      <p
        className={`text-[0.62rem] font-black uppercase tracking-[0.12em] ${
          highlight ? 'text-[#ffe492]' : 'text-white'
        }`}
      >
        {label}
      </p>
      <p className="mt-0.5 text-[0.55rem] font-semibold text-sky-200/65">
        {sub}
      </p>
    </div>
  );
}

function IconLock() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden
    >
      <path d="M7 11V8a5 5 0 0110 0v3" strokeLinecap="round" />
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      aria-hidden
    >
      <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
