'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { JourneySpeedometer } from './journey-speedometer';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';

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
  /** When set, replaces the default marketing bullet list on the dark left rail. */
  leftFeatures?: Array<{ icon: string; label: string }>;
  /** Show journey progress dial on the dark left rail (apply-for-loan default). */
  showSpeedometer?: boolean;
  /** Mobile app bar: label shown next to step number (e.g. "Step 1 of 3") */
  mobileStepLabel?: string;
  /** Mobile app bar: called when the back arrow is tapped. If omitted, back arrow is hidden. */
  mobileOnBack?: () => void;
};

/* ── Mobile progress bar driven by journey context ──────────────────────── */
function MobileProgressBar() {
  const ctx = useJourneyProgressOptional();
  const pct = Math.round((ctx?.completion01 ?? 0) * 100);
  return (
    <div className="h-[3px] w-full bg-slate-100 lg:hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#1496f3] to-[#60c3ff] transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function LoanLandingShell({
  journeyPanel,
  leftTitle,
  leftDescription,
  leftInfographic,
  leftStats,
  leftFeatures,
  showSpeedometer = true,
  mobileStepLabel,
  mobileOnBack,
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
  const featureList = leftFeatures ?? DEFAULT_FEATURES;

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-col overflow-x-hidden">
      {/* ── Mobile app bar (hidden on lg+) ────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_0_rgba(18,36,79,0.06)]">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Back button */}
          {mobileOnBack ? (
            <button
              type="button"
              onClick={mobileOnBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors active:scale-95"
              aria-label="Go back"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
          ) : (
            <Link href="/" className="flex h-9 w-9 items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </Link>
          )}

          {/* Logo centred */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2">
            <Image
              src="/images/moneycash-logo.png"
              alt="MoneyCash"
              width={120}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Step label */}
          <span className="text-[0.7rem] font-[800] uppercase tracking-[0.14em] text-[#1496f3]">
            {mobileStepLabel ?? ''}
          </span>
        </div>

        {/* Thin progress strip */}
        <MobileProgressBar />
      </header>

      {/* Mobile / narrow: full gauge (desktop shows this in the dark left rail). */}
      {showSpeedometer ? (
        <div className="lg:hidden shrink-0 border-b border-white/10 bg-[#0a1628] py-3 flex justify-center">
          <JourneySpeedometer />
        </div>
      ) : null}

      {/* ── Main shell (desktop: card, mobile: full-screen) ───────────────── */}
      <div className={[
        // Mobile: full-screen white, no rounded card
        'w-full flex flex-col bg-white lg:mx-auto',
        // Desktop: premium split-panel card
        'lg:max-w-[1240px] lg:flex-row lg:rounded-[2.5rem] lg:shadow-[0_24px_80px_rgba(23,44,113,0.12),0_8px_32px_rgba(23,44,113,0.06)] lg:overflow-hidden lg:border lg:border-slate-100 lg:relative lg:z-10 lg:animate-fade-in-up',
      ].join(' ')}>

        {/* ── Left panel (desktop only) ── */}
        <div className="w-full lg:w-5/12 hidden lg:flex min-h-0 flex-col relative bg-[#0a1628] overflow-x-hidden">

          {/* Background Mesh */}
          <div className="absolute inset-0 stats-mesh opacity-90 pointer-events-none" />

          {/* Ambient blobs */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1496f3] rounded-full mix-blend-screen blur-[100px] opacity-30 animate-blob" />
          <div className="absolute top-1/2 right-0 w-80 h-80 bg-[#ffc519] rounded-full mix-blend-screen blur-[100px] opacity-15 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-20 -left-16 w-80 h-80 bg-[#818cf8] rounded-full mix-blend-screen blur-[100px] opacity-25 animate-blob animation-delay-4000" />

          {showSpeedometer ? (
            <div className="relative z-20 flex shrink-0 flex-col items-center px-4 pt-4 pb-1">
              <div className="flex w-full max-w-[min(100%,280px)] justify-center">
                <JourneySpeedometer />
              </div>
              <div className="mt-3 h-px w-[calc(100%-2rem)] max-w-[280px] shrink-0 bg-white/10" />
            </div>
          ) : null}

          {/* Content wrapper (headline + infographic + stats) — flex-1 so it fills remaining rail height */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col px-8 pb-4 pt-2 xl:px-10 gap-3 xl:gap-3">
            {/* Headline */}
            <div className="text-center shrink-0">
              <h1 className="text-xl xl:text-[1.8rem] font-[900] text-white tracking-tight leading-[1.1] mb-1.5">
                {leftTitle || defaultTitle}
              </h1>
              <p className="text-[0.88rem] text-slate-300 leading-snug max-w-sm mx-auto font-[500]">
                {leftDescription || 'Experience a seamless digital journey. Get your loan approved in minutes without the hassle of paperwork.'}
              </p>
            </div>

            {/* Infographic OR feature list */}
            {leftInfographic ? (
              <div className="flex min-h-0 flex-1 justify-center items-center py-1">
                <div className="flex w-full max-w-[min(280px,90%)] items-center justify-center transition-transform duration-500 hover:scale-[1.015]">
                  {leftInfographic}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-sm mx-auto w-full min-h-0 flex-1 justify-center">
                {featureList.map((f) => (
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
            <div className="mt-auto shrink-0 border-t border-white/10 pt-3 flex justify-around">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-[1.4rem] font-[900] text-white leading-none tracking-tight mb-0.5">{stat.value}</div>
                  <div className="text-[0.62rem] text-[#1496f3] uppercase tracking-[0.15em] font-[800]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: journey form ── */}
        {/* Mobile: flex-1, overflow-y-auto, flush padding, pb safe-area */}
        {/* Desktop: overflow-y-auto with generous padding + centred max-width */}
        <div className={[
          'flex-1 min-w-0 flex flex-col bg-white',
          // Mobile
          'overflow-y-auto px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]',
          // Desktop override
          'lg:justify-start lg:overflow-y-auto lg:p-10 lg:py-10 lg:px-14',
        ].join(' ')}>
          <div className="w-full lg:max-w-[480px] lg:mx-auto">
            {journeyPanel}
          </div>
        </div>

      </div>
    </div>
  );
}
