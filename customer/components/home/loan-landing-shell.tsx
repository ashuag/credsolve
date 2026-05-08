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
    <>Fast. Secure. <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#1fa2ff] to-[#1496f3] drop-shadow-[0_0_12px_rgba(20,150,243,0.3)]">Instant.</span></>
  );

  const defaultStats = [
    { label: 'Paperless', value: '100%' },
    { label: 'Approval', value: 'Instant' },
    { label: 'Hidden Fees', value: 'Zero' },
  ];

  const stats = leftStats || defaultStats;

  return (
    <div className="w-full max-w-[1240px] flex flex-col lg:flex-row bg-white rounded-[2.5rem] shadow-[0_24px_80px_rgba(23,44,113,0.12),0_8px_32px_rgba(23,44,113,0.06)] overflow-hidden border border-slate-100 relative z-10 animate-fade-in-up">
      
      {/* ── Left panel ── */}
      <div className="w-full lg:w-5/12 hidden lg:flex min-h-0 flex-col relative bg-[#0a1628] overflow-hidden">
        
        {/* Background Mesh */}
        <div className="absolute inset-0 stats-mesh opacity-90 pointer-events-none" />

        {/* Ambient blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1496f3] rounded-full mix-blend-screen blur-[100px] opacity-30 animate-blob" />
        <div className="absolute top-1/2 right-0 w-80 h-80 bg-[#ffc519] rounded-full mix-blend-screen blur-[100px] opacity-15 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-20 -left-16 w-80 h-80 bg-[#818cf8] rounded-full mix-blend-screen blur-[100px] opacity-25 animate-blob animation-delay-4000" />

        {/* Content wrapper — tighter spacing so the left rail fits common laptop heights without scrolling */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col py-6 px-8 xl:px-10 gap-4 xl:gap-5">
          
          {/* Speedometer */}
          <div className="flex shrink-0 justify-center">
            <JourneySpeedometer />
          </div>

          <div className="w-full shrink-0 h-px bg-white/10" />

          {/* Headline */}
          <div className="text-center shrink-0">
            <h1 className="text-2xl xl:text-[2.1rem] font-[900] text-white tracking-tight leading-[1.1] mb-2">
              {leftTitle || defaultTitle}
            </h1>
            <p className="text-[0.98rem] text-slate-300 leading-snug max-w-sm mx-auto font-[500]">
              {leftDescription || 'Experience a seamless digital journey. Get your loan approved in minutes without the hassle of paperwork.'}
            </p>
          </div>

          {/* Infographic OR feature list */}
          {leftInfographic ? (
            <div className="flex min-h-0 flex-1 justify-center items-center py-1">
              <div className="w-full max-w-[280px] aspect-square transition-transform hover:scale-[1.03] duration-500 drop-shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                {leftInfographic}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-sm mx-auto w-full min-h-0 flex-1 justify-center">
              {DEFAULT_FEATURES.map((f, i) => (
                <div key={f.label} className="flex items-center gap-3.5 group">
                  <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm transition-all duration-300 group-hover:bg-[#1496f3]/20 group-hover:border-[#1496f3]/40 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(20,150,243,0.3)]">
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-[#ffc519] transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={f.icon} />
                    </svg>
                  </div>
                  <span className="text-[0.95rem] text-slate-200 font-[600] leading-snug transition-colors duration-300 group-hover:text-white">{f.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stats bar */}
          <div className="mt-auto shrink-0 border-t border-white/10 pt-4 flex justify-around">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-[1.75rem] font-[900] text-white leading-none tracking-tight mb-1">{stat.value}</div>
                <div className="text-[0.68rem] text-[#1496f3] uppercase tracking-[0.15em] font-[800]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: journey form ── */}
      <div className="w-full lg:w-7/12 flex flex-col justify-center p-6 sm:p-10 lg:p-14 bg-white relative">
        <div className="w-full max-w-[480px] mx-auto h-full">
          {/* Mobile-only header */}
          <div className="mb-8 lg:hidden text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[0.7rem] font-[800] tracking-widest uppercase mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              100% Digital Process
            </div>
            <h1 className="text-[2rem] font-[900] text-brand-navy mb-2 tracking-tight leading-tight">Instant Loan</h1>
            <p className="text-brand-muted font-[500] text-[1.05rem]">Start your seamless digital journey.</p>
          </div>
          {journeyPanel}
        </div>
      </div>

    </div>
  );
}
