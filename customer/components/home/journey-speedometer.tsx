'use client';

import { usePathname } from 'next/navigation';

const JOURNEY_STEPS = ['Onboarding', 'Apply', 'KYC', 'Bank', 'Done'];

function getState(pathname: string) {
  if (pathname.includes('/thank-you'))    return { progress: 100, stepText: 'Done',  stepIndex: 4 };
  if (pathname.includes('/bank-details')) return { progress: 90,  stepText: 'Bank',  stepIndex: 3 };
  if (pathname.includes('/kyc'))          return { progress: 70,  stepText: 'KYC',   stepIndex: 2 };
  if (pathname.includes('/pre-approved-loan') || pathname.includes('/loan-selection'))
                                          return { progress: 45,  stepText: 'Offer', stepIndex: 1 };
  if (pathname.includes('/apply-for-loan'))
                                          return { progress: 15,  stepText: 'Apply', stepIndex: 0 };
  return { progress: 10, stepText: 'Start', stepIndex: -1 };
}

export function JourneySpeedometer() {
  const pathname = usePathname() || '';
  const { progress, stepText, stepIndex } = getState(pathname);

  // Semicircle gauge: center (90,70), radius 60
  // Arc goes from (30,70) [left] to (150,70) [right]
  const cx = 90, cy = 70, r = 60;
  const circumference = Math.PI * r; // ≈ 188.5
  const strokeDashoffset = circumference * (1 - progress / 100);
  // needle: -90° = left (0%), 0° = up (50%), +90° = right (100%)
  const needleAngle = progress * 1.8 - 90;

  return (
    <div className="flex flex-col items-center w-full gap-3">
      {/* Gauge SVG — text lives inside so nothing overflows */}
      <svg viewBox="0 0 180 108" className="w-[200px] shrink-0">
        <defs>
          <linearGradient id="speedoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d="M 30 70 A 60 60 0 0 1 150 70"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d="M 30 70 A 60 60 0 0 1 150 70"
          fill="none"
          stroke="url(#speedoGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />

        {/* Minor tick marks at 0%, 25%, 50%, 75%, 100% */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const a = (pct / 100) * Math.PI;
          const ox = Math.cos(Math.PI - a), oy = -Math.sin(Math.PI - a);
          return (
            <line
              key={pct}
              x1={cx + r * ox}       y1={cy + r * oy}
              x2={cx + (r - 12) * ox} y2={cy + (r - 12) * oy}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Needle — rotates around cx,cy */}
        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <rect
            x={cx - 1.5}
            y={cy - r + 16}
            width="3"
            height={r - 16}
            rx="1.5"
            fill="white"
            opacity="0.92"
          />
        </g>

        {/* Hub */}
        <circle cx={cx} cy={cy} r="6.5" fill="white" />
        <circle cx={cx} cy={cy} r="3"   fill="#1e293b" />

        {/* Percentage and step label inside SVG */}
        <text
          x={cx} y="90"
          textAnchor="middle"
          fill="white"
          fontSize="20"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
        >
          {progress}%
        </text>
        <text
          x={cx} y="103"
          textAnchor="middle"
          fill="#93c5fd"
          fontSize="8"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
          letterSpacing="2"
        >
          {stepText.toUpperCase()}
        </text>
      </svg>

      {/* Step dots */}
      <div className="flex items-start justify-center gap-5 w-full px-6">
        {JOURNEY_STEPS.map((step, i) => {
          const done   = i < stepIndex;
          const active = i === stepIndex;
          return (
            <div key={step} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  done   ? 'bg-green-400' :
                  active ? 'bg-yellow-400 ring-2 ring-yellow-300/40 scale-125' :
                           'bg-white/20'
                }`}
              />
              <span
                className={`text-[0.5rem] font-[800] uppercase tracking-wide leading-none ${
                  active ? 'text-yellow-300' :
                  done   ? 'text-green-300'  :
                           'text-white/30'
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
