import type { ReactNode } from 'react';
import { useId } from 'react';

type AccessFlowInfographicProps = {
  /** Dark panel (navy mesh) — default for my-account hero. */
  variant?: 'dark' | 'light';
};

/** Premium visual journey — minimal labels, strong icons & glow. */
export function AccessFlowInfographic({ variant = 'dark' }: AccessFlowInfographicProps) {
  const isDark = variant === 'dark';

  return (
    <div className={`relative flex min-h-[260px] flex-col justify-center py-2 ${isDark ? '' : 'py-6'}`}>
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
        <div
          className={`absolute -left-8 top-1/4 h-44 w-44 rounded-full blur-3xl ${isDark ? 'bg-[#1496f3]/25' : 'bg-[#1496f3]/15'}`}
        />
        <div
          className={`absolute -right-6 bottom-0 h-48 w-48 rounded-full blur-3xl ${isDark ? 'bg-[#22c55e]/15' : 'bg-[#22c55e]/25'}`}
        />
        <div className="absolute left-1/2 top-0 h-px w-[min(90%,320px)] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-80" />
      </div>

      <p
        className={`relative mb-6 text-center text-[0.65rem] font-black uppercase tracking-[0.35em] ${isDark ? 'text-sky-300/90' : 'text-brand-blue'}`}
      >
        How it works
      </p>

      {/* Desktop / tablet: horizontal pipeline */}
      <div className="relative hidden sm:flex sm:items-start sm:justify-center sm:gap-0 md:px-2">
        <PipelineConnector className="absolute left-[12%] right-[12%] top-[52px] z-0 hidden h-[52px] md:block" dark={isDark} />
        <FlowOrb step={1} title="Number" subtitle="+91" dark={isDark}>
          <GraphicPhone large />
        </FlowOrb>
        <FlowOrb step={2} title="Verify" subtitle="OTP" highlight dark={isDark}>
          <GraphicShield large />
        </FlowOrb>
        <FlowOrb step={3} title="Loan" subtitle="Go" dark={isDark}>
          <GraphicLoan large />
        </FlowOrb>
      </div>

      {/* Mobile: vertical stack */}
      <div className="relative flex flex-col items-center gap-0 sm:hidden">
        <FlowOrb step={1} title="Number" subtitle="+91" dark={isDark} compact>
          <GraphicPhone />
        </FlowOrb>
        <VerticalDash dark={isDark} />
        <FlowOrb step={2} title="Verify" subtitle="OTP" highlight dark={isDark} compact>
          <GraphicShield />
        </FlowOrb>
        <VerticalDash dark={isDark} />
        <FlowOrb step={3} title="Loan" subtitle="Go" dark={isDark} compact>
          <GraphicLoan />
        </FlowOrb>
      </div>

      {/* Trust strip */}
      <div
        className={`relative mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t pt-6 ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}
      >
        {[
          { icon: '🔒', label: 'Secure OTP' },
          { icon: '⚡', label: 'Under 30s' },
          { icon: '✓', label: 'Paperless' },
        ].map((item) => (
          <span
            key={item.label}
            className={`inline-flex items-center gap-2 text-[0.72rem] font-bold ${isDark ? 'text-white/55' : 'text-brand-muted'}`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[0.85rem] shadow-inner">
              {item.icon}
            </span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function VerticalDash({ dark }: { dark: boolean }) {
  return (
    <div className="flex h-8 w-full flex-col items-center justify-center py-1" aria-hidden>
      <div
        className={`h-full w-px bg-gradient-to-b ${dark ? 'from-[#1496f3]/50 via-[#22c55e]/70 to-[#1496f3]/50' : 'from-brand-blue/30 via-[#22c55e]/60 to-brand-blue/30'}`}
      />
    </div>
  );
}

function PipelineConnector({ className, dark }: { className?: string; dark: boolean }) {
  return (
    <svg className={className} viewBox="0 0 400 52" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path
        d="M 24 38 Q 110 8 200 26 T 376 38"
        stroke={dark ? 'url(#pipeGradDark)' : 'url(#pipeGradLight)'}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        className="opacity-90"
      />
      <defs>
        <linearGradient id="pipeGradDark" x1="0" y1="0" x2="400" y2="0">
          <stop stopColor="#1496f3" stopOpacity="0.25" />
          <stop offset="0.5" stopColor="#22c55e" stopOpacity="0.85" />
          <stop offset="1" stopColor="#1496f3" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="pipeGradLight" x1="0" y1="0" x2="400" y2="0">
          <stop stopColor="#1496f3" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#22c55e" stopOpacity="0.75" />
          <stop offset="1" stopColor="#1496f3" stopOpacity="0.35" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FlowOrb({
  step,
  title,
  subtitle,
  highlight,
  dark,
  compact,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  highlight?: boolean;
  dark: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`relative z-[1] flex flex-col items-center ${compact ? 'w-full max-w-[200px]' : 'w-[30%] max-w-[140px]'}`}>
      <div
        className={`relative flex aspect-square w-[min(104px,28vw)] max-w-[120px] items-center justify-center rounded-[26px] md:w-[120px] ${
          highlight
            ? dark
              ? 'animate-ring-pop bg-gradient-to-br from-[#22c55e]/25 via-[#ecfdf5]/10 to-[#1496f3]/20 shadow-[0_0_0_1px_rgba(34,197,94,0.45),0_20px_50px_rgba(0,0,0,0.35)] ring-2 ring-[#22c55e]/70'
              : 'shadow-[0_16px_40px_rgba(34,197,94,0.35)] ring-2 ring-[#22c55e]/80 bg-gradient-to-br from-amber-50 to-white'
            : dark
              ? 'border border-white/15 bg-white/[0.07] shadow-[0_16px_40px_rgba(0,0,0,0.25)] backdrop-blur-md'
              : 'border border-[rgba(20,150,243,0.2)] bg-white shadow-[0_14px_32px_rgba(23,44,113,0.08)]'
        }`}
      >
        <span
          className={`absolute -left-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full text-[0.65rem] font-black ${
            highlight
              ? 'bg-[#22c55e] text-[#12244f] shadow-lg'
              : dark
                ? 'bg-white/15 text-white'
                : 'bg-brand-blue/10 text-brand-navy'
          }`}
        >
          {step}
        </span>
        <div className={compact ? 'scale-[0.92]' : ''}>{children}</div>
      </div>
      <p
        className={`mt-3 text-center text-[0.68rem] font-black uppercase tracking-[0.18em] ${dark ? 'text-white' : 'text-brand-navy'}`}
      >
        {title}
      </p>
      <p className={`mt-0.5 text-center text-[0.75rem] font-semibold ${dark ? 'text-sky-200/70' : 'text-brand-muted'}`}>{subtitle}</p>
    </div>
  );
}

function GraphicPhone({ large }: { large?: boolean }) {
  const gid = useId().replace(/:/g, '');
  const s = large ? 'h-12 w-12' : 'h-10 w-10';
  const grad = `mcPhoneBody-${gid}`;
  return (
    <svg viewBox="0 0 48 48" className={s} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="14" y1="8" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1496f3" />
          <stop offset="1" stopColor="#0c5d9e" />
        </linearGradient>
      </defs>
      <rect x="13" y="7" width="22" height="34" rx="5" stroke={`url(#${grad})`} strokeWidth="2.4" fill="rgba(255,255,255,0.06)" />
      <rect x="18" y="11" width="12" height="22" rx="2" fill="rgba(20,150,243,0.15)" />
      <circle cx="36" cy="11" r="5.5" fill="#22c55e" />
      <path d="M33.5 11l2 2 4.5-4.5" stroke="#12244f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GraphicShield({ large }: { large?: boolean }) {
  const gid = useId().replace(/:/g, '');
  const grad = `mcShieldFill-${gid}`;
  const s = large ? 'h-[52px] w-[52px]' : 'h-10 w-10';
  return (
    <svg viewBox="0 0 48 48" className={s} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="10" y1="6" x2="38" y2="42">
          <stop stopColor="#1496f3" />
          <stop offset="1" stopColor="#12244f" />
        </linearGradient>
      </defs>
      <path
        d="M24 5l16 6.5v11.5c0 9.2-6.5 17-16 20-9.5-3-16-10.8-16-20V11.5L24 5z"
        fill={`url(#${grad})`}
        stroke="#22c55e"
        strokeWidth="1.4"
      />
      <path d="M16 24l5 5 12-13" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GraphicLoan({ large }: { large?: boolean }) {
  const s = large ? 'h-12 w-12' : 'h-10 w-10';
  return (
    <svg viewBox="0 0 48 48" className={s} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M7 17h34v20a4 4 0 01-4 4H11a4 4 0 01-4-4V17z"
        fill="rgba(255,255,255,0.08)"
        stroke="#1496f3"
        strokeWidth="2"
      />
      <path d="M7 17V13a4 4 0 014-4h26a4 4 0 014 4v4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="29" r="7" fill="#22c55e" stroke="#12244f" strokeWidth="1.5" />
      <path d="M21 29h6M24 26v6" stroke="#12244f" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
