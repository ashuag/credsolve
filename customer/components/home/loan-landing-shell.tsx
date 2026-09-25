'use client';

import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { JourneySpeedometer } from './journey-speedometer';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';

const DEFAULT_FEATURES = [
  { icon: 'M5 13l4 4L19 7', label: 'Zero paperwork — 100% digital' },
  { icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: 'Approved in under 2 minutes' },
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
  /** Hide the mobile logo bar and progress strip (e.g. while a PDF fills the screen). */
  hideMobileChrome?: boolean;
  /** Stretch the journey panel to fill remaining height (PDF / document review). */
  fullBleedPanel?: boolean;
};

/* ── Mobile progress bar driven by journey context ──────────────────────── */
function MobileProgressBar() {
  const ctx = useJourneyProgressOptional();
  const pct = Math.round((ctx?.completion01 ?? 0) * 100);
  return (
    <div className="h-[3px] w-full bg-slate-100 lg:hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full bg-[#22C55E] transition-[width] duration-500 ease-out"
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
  fullBleedPanel = false,
  hideMobileChrome = false,
}: LoanLandingShellProps) {
  const defaultTitle = (
    <>Credit made <span className="text-[#22C55E]">easy.</span></>
  );

  const defaultStats = [
    { label: 'Paperless', value: '100%' },
    { label: 'Approval', value: 'Instant' },
    { label: 'Hidden Fees', value: 'Zero' },
  ];

  const stats = leftStats || defaultStats;
  const featureList = leftFeatures ?? DEFAULT_FEATURES;

  return (
    <div
      className={[
        'flex w-full min-w-0 flex-col overflow-x-clip',
        fullBleedPanel ? 'min-h-0 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden' : 'min-h-0',
      ].join(' ')}
    >
      {/* ── Mobile app bar (hidden on lg+) ────────────────────────────────── */}
      {!hideMobileChrome ? (
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(18,36,79,0.06)] backdrop-blur-md lg:hidden">
        <div className="relative flex h-14 items-center px-4">
          <div className="absolute left-1/2 -translate-x-1/2">
            <BrandLogo variant="mark" />
          </div>
        </div>

        <MobileProgressBar />
      </header>
      ) : null}

      {/* Mobile / narrow: full gauge (desktop shows this in the dark left rail). */}
      {showSpeedometer && !hideMobileChrome ? (
        <div className="flex shrink-0 justify-center bg-[#0F2748] px-4 py-5 lg:hidden">
          <JourneySpeedometer />
        </div>
      ) : null}

      {/* ── Main shell (desktop: card, mobile: full-screen) ───────────────── */}
      <div className={[
        'w-full flex flex-col bg-white lg:mx-auto',
        fullBleedPanel
          ? 'min-h-0 lg:flex-1 lg:overflow-hidden lg:max-w-[1240px] lg:flex-row lg:items-stretch lg:rounded-[2.5rem] lg:border lg:border-slate-100 lg:relative lg:z-10 lg:shadow-[0_24px_80px_rgba(23,44,113,0.12),0_8px_32px_rgba(23,44,113,0.06)] lg:animate-fade-in-up'
          : 'lg:max-w-[1240px] lg:flex-row lg:items-stretch lg:rounded-[2.5rem] lg:shadow-[0_24px_80px_rgba(23,44,113,0.12),0_8px_32px_rgba(23,44,113,0.06)] lg:overflow-hidden lg:border lg:border-slate-100 lg:relative lg:z-10 lg:animate-fade-in-up',
      ].join(' ')}>

        {/* ── Left panel (desktop only) ── */}
        {/* Stretch to the row height (do not use h-full — percentage height blocks flex stretch when the parent has no explicit height). */}
        {/* `overflow-x-hidden` alone makes `overflow-y` compute to `auto` (CSS overflow pairing), which shows a vertical scrollbar on this rail when content is a few px taller than the column. */}
        <div className="relative hidden min-h-0 w-full flex-col overflow-hidden bg-[#0F2748] lg:flex lg:w-5/12 lg:self-stretch">

          {/* Background Mesh */}
          <div className="absolute inset-0 stats-mesh opacity-90 pointer-events-none" />

          {/* Ambient blobs */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#22C55E] rounded-full mix-blend-screen blur-[110px] opacity-25 animate-blob" />
          <div className="absolute -bottom-24 right-0 w-72 h-72 bg-[#22C55E] rounded-full mix-blend-screen blur-[100px] opacity-15 animate-blob animation-delay-2000" />

          {showSpeedometer ? (
            <div className="relative z-20 flex shrink-0 justify-center px-6 pb-1 pt-7">
              <JourneySpeedometer compact />
            </div>
          ) : null}

          {/* Content wrapper (headline + infographic + stats) — flex-1 so it fills remaining rail height */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 px-8 pb-3 pt-1 xl:px-10">
            {/* Headline */}
            <div className="shrink-0 text-center">
              <h1 className="mb-1 text-xl font-[700] leading-[1.1] tracking-tight text-white xl:text-[1.65rem]">
                {leftTitle || defaultTitle}
              </h1>
              <p className="mx-auto max-w-sm text-[0.8rem] font-[500] leading-snug text-slate-300">
                {leftDescription || ''}
              </p>
            </div>

            {/* Infographic OR feature list */}
            {leftInfographic ? (
              <div className="flex min-h-0 flex-1 overflow-hidden py-0.5">
                <div className="mx-auto flex h-full w-full min-h-0 max-w-[min(340px,92%)] items-start justify-center">
                  {leftInfographic}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-w-sm mx-auto w-full min-h-0 flex-1 justify-center">
                {featureList.map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-[#22C55E]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={f.icon} />
                      </svg>
                    </span>
                    <span className="text-[0.92rem] font-[600] leading-snug text-white/90">{f.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Stats bar */}
            <div className="mt-auto flex shrink-0 justify-around border-t border-white/10 pt-2">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="mb-0.5 text-[1.15rem] font-[900] leading-none tracking-tight text-white xl:text-[1.25rem]">
                    {stat.value}
                  </div>
                  <div className="text-[0.58rem] font-[700] uppercase tracking-[0.14em] text-[#22C55E]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: journey form ── */}
        {/* Mobile: flex-1, overflow-y-auto, flush padding, pb safe-area */}
        {/* Desktop: overflow-y-auto with generous padding + centred max-width */}
        <div
          className={[
            'flex min-h-0 min-w-0 flex-1 flex-col bg-white',
            fullBleedPanel
              ? 'overflow-x-hidden overflow-y-auto px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:overflow-y-hidden lg:p-8 lg:py-6'
              : 'overflow-x-hidden overflow-y-auto px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] lg:justify-start lg:p-10 lg:py-10 lg:px-14',
          ].join(' ')}
        >
          <div
            className={
              fullBleedPanel
                ? 'flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden'
                : 'w-full min-w-0 max-w-full lg:mx-auto lg:max-w-[480px]'
            }
          >
            {journeyPanel}
          </div>
        </div>

      </div>
    </div>
  );
}
