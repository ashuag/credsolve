'use client';

type FlowLoaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  steps: string[];
  /** 0-based index of the step currently in progress. Steps before this show as done. */
  activeStepIndex?: number;
  /** When true, every step is ticked complete. */
  allComplete?: boolean;
};

function StepGlyph({
  index,
  state,
}: {
  index: number;
  state: 'complete' | 'active' | 'pending' | 'static';
}) {
  if (state === 'complete') {
    return (
      <span
        className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[12px] bg-[#24a86f] text-white shadow-[0_0_0_4px_rgba(36,168,111,0.22)] animate-scale-in"
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.6">
          <path d="M3 8.2 6.2 11.5 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (state === 'active') {
    return (
      <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(255,197,25,0.32),rgba(20,150,243,0.28))] text-[#fff9e8]">
        <span
          className="h-[16px] w-[16px] rounded-full border-2 border-white/25 border-t-white animate-spin"
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(255,197,25,0.26),rgba(20,150,243,0.22))] text-[#fff9e8] text-[0.84rem] font-black ${
        state === 'pending' ? 'opacity-45' : ''
      }`}
    >
      {index + 1}
    </span>
  );
}

export function FlowLoader({
  eyebrow,
  title,
  description,
  steps,
  activeStepIndex,
  allComplete = false,
}: FlowLoaderProps) {
  const tracked = typeof activeStepIndex === 'number';
  const currentIndex = tracked ? Math.max(0, Math.min(activeStepIndex, steps.length - 1)) : 0;
  const progressPct = !tracked
    ? 42
    : allComplete
      ? 100
      : Math.round(((currentIndex + 0.38) / steps.length) * 100);
  const currentStepLabel = tracked && !allComplete ? steps[currentIndex] : null;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center p-6 backdrop-blur-[16px] bg-[radial-gradient(circle_at_top,rgba(20,150,243,0.26),transparent_32rem),radial-gradient(circle_at_bottom,rgba(255,197,25,0.2),transparent_28rem),rgba(8,18,48,0.54)] max-sm:p-4"
      role="status"
      aria-live="polite"
      aria-label={
        currentStepLabel
          ? `${title}. ${eyebrow}. Step ${currentIndex + 1} of ${steps.length}: ${currentStepLabel}`
          : title
      }
    >
      {/* Background glow */}
      <div
        className="absolute bottom-[8%] left-[10%] w-[min(24rem,52vw)] h-[min(24rem,52vw)] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_72%)] blur-[8px] animate-pulse-glow"
        aria-hidden
      />

      {/* Card */}
      <div className="relative w-[min(100%,32rem)] overflow-hidden p-7 rounded-[32px] border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08)),linear-gradient(160deg,rgba(23,44,113,0.96),rgba(17,34,79,0.92))] shadow-[0_32px_80px_rgba(8,18,48,0.32)] max-sm:p-[22px] max-sm:rounded-[28px]">
        {/* Sheen sweep */}
        <div
          className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.12)_42%,transparent_66%)] -translate-x-[120%] animate-sheen pointer-events-none"
          aria-hidden
        />

        <span className="inline-flex items-center gap-[10px] px-3 py-2 rounded-full bg-[rgba(255,255,255,0.12)] text-[#fff4c1] text-[0.74rem] font-extrabold tracking-[0.14em] uppercase">
          {eyebrow}
        </span>

        {/* Orbital motion field */}
        <div
          className="relative grid place-items-center w-full min-h-[220px] max-sm:min-h-[190px]"
          aria-hidden
        >
          {/* Rings */}
          <div className="absolute w-[172px] h-[172px] rounded-full border border-[rgba(255,255,255,0.14)] animate-orbit max-sm:w-[146px] max-sm:h-[146px]" />
          <div className="absolute w-[132px] h-[132px] rounded-full border border-dashed border-[rgba(255,197,25,0.28)] animate-orbit-rev max-sm:w-[114px] max-sm:h-[114px]" />
          <div className="absolute w-[92px] h-[92px] rounded-full border border-[rgba(20,150,243,0.3)] animate-pulse-ring max-sm:w-[82px] max-sm:h-[82px]" />

          {/* Scan beam */}
          <div
            className="absolute w-[176px] h-[176px] rounded-full blur-[1px] animate-scan-beam max-sm:w-[150px] max-sm:h-[150px]"
            style={{ background: 'conic-gradient(from 220deg, transparent 0deg, rgba(20,150,243,0.36) 58deg, transparent 120deg)' }}
          />

          {/* Core */}
          <div className="w-7 h-7 rounded-full bg-[radial-gradient(circle_at_32%_30%,#fffbe6_0_18%,#ffc519_32%,#1496f3_100%)] shadow-[0_0_0_10px_rgba(255,255,255,0.06),0_0_46px_rgba(20,150,243,0.35)] animate-core-pulse" />

          {/* Orbit dots */}
          <span className="absolute w-[14px] h-[14px] rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.32)] animate-orbit-1" />
          <span className="absolute w-[10px] h-[10px] rounded-full bg-brand-gold shadow-[0_0_18px_rgba(255,255,255,0.32)] animate-orbit-2" />
          <span className="absolute w-[9px] h-[9px] rounded-full bg-brand-blue shadow-[0_0_18px_rgba(255,255,255,0.32)] animate-orbit-3" />
        </div>

        {/* Copy */}
        <div className="grid gap-[10px] -mt-1.5">
          <h2 className="m-0 text-[#fff9e8] text-[clamp(2rem,4vw,2.7rem)] leading-[0.98] tracking-[-0.05em]">
            {title}
          </h2>
          <p className="m-0 text-[rgba(240,245,255,0.84)] leading-[1.65]">{description}</p>
        </div>

        {/* Step rail */}
        <div className="grid gap-[10px] mt-[22px]">
          {steps.map((step, index) => {
            const state: 'complete' | 'active' | 'pending' | 'static' = !tracked
              ? 'static'
              : allComplete || index < currentIndex
                ? 'complete'
                : index === currentIndex
                  ? 'active'
                  : 'pending';

            return (
              <div
                key={step}
                className={`grid gap-3 items-center p-3 px-[14px] rounded-[18px] border transition-colors duration-300 ${
                  state === 'complete'
                    ? 'bg-[rgba(36,168,111,0.12)] border-[rgba(36,168,111,0.22)]'
                    : state === 'active'
                      ? 'bg-[rgba(255,255,255,0.12)] border-[rgba(255,255,255,0.2)]'
                      : 'bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.08)]'
                }`}
                style={{ gridTemplateColumns: '34px 1fr' }}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                <StepGlyph key={`${step}-${state}`} index={index} state={state} />
                <span
                  className={`text-[0.94rem] font-bold transition-colors duration-300 ${
                    state === 'complete'
                      ? 'text-[#d9ffe9]'
                      : state === 'pending'
                        ? 'text-[rgba(240,245,255,0.48)]'
                        : 'text-[rgba(240,245,255,0.94)]'
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress track */}
        <div
          className="w-full h-[10px] mt-[22px] rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)]"
          aria-hidden
        >
          <span
            className={`block h-full rounded-[inherit] ${tracked ? 'transition-[width] duration-500 ease-out' : 'w-[42%] animate-loader-bar'}`}
            style={{
              width: tracked ? `${progressPct}%` : undefined,
              background: 'linear-gradient(90deg, #1496f3, #ffc519, #1496f3)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>
    </div>
  );
}
