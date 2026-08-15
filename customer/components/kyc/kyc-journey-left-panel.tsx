'use client';

import type { CustomerLoanSelectionSnapshot } from '@/lib/api/customer-session';
import { LoanCalculationLeftRail } from '@/components/loan/loan-calculation-left-rail';
import { KYC_JOURNEY_STEPS } from '@/lib/kyc-journey-progress';
import styles from './kyc-hub-flow.module.css';

type KycJourneyLeftPanelProps = {
  loanSelection: CustomerLoanSelectionSnapshot | null | undefined;
  progressPct: number;
  activeStepIndex: number;
};

/** Semicircle gauge geometry (matches viewBox track path). */
const GAUGE_CX = 100;
const GAUGE_CY = 100;
const GAUGE_R = 84;
const GAUGE_CIRCUMFERENCE = Math.PI * GAUGE_R;

export function KycJourneyLeftPanel({
  loanSelection,
  progressPct,
  activeStepIndex,
}: KycJourneyLeftPanelProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
  const strokeDashoffset = GAUGE_CIRCUMFERENCE * (1 - pct / 100);
  /** Needle drawn pointing up; 0% → left (−90°), 100% → right (+90°). */
  const needleAngle = pct * 1.8 - 90;

  return (
    <aside className={styles.left}>
      <div className={styles.leftInner}>
        <div className={styles.gauge}>
          <svg viewBox="0 0 200 110" aria-hidden>
            <defs>
              <linearGradient id="kyc-gauge-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#facc15" />
                <stop offset="0.5" stopColor="#a3e635" />
                <stop offset="1" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path
              d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`}
              fill="none"
              stroke="#23334f"
              strokeWidth="13"
              strokeLinecap="round"
            />
            <path
              d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_R} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`}
              fill="none"
              stroke="url(#kyc-gauge-grad)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
            />
            <g transform={`rotate(${needleAngle} ${GAUGE_CX} ${GAUGE_CY})`}>
              <line
                x1={GAUGE_CX}
                y1={GAUGE_CY}
                x2={GAUGE_CX}
                y2={GAUGE_CY - GAUGE_R + 18}
                stroke="#fff"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
            <circle cx={GAUGE_CX} cy={GAUGE_CY} r="7" fill="#fff" />
          </svg>
          <div className={styles.pct}>
            {pct}%<small>KYC</small>
          </div>
        </div>

        <div className={styles.steps}>
          {KYC_JOURNEY_STEPS.map((step, i) => {
            const done = i < activeStepIndex;
            const now = i === activeStepIndex;
            return (
              <span
                key={step}
                className={[styles.stepDot, done ? styles.stepDotDone : '', now ? styles.stepDotNow : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {step}
              </span>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
