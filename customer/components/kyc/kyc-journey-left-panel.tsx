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

export function KycJourneyLeftPanel({
  loanSelection,
  progressPct,
  activeStepIndex,
}: KycJourneyLeftPanelProps) {
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
              d="M16 100 A84 84 0 0 1 184 100"
              fill="none"
              stroke="#23334f"
              strokeWidth="13"
              strokeLinecap="round"
            />
            <path
              d="M16 100 A84 84 0 0 1 176 70"
              fill="none"
              stroke="url(#kyc-gauge-grad)"
              strokeWidth="13"
              strokeLinecap="round"
            />
            <line x1="100" y1="100" x2="150" y2="64" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="100" r="7" fill="#fff" />
          </svg>
          <div className={styles.pct}>
            {progressPct}%<small>KYC</small>
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

        <h2 className={styles.leftTitle}>
          Loan <b>details</b>
        </h2>
        <p className={styles.leftSub}>The amount and tenure you selected stay visible while you complete KYC.</p>

        <div className={styles.calcSlot}>
          <LoanCalculationLeftRail loanSelection={loanSelection ?? null} />
        </div>

        <div className={styles.pills}>
          <div className={styles.pill}>
            <b>100%</b>
            <span>PAPERLESS</span>
          </div>
          <div className={styles.pill}>
            <b>Instant</b>
            <span>APPROVAL</span>
          </div>
          <div className={styles.pill}>
            <b>Zero</b>
            <span>HIDDEN FEES</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
