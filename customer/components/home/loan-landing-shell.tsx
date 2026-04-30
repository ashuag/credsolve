import type { ReactNode } from 'react';
import { JourneySpeedometer } from './journey-speedometer';

const DEFAULT_FEATURES = [
  { icon: 'M5 13l4 4L19 7', label: 'Zero paperwork — 100% digital' },
  { icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: 'Approved in under 2 minutes' },
  { icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label: 'Bank-grade 256-bit encryption' },
  { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', label: 'No hidden fees, ever' },
];

export type LoanLandingShellProps = {
  journeyPanel: ReactNode;
  leftTitle?: ReactNode;
  leftDescription?: string;
  leftInfographic?: ReactNode;
  leftStats?: Array<{ label: string; value: string }>;
};

export function LoanLandingShell({
  journeyPanel,
  leftTitle,
  leftDescription,
  leftInfographic,
  leftStats,
}: LoanLandingShellProps) {
  const defaultTitle = (
    <>Fast. Secure. <span className="text-[#60a5fa]">Instant.</span></>
  );

  const defaultStats = [
    { label: 'Paperless', value: '100%' },
    { label: 'Approval', value: 'Instant' },
    { label: 'Hidden Fees', value: 'Zero' },
  ];

  const stats = leftStats || defaultStats;

  return (
    <div className="w-full max-w-[1200px] flex flex-col nav:flex-row bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(23,44,113,0.12)] overflow-hidden border border-white relative z-10">

      {/* ── Left panel ── */}
      <div className="w-full nav:w-1/2 hidden nav:flex flex-col relative bg-gradient-to-br from-[#1496f3] via-[#1c347d] to-[#12244f] overflow-hidden">

        {/* Ambient blobs */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#0ea5e9] rounded-full mix-blend-screen blur-[90px] opacity-35 animate-blob" />
        <div className="absolute -bottom-20 -right-16 w-80 h-80 bg-[#818cf8] rounded-full mix-blend-screen blur-[90px] opacity-35 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#1496f3] rounded-full mix-blend-screen blur-[80px] opacity-20 animate-blob animation-delay-4000" />

        {/* Content wrapper */}
        <div className="relative z-10 flex flex-col h-full p-8 lg:p-10 gap-7">

          {/* Speedometer */}
          <div className="flex justify-center pt-2">
            <JourneySpeedometer />
          </div>

          <div className="w-full h-px bg-white/10" />

          {/* Headline */}
          <div className="text-center">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
              {leftTitle || defaultTitle}
            </h1>
            <p className="text-[0.95rem] text-blue-100 leading-relaxed max-w-xs mx-auto">
              {leftDescription || 'Experience a seamless digital journey. Get your loan approved in minutes without the hassle of paperwork.'}
            </p>
          </div>

          {/* Infographic OR feature list */}
          {leftInfographic ? (
            <div className="flex justify-center">
              <div className="w-full max-w-[280px] aspect-square transition-transform hover:scale-[1.03] duration-500">
                {leftInfographic}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-xs mx-auto w-full">
              {DEFAULT_FEATURES.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-yellow-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={f.icon} />
                    </svg>
                  </div>
                  <span className="text-[0.85rem] text-blue-100 font-[600] leading-snug">{f.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Push stats to bottom */}
          <div className="flex-1" />

          {/* Stats bar */}
          <div className="border-t border-white/10 pt-6 flex justify-around">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-[900] text-white leading-none">{stat.value}</div>
                <div className="text-[0.62rem] text-blue-200 uppercase tracking-widest font-[700] mt-1.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: journey form ── */}
      <div className="w-full nav:w-1/2 flex flex-col justify-center p-8 nav:p-14 bg-white relative">
        <div className="w-full max-w-[500px] mx-auto h-full">
          {/* Mobile-only header */}
          <div className="mb-8 nav:hidden text-center">
            <h1 className="text-3xl font-extrabold text-brand-navy mb-2">Instant Loan</h1>
            <p className="text-brand-muted">Start your seamless digital journey.</p>
          </div>
          {journeyPanel}
        </div>
      </div>

    </div>
  );
}
