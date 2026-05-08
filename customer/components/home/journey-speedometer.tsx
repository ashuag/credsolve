'use client';

import { usePathname } from 'next/navigation';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';

const JOURNEY_STEPS = ['Onboarding', 'Apply', 'KYC', 'Bank', 'Done'] as const;

/** Uniform progress: each step covers an equal slice (20% … 100%). */
function progressForStep(stepIndex: number): number {
  return Math.min(100, Math.max(0, (stepIndex + 1) * 20));
}

/**
 * Order matters: first match wins. Labels always match `JOURNEY_STEPS[stepIndex]`.
 * Journey: entry / profile → loan offer & selection → KYC → bank → done.
 */
function getStepIndex(pathname: string): number {
  const p = pathname || '';
  if (p.includes('/thank-you')) return 4;
  if (p.includes('/bank-details')) return 3;
  if (p.includes('/kyc')) return 2;
  if (
    p.includes('/pre-approved-loan') ||
    p.includes('/loan-selection') ||
    p.includes('/loan-offer')
  ) {
    return 1;
  }
  if (p.includes('/apply-for-loan') || p.includes('/onboarding')) return 0;
  return 0;
}

export function JourneySpeedometer() {
  const pathname = usePathname() || '';
  const stepIndex = getStepIndex(pathname);
  const pathnameProgress = progressForStep(stepIndex);
  const journeyInline = useJourneyProgressOptional();

  /** On `/onboarding`, needle moves smoothly from ~20%→39% as the user completes email → OTP → profile → address. */
  let progress = pathnameProgress;
  if (pathname.includes('/onboarding') && journeyInline) {
    progress = Math.round(20 + journeyInline.completion01 * 19);
  }

  const stepText = JOURNEY_STEPS[stepIndex];

  // Semicircle gauge only (no text inside SVG — avoids overlap with hub / needle).
  const cx = 90;
  const cy = 62;
  const r = 56;
  const circumference = Math.PI * r;
  const strokeDashoffset = circumference * (1 - progress / 100);
  const needleAngle = progress * 1.8 - 90;

  return (
    <div className="flex flex-col items-center w-full gap-2">
      <svg
        viewBox="0 0 180 78"
        className="w-[min(90vw,280px)] sm:w-[min(90vw,340px)] lg:w-[min(90vw,360px)] shrink-0"
        aria-hidden
      >
        <defs>
          <linearGradient id="speedoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="9"
          strokeLinecap="round"
        />

        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#speedoGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />

        {[0, 25, 50, 75, 100].map((pct) => {
          const a = (pct / 100) * Math.PI;
          const ox = Math.cos(Math.PI - a);
          const oy = -Math.sin(Math.PI - a);
          return (
            <line
              key={pct}
              x1={cx + r * ox}
              y1={cy + r * oy}
              x2={cx + (r - 11) * ox}
              y2={cy + (r - 11) * oy}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}

        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <rect
            x={cx - 1.5}
            y={cy - r + 14}
            width="3"
            height={r - 14}
            rx="1.5"
            fill="white"
            opacity="0.92"
          />
        </g>

        <circle cx={cx} cy={cy} r="6" fill="white" />
        <circle cx={cx} cy={cy} r="2.5" fill="#1e293b" />
      </svg>

      <div className="flex flex-col items-center gap-0.5 -mt-1 text-center">
        <span className="text-[1.35rem] sm:text-[1.5rem] font-black tabular-nums leading-none text-white">
          {progress}%
        </span>
        <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-sky-300/95 leading-none">
          {stepText}
        </span>
      </div>

      <div className="flex items-start justify-center gap-3 sm:gap-4 w-full px-2 pt-1">
        {JOURNEY_STEPS.map((step, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={step} className="flex flex-col items-center gap-1">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                  done
                    ? 'bg-green-400'
                    : active
                      ? 'bg-yellow-400 ring-2 ring-yellow-300/40 scale-125'
                      : 'bg-white/20'
                }`}
              />
              <span
                className={`text-[0.45rem] sm:text-[0.5rem] font-[800] uppercase tracking-wide leading-[1.1] text-center max-[380px]:max-w-[52px] ${
                  active ? 'text-yellow-300' : done ? 'text-green-300' : 'text-white/30'
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
