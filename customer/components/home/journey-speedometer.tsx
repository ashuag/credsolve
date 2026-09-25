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
  if (p.includes('/references')) return 8;
  if (p.includes('/bank-details')) return 7;
  if (p.includes('/kyc/selfie')) return 6;
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

  const cx = 120;
  const cy = 118;
  const r = 86;
  const circumference = Math.PI * r;
  const strokeDashoffset = circumference * (1 - progress / 100);
  const needleAngle = -90 + (progress / 100) * 180;

  const ticks = Array.from({ length: 11 }, (_, index) => {
    const angle = Math.PI - (index / 10) * Math.PI;
    const major = index % 5 === 0;
    const inner = r - (major ? 16 : 9);
    const outer = r + 2;
    return {
      major,
      x1: cx + inner * Math.cos(angle),
      y1: cy - inner * Math.sin(angle),
      x2: cx + outer * Math.cos(angle),
      y2: cy - outer * Math.sin(angle),
    };
  });

  return (
    <div
      className={['flex w-full flex-col items-center text-white', compact ? 'max-w-[260px] gap-1' : 'max-w-[300px] gap-2'].join(' ')}
      role="meter"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Application progress ${progress} percent, ${stepText}`}
    >
      <svg
        viewBox="0 0 240 148"
        className={compact ? 'w-full' : 'w-[min(78vw,280px)]'}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>

        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />

        {ticks.map((tick) => (
          <line
            key={`${tick.x1}-${tick.y1}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.major ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'}
            strokeWidth={tick.major ? 2.4 : 1.4}
            strokeLinecap="round"
          />
        ))}

        <text x={cx - r - 2} y={cy + 18} fill="rgba(255,255,255,0.55)" fontSize="11" fontWeight="700" textAnchor="middle">
          0
        </text>
        <text x={cx + r + 2} y={cy + 18} fill="rgba(255,255,255,0.55)" fontSize="11" fontWeight="700" textAnchor="middle">
          100
        </text>

        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${needleAngle}deg)`,
            transition: 'transform 700ms ease-out',
          }}
        >
          <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 24)} stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
          <circle cx={cx} cy={cy - (r - 24)} r="3.5" fill="#22C55E" />
        </g>
        <circle cx={cx} cy={cy} r="8" fill="#07172E" stroke="#22C55E" strokeWidth="3" />
      </svg>

      <div className="-mt-2 text-center">
        <p className="text-[1.65rem] font-[800] leading-none tabular-nums text-white">
          {progress}
          <span className="text-[0.62em] text-[#22C55E]">%</span>
        </p>
        <p className="mt-1.5 text-[0.68rem] font-[800] uppercase tracking-[0.2em] text-[#22C55E]">
          Step {stepIndex + 1} of {STEP_COUNT}
        </p>
      </div>

      {compact ? null : (
        <div className="mt-1 flex w-full items-center gap-1 px-1" aria-hidden>
          {JOURNEY_STEPS.map((step, i) => {
            const stepState = journey.steps[i]?.state;
            const failed = stepState === 'failed';
            const done = !failed && (stepState === 'done' || i < stepIndex);
            const active = !failed && i === stepIndex;
            return (
              <div
                key={step}
                title={step}
                className={[
                  'h-1 flex-1 rounded-full',
                  failed ? 'bg-red-400' : done || active ? 'bg-[#22C55E]' : 'bg-white/20',
                  active ? 'h-1.5' : '',
                ].join(' ')}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
