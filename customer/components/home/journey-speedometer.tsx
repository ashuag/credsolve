'use client';

import { useId } from 'react';
import { usePathname } from 'next/navigation';
import { useJourneyProgressOptional } from '@/components/journey/journey-progress-context';
import { useCustomerSession } from '@/components/providers/customer-session-provider';
import { isCustomerPortalSignedIn } from '@/lib/api/customer-session';
import {
  buildCustomerJourneyProgress,
  CUSTOMER_JOURNEY_PROGRESS_STEPS,
} from '@/lib/customer-journey-progress';

const JOURNEY_STEPS = CUSTOMER_JOURNEY_PROGRESS_STEPS.map((s) => s.shortLabel);
const STEP_COUNT = JOURNEY_STEPS.length;

/**
 * Path → stage index for guests / deep links.
 * Thank-you is not a progress dot — maps to the final OTP stage (100%).
 */
function getStepIndexFromPathname(pathname: string): number {
  const p = pathname || '';
  const last = STEP_COUNT - 1;
  if (p.includes('/thank-you-interest') || p.includes('/thank-you') || p.includes('/active-loan')) {
    return last;
  }
  if (p.includes('/references')) return 7;
  if (p.includes('/bank-details')) return 6;
  if (p.includes('/kyc')) return 5;
  if (p.includes('/loan-documents')) return 4;
  if (p.includes('/email-verify')) return 3;
  if (p.includes('/pre-approved-loan') || p.includes('/loan-selection') || p.includes('/loan-offer')) {
    return 2;
  }
  if (p.includes('/onboarding')) return 1;
  if (p.includes('/apply-for-loan')) return 0;
  return 0;
}

export function JourneySpeedometer({ compact = false }: { compact?: boolean }) {
  const gradientId = `mc-speedo-grad-${useId().replace(/:/g, '')}`;
  const pathname = usePathname() || '';
  const { session } = useCustomerSession();
  const journeyInline = useJourneyProgressOptional();
  const journey = buildCustomerJourneyProgress(session);

  const pathStep = getStepIndexFromPathname(pathname);
  const m = journey.completed;
  const currentFromSession = journey.steps.findIndex((s) => s.state === 'current');

  /** Guests: 0% until OTP succeeds; stage dots follow URL (usually Onboarding). */
  let progress = journey.percent;
  let stepIndex = currentFromSession >= 0 ? currentFromSession : STEP_COUNT - 1;

  if (
    pathname.includes('/thank-you-interest') ||
    pathname.includes('/thank-you') ||
    pathname.includes('/active-loan')
  ) {
    progress = 100;
    stepIndex = STEP_COUNT - 1;
  } else if (!isCustomerPortalSignedIn(session)) {
    progress = 0;
    stepIndex = pathStep;
  } else {
    /** If the URL is ahead of saved milestones (e.g. deep link), align the stage label only; % stays milestone-based. */
    if (pathStep > stepIndex) {
      stepIndex = pathStep;
    }
    /** Onboarding form: fill the current step's share while completing profile after mobile verify. */
    if ((pathname.includes('/onboarding') || pathname.includes('/email-verify')) && journeyInline && m === 1) {
      const stepShare = 100 / STEP_COUNT;
      progress = Math.round(m * stepShare + journeyInline.completion01 * stepShare);
    }
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
    <div className={['flex w-full flex-col items-center', compact ? 'gap-1' : 'gap-2'].join(' ')}>
      <svg
        viewBox="0 0 180 78"
        className={
          compact
            ? 'w-[min(90vw,200px)] shrink-0'
            : 'w-[min(90vw,220px)] shrink-0 sm:w-[min(90vw,260px)] lg:w-[min(90vw,280px)]'
        }
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
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
          stroke={`url(#${gradientId})`}
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

      <div className={['flex flex-col items-center text-center', compact ? 'gap-0 -mt-3' : 'gap-0.5 -mt-2'].join(' ')}>
        <span
          className={[
            'font-black tabular-nums leading-none text-white',
            compact ? 'text-[1rem]' : 'text-[1.1rem] sm:text-[1.25rem]',
          ].join(' ')}
        >
          {progress}%
        </span>
        <span className="text-[0.58rem] font-extrabold uppercase tracking-[0.18em] leading-none text-sky-300/95">
          {stepText}
        </span>
      </div>

      {compact ? null : (
      <div className="flex max-w-full flex-wrap items-start justify-center gap-x-3 gap-y-2 px-1 pt-0.5 sm:gap-x-3 sm:px-2">
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
      )}
    </div>
  );
}
